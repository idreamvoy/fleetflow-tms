import { useMemo, useState } from 'react';
import type { Order, Trip, OrderStatus } from '../lib/types';
import { CARRIERS, TRIP_STATUS_LABEL } from '../lib/types';
import { IconRoute, IconPin, IconTruck, IconBox } from '../components/icons';
import OrderDetail from '../components/OrderDetail';
import MapModal from '../components/MapModal';
import { geocode, optimizeOrder, routePlan, fmtClock, fmtDuration, WAREHOUSE, haversine } from '../lib/geo';

const WAREHOUSE_ORIGIN = `${WAREHOUSE.lat},${WAREHOUSE.lng}`; // คลังเนเจอร์ทัช

const WAITING_STATUSES: OrderStatus[] = ['ready', 'cod_waiting', 'cod_transferred', 'oem'];

export default function Planning({
  orders,
  trips,
  onAssign,
  onUnassign,
  onReorder,
}: {
  orders: Order[];
  trips: Trip[];
  onAssign: (orderId: number, tripId: number) => Promise<void>;
  onUnassign: (orderId: number, tripId: number) => Promise<void>;
  onReorder: (tripId: number, orderIds: number[]) => Promise<void>;
}) {
  const assignedIds = useMemo(() => new Set(trips.flatMap((t) => t.order_ids)), [trips]);
  const unassigned = orders.filter((o) => !assignedIds.has(o.id) && WAITING_STATUSES.includes(o.status));

  const [selectedTrip, setSelectedTrip] = useState<number>(trips[0]?.id ?? 0);
  const [carriers, setCarriers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [day, setDay] = useState<string>('all');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [mapTrip, setMapTrip] = useState<Trip | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);

  const stopsOf = (t: Trip) => t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
  const usedBoxes = (t: Trip) => stopsOf(t).reduce((s, o) => s + o.box_count, 0);
  const isUrgent = (o: Order) => o.items.some((it) => (it.note || '').includes('ด่วน'));
  const productSummary = (o: Order) => {
    const first = o.items[0]?.product_name ?? '';
    return o.items.length > 1 ? `${first} +${o.items.length - 1} รายการ` : first;
  };

  // ---- Smart assign: เที่ยวที่แนะนำสำหรับออเดอร์ ----
  const recommendTrip = (o: Order): Trip | null => {
    const fit = trips.filter((t) => t.zone_id === o.zone_id && usedBoxes(t) + o.box_count <= t.capacity_boxes);
    if (!fit.length) return null;
    const oPt = geocode(o.delivery_location, o.zone_id);
    let best = fit[0];
    let bestD = Infinity;
    fit.forEach((t) => {
      const st = stopsOf(t);
      const last = st.length ? geocode(st[st.length - 1].delivery_location, st[st.length - 1].zone_id) : WAREHOUSE;
      const d = haversine(last, oPt);
      if (d < bestD) { bestD = d; best = t; }
    });
    return best;
  };

  // ---- date filter ----
  const dayOptions = useMemo(() => {
    const s = new Set<string>();
    unassigned.forEach((o) => o.ship_date && s.add(o.ship_date));
    return Array.from(s).sort();
  }, [unassigned]);
  const fmtDay = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  // ---- distance from warehouse ----
  const getDistance = (o: Order): number => {
    const pt = geocode(o.delivery_location, o.zone_id);
    return Math.round(haversine(WAREHOUSE, pt) * 10) / 10;
  };

  // ---- sort by distance if needed ----
  let filteredOrders = day === 'all' ? unassigned : unassigned.filter((o) => o.ship_date === day);
  const shown = sortByDistance ? [...filteredOrders].sort((a, b) => getDistance(a) - getDistance(b)) : filteredOrders;

  // ---- actions ----
  const assign = async (orderId: number, tripId: number) => {
    if (!tripId) return;
    setBusy(orderId);
    try { await onAssign(orderId, tripId); } finally { setBusy(null); }
  };
  const unassign = async (orderId: number, tripId: number) => {
    setBusy(orderId);
    try { await onUnassign(orderId, tripId); } finally { setBusy(null); }
  };
  const optimize = async (t: Trip) => {
    const st = stopsOf(t);
    if (st.length < 2) return;
    const pts = st.map((o) => geocode(o.delivery_location, o.zone_id));
    const nn = optimizeOrder(pts);
    // เลือกลำดับที่สั้นกว่า ระหว่าง nearest-neighbor กับลำดับปัจจุบัน (กันไม่ให้แย่ลง)
    const nnKm = routePlan(nn.map((i) => pts[i])).totalKm;
    const curKm = routePlan(pts).totalKm;
    const best = nnKm < curKm ? nn : pts.map((_, i) => i);
    await onReorder(t.id, best.map((i) => st[i].id));
  };
  const openMaps = (t: Trip) => {
    const st = stopsOf(t);
    if (!st.length) return;
    const parts = [WAREHOUSE_ORIGIN, ...st.map((o) => `${o.delivery_location} ประเทศไทย`)];
    window.open('https://www.google.com/maps/dir/' + parts.map((p) => encodeURIComponent(p)).join('/'), '_blank');
  };
  const drop = async (t: Trip, dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); return; }
    const ids = [...t.order_ids];
    const [moved] = ids.splice(dragIdx, 1);
    ids.splice(dropIdx, 0, moved);
    setDragIdx(null);
    await onReorder(t.id, ids);
  };

  // ---- summary ----
  const waitingBoxes = unassigned.reduce((s, o) => s + o.box_count, 0);
  const bkkWait = unassigned.filter((o) => o.zone_id === 1).length;
  const upcWait = unassigned.filter((o) => o.zone_id !== 1).length;
  const freeTrucks = trips.filter((t) => usedBoxes(t) < t.capacity_boxes).length;

  return (
    <>
      {/* สรุปภาพรวมการวางแผน */}
      <div className="plan-summary">
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBox width={18} height={18} /></div>
          <div><div className="ps-val">{unassigned.length} <span>รายการ</span></div><div className="ps-label">รอจัดรถ · {waitingBoxes} กล่อง</div></div>
        </div>
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#ecfeff', color: '#0891b2' }}><IconPin width={18} height={18} /></div>
          <div><div className="ps-val">{bkkWait} <span>/ {upcWait}</span></div><div className="ps-label">กทม. / ต่างจังหวัด</div></div>
        </div>
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#dcfce7', color: '#10b981' }}><IconTruck width={18} height={18} /></div>
          <div><div className="ps-val">{freeTrucks} <span>/ {trips.length} คัน</span></div><div className="ps-label">รถที่ยังรับได้</div></div>
        </div>
      </div>

      {/* ฟิลเตอร์วันกำหนดจัดส่ง + เรียงตามระยะ */}
      <div className="filter-bar">
        <span className="filter-label">กำหนดจัดส่ง:</span>
        <button className={`chip${day === 'all' ? ' active' : ''}`} onClick={() => setDay('all')}>
          ทุกวัน <span className="chip-count">{unassigned.length}</span>
        </button>
        {dayOptions.map((d) => (
          <button key={d} className={`chip${day === d ? ' active' : ''}`} onClick={() => setDay(d)}>
            {fmtDay(d)} <span className="chip-count">{unassigned.filter((o) => o.ship_date === d).length}</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-ghost xs${sortByDistance ? ' active' : ''}`}
            onClick={() => setSortByDistance(!sortByDistance)}
            title="เรียงตามระยะห่างจากคลัง"
          >
            📍 เรียงตามระยะ
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* ซ้าย: ออเดอร์รอจัดรถ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>ออเดอร์รอจัดรถ</h3>
              <div className="sub">คลิกการ์ดเพื่อดูรายละเอียด · ระบบแนะนำรถที่เหมาะให้</div>
            </div>
            <span className="sub">{shown.length} รายการ</span>
          </div>
          <div className="card-scroll">
            {shown.length === 0 ? (
              <div className="loading">ไม่มีออเดอร์รอจัดรถ 🎉</div>
            ) : (
              shown.map((o) => {
                const rec = recommendTrip(o);
                return (
                  <div key={o.id} className="wait-card">
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                        <code>{o.order_no}</code>
                        <span className="zone-pill">{o.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด'}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>📍 {getDistance(o)} กม.</span>
                        {isUrgent(o) && <span className="warn-tag urgent">🔥 ด่วน</span>}
                      </div>
                      <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{productSummary(o)}</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                      {rec ? (
                        <div className="rec-badge">💡 แนะนำ TR-{String(rec.id).padStart(2, '0')}</div>
                      ) : (
                        <div className="rec-badge none">⚠️ ไม่มีรถโซนนี้ว่างพอ</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'center' }}>
                      <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={busy === o.id || !selectedTrip} onClick={() => assign(o.id, selectedTrip)}>
                        {busy === o.id ? '…' : `จัดเข้า TR-${String(selectedTrip).padStart(2, '0')}`}
                      </button>
                      {rec && rec.id !== selectedTrip && (
                        <button className="btn btn-ghost mini" disabled={busy === o.id} onClick={() => assign(o.id, rec.id)}>
                          จัดตามแนะนำ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ขวา: เที่ยวรถ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>เที่ยวรถวันนี้ · TR-{String(selectedTrip).padStart(2, '0')}</h3>
              <div className="sub">คำนวณเส้นทาง · จัดลำดับ · ลากวางปรับลำดับได้</div>
            </div>
          </div>
          <div className="card-scroll">
            {trips.map((t) => {
              const stops = stopsOf(t);
              const used = usedBoxes(t);
              const pct = Math.round((used / t.capacity_boxes) * 100);
              const over = used > t.capacity_boxes;
              const active = t.id === selectedTrip;
              const plan = active ? routePlan(stops.map((o) => geocode(o.delivery_location, o.zone_id))) : null;
              const codTotal = stops.reduce((s, o) => s + o.cod_amount, 0);
              return (
                <div key={t.id} className={`plan-trip${active ? ' active' : ''}`} onClick={() => setSelectedTrip(t.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                        TR-{String(t.id).padStart(2, '0')}
                        <span className="zone-pill">{t.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด'}</span>
                      </div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{t.vehicle_type} · {t.driver_name}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ fontWeight: 700, color: over ? 'var(--rose)' : 'inherit' }}>{used} / {t.capacity_boxes} กล่อง</div>
                      <div className="load-bar"><div style={{ width: `${Math.min(100, pct)}%`, background: over ? 'var(--rose)' : pct > 80 ? 'var(--amber)' : 'var(--indigo)' }} /></div>
                      <div className="sub" style={{ color: over ? 'var(--rose)' : '#94a3b8' }}>{over ? `เกินความจุ ${pct}%` : `${pct}% · ${stops.length} จุด`}</div>
                    </div>
                  </div>

                  {/* toolbar: ขนส่ง + คำนวณ + จัดลำดับ + แผนที่ */}
                  <div className="trip-toolbar" onClick={(e) => e.stopPropagation()}>
                    <label className="trip-carrier">
                      <span>ขนส่ง</span>
                      <select value={carriers[t.id] ?? CARRIERS[0]} onChange={(e) => setCarriers((c) => ({ ...c, [t.id]: e.target.value }))}>
                        {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <button className="btn btn-ghost xs" disabled={stops.length < 2} onClick={() => optimize(t)} title="จัดลำดับจุดส่งให้สั้นที่สุด">
                      <IconRoute width={15} height={15} /> จัดลำดับอัตโนมัติ
                    </button>
                    <button className="btn btn-primary xs" disabled={!stops.length} onClick={() => setMapTrip(t)} title="ดูแผนที่เส้นทาง">
                      🗺️ ดูแผนที่
                    </button>
                    <button className="btn btn-ghost xs" disabled={!stops.length} onClick={() => openMaps(t)}>Google Maps</button>
                  </div>

                  {active && (
                    <>
                      {/* สรุปเส้นทาง */}
                      {plan && stops.length > 0 && (
                        <div className="route-summary">
                          <div><span className="rs-label">ระยะรวม</span><span className="rs-val">~{plan.totalKm} กม.</span></div>
                          <div><span className="rs-label">เวลาเดินทาง</span><span className="rs-val">~{fmtDuration(plan.totalMin)}</span></div>
                          <div><span className="rs-label">ถึงจุดสุดท้าย</span><span className="rs-val">{fmtClock(plan.legs[plan.legs.length - 1].etaMin)}</span></div>
                        </div>
                      )}

                      {/* จุดส่ง (ลากวางได้) */}
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stops.length === 0 ? (
                          <div className="sub" style={{ color: '#94a3b8', padding: '4px 2px' }}>ยังไม่มีจุดส่ง — จัดออเดอร์เข้าเที่ยวนี้ได้</div>
                        ) : (
                          stops.map((o, i) => {
                            const mismatch = o.zone_id !== t.zone_id;
                            return (
                              <div
                                key={o.id}
                                className={`plan-stop drag${dragIdx === i ? ' dragging' : ''}`}
                                draggable
                                onDragStart={() => setDragIdx(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => drop(t, i)}
                              >
                                <div className="stop-num">{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                                  <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {o.customer_name}
                                    {mismatch && <span className="warn-tag zone">⚠️ ผิดโซน</span>}
                                    {isUrgent(o) && <span className="warn-tag urgent">🔥</span>}
                                  </div>
                                  <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                                  {plan && <div className="stop-eta">ถึง ~{fmtClock(plan.legs[i].etaMin)} · {plan.legs[i].km} กม.</div>}
                                </div>
                                <button className="stop-remove" title="นำออกจากเที่ยว" disabled={busy === o.id} onClick={(e) => { e.stopPropagation(); unassign(o.id, t.id); }}>×</button>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* manifest */}
                      <div className="manifest">
                        <span>รวม <b>{used}</b> กล่อง · <b>{stops.length}</b> จุด</span>
                        <span>COD รวม <b>฿{codTotal.toLocaleString()}</b></span>
                        <span className="sub" style={{ color: 'var(--indigo)', fontWeight: 600 }}>{TRIP_STATUS_LABEL[t.status]}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <OrderDetail order={detail} onClose={() => setDetail(null)} />

      {mapTrip && <MapModal orders={orders} trip={mapTrip} onClose={() => setMapTrip(null)} />}
    </>
  );
}
