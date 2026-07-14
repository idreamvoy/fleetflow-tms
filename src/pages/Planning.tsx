import { useMemo, useState } from 'react';
import type { Order, Trip, Driver, Zone, OrderStatus, TripStatus } from '../lib/types';
import { TRIP_STATUS_LABEL } from '../lib/types';
import { IconRoute, IconPin, IconTruck, IconBox, IconPlus } from '../components/icons';
import OrderDetail from '../components/OrderDetail';
import MapModal from '../components/MapModal';
import TripModal from '../components/TripModal';

const shortZone = (name?: string | null) => {
  const n = name ?? '';
  if (/กทม|กรุงเทพ|ปริมณฑล/.test(n)) return 'กทม.';
  if (/ต่างประเทศ/.test(n)) return 'ต่างประเทศ';
  if (/ทั่วไป/.test(n)) return 'ทั่วไป';
  if (/ต่างจังหวัด|ตจว/.test(n)) return 'ต่างจังหวัด';
  return n || '—';
};
// ชื่อเที่ยว = ชื่อคนขับ (แทนการนับ TR-xx) — ยังไม่ระบุ ใช้ 'เที่ยว #id'
const tripLabel = (t: Trip) => t.driver_name || `เที่ยว #${t.id}`;
import { geocode, optimizeOrder, routePlan, fmtClock, fmtDuration, WAREHOUSE, haversine } from '../lib/geo';

const WAREHOUSE_ORIGIN = `${WAREHOUSE.lat},${WAREHOUSE.lng}`; // คลังเนเจอร์ทัช

const WAITING_STATUSES: OrderStatus[] = ['ready', 'cod_waiting', 'cod_transferred', 'oem'];

// มาตรวัดความจุแบบวงกลม
function CapGauge({ pct, color }: { pct: number; color: string }) {
  const R = 15.5;
  const C = 2 * Math.PI * R;
  const dash = Math.min(100, pct) / 100 * C;
  return (
    <div className="cap-gauge">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={R} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} transform="rotate(-90 18 18)" />
      </svg>
      <div className="cap-gauge-val">{pct}%</div>
    </div>
  );
}

export default function Planning({
  orders,
  trips,
  drivers,
  zones,
  onAssign,
  onUnassign,
  onReorder,
  onSetTripDriver,
  onCreateTrip,
  onSetTripStatus,
  onDeleteTrip,
}: {
  orders: Order[];
  trips: Trip[];
  drivers: Driver[];
  zones: Zone[];
  onAssign: (orderId: number, tripId: number) => Promise<void>;
  onUnassign: (orderId: number, tripId: number) => Promise<void>;
  onReorder: (tripId: number, orderIds: number[]) => Promise<void>;
  onSetTripDriver: (tripId: number, driverId: number | null) => Promise<void>;
  onCreateTrip: (input: { driver_id: number | null; zone_id: number | null; vehicle_type: string; capacity_boxes: number }) => Promise<void>;
  onSetTripStatus: (tripId: number, status: TripStatus) => Promise<void>;
  onDeleteTrip: (tripId: number) => Promise<void>;
}) {
  const assignedIds = useMemo(() => new Set(trips.flatMap((t) => t.order_ids)), [trips]);
  const unassigned = orders.filter((o) => !assignedIds.has(o.id) && WAITING_STATUSES.includes(o.status));

  const [selectedTrip, setSelectedTrip] = useState<number>(trips[0]?.id ?? 0);
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [day, setDay] = useState<string>('all');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [mapTrip, setMapTrip] = useState<Trip | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [confirmDelTrip, setConfirmDelTrip] = useState<number | null>(null);
  const selTrip = trips.find((t) => t.id === selectedTrip);

  // ---- ตัวกรองวัน: ใช้กับทั้งออเดอร์รอจัด + จุดส่งในเที่ยว ----
  const dayMatch = (o: Order) => day === 'all' || o.ship_date === day;
  const allStopsOf = (t: Trip) => t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
  const stopsOf = (t: Trip) => allStopsOf(t).filter(dayMatch); // เฉพาะวันที่เลือก
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

  // ---- ออเดอร์รอจัด (กรองวัน + เรียงระยะ) ----
  const filteredOrders = unassigned.filter(dayMatch);
  const shown = sortByDistance ? [...filteredOrders].sort((a, b) => getDistance(a) - getDistance(b)) : filteredOrders;

  // ---- ความคืบหน้าการวางแผน (ตามวันที่เลือก) ----
  const scopeAssigned = trips.reduce((s, t) => s + stopsOf(t).length, 0);
  const scopeTotal = scopeAssigned + filteredOrders.length;
  const progressPct = scopeTotal ? Math.round((scopeAssigned / scopeTotal) * 100) : 0;
  const dayLabel = day === 'all' ? 'ทุกวัน' : fmtDay(day);

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
  // จัดอัตโนมัติทั้งหมด: กระจายออเดอร์ที่รอจัดเข้ารถที่เหมาะ (จำลองความจุก่อน)
  const autoAssignAll = async () => {
    const load: Record<number, number> = {};
    trips.forEach((t) => { load[t.id] = usedBoxes(t); });
    const plan: Array<[number, number]> = [];
    for (const o of shown) {
      const fit = trips.filter((t) => t.zone_id === o.zone_id && load[t.id] + o.box_count <= t.capacity_boxes);
      if (!fit.length) continue;
      fit.sort((a, b) => (b.capacity_boxes - load[b.id]) - (a.capacity_boxes - load[a.id])); // รถที่ว่างมากสุดก่อน
      const target = fit[0];
      load[target.id] += o.box_count;
      plan.push([o.id, target.id]);
    }
    if (!plan.length) return;
    setBusyAll(true);
    try { for (const [oid, tid] of plan) await onAssign(oid, tid); } finally { setBusyAll(false); }
  };
  // จัดลำดับจุดส่งให้สั้นที่สุด — เขียนกลับโดยคงลำดับจุดวันอื่นไว้
  const mergeBack = (t: Trip, reorderedDayIds: number[]) => {
    const daySet = new Set(reorderedDayIds);
    let k = 0;
    return t.order_ids.map((id) => (daySet.has(id) ? reorderedDayIds[k++] : id));
  };
  const optimize = async (t: Trip) => {
    const st = stopsOf(t);
    if (st.length < 2) return;
    const pts = st.map((o) => geocode(o.delivery_location, o.zone_id));
    const nn = optimizeOrder(pts);
    const nnKm = routePlan(nn.map((i) => pts[i])).totalKm;
    const curKm = routePlan(pts).totalKm;
    const bestIdx = nnKm < curKm ? nn : pts.map((_, i) => i);
    await onReorder(t.id, mergeBack(t, bestIdx.map((i) => st[i].id)));
  };
  const openMaps = (t: Trip) => {
    const st = stopsOf(t);
    if (!st.length) return;
    const parts = [WAREHOUSE_ORIGIN, ...st.map((o) => `${o.delivery_location} ประเทศไทย`)];
    window.open('https://www.google.com/maps/dir/' + parts.map((p) => encodeURIComponent(p)).join('/'), '_blank');
  };
  const drop = async (t: Trip, dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); return; }
    const dayIds = stopsOf(t).map((o) => o.id);
    const [moved] = dayIds.splice(dragIdx, 1);
    dayIds.splice(dropIdx, 0, moved);
    setDragIdx(null);
    await onReorder(t.id, mergeBack(t, dayIds));
  };

  // ---- summary (ตามวันที่เลือก) ----
  const waitingBoxes = filteredOrders.reduce((s, o) => s + o.box_count, 0);
  const bkkWait = filteredOrders.filter((o) => o.zone_id === 1).length;
  const upcWait = filteredOrders.filter((o) => o.zone_id !== 1).length;
  const freeTrucks = trips.filter((t) => usedBoxes(t) < t.capacity_boxes).length;

  const zoneAccent = (o: Order) => (isUrgent(o) ? '#f43f5e' : o.zone_id === 1 ? '#6366f1' : '#f59e0b');

  return (
    <>
      {/* Hero: ความคืบหน้า + จัดอัตโนมัติ */}
      <div className="plan-hero">
        <div className="plan-hero-ico"><IconRoute width={24} height={24} /></div>
        <div className="plan-hero-body">
          <div className="plan-hero-top">
            <span className="plan-hero-title">วางแผน · {dayLabel}</span>
            <span className="plan-hero-sub">จัดแล้ว {scopeAssigned} / {scopeTotal} ออเดอร์ · {progressPct}%</span>
          </div>
          <div className="plan-hero-bar"><div style={{ width: `${progressPct}%` }} /></div>
        </div>
        <button className="btn btn-primary plan-auto" disabled={busyAll || shown.length === 0} onClick={autoAssignAll} title="จัดออเดอร์ที่รอเข้ารถที่เหมาะโดยอัตโนมัติ">
          {busyAll ? 'กำลังจัด…' : `✨ จัดอัตโนมัติ (${shown.length})`}
        </button>
      </div>

      {/* สรุปภาพรวมการวางแผน */}
      <div className="plan-summary">
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBox width={18} height={18} /></div>
          <div><div className="ps-val">{filteredOrders.length} <span>รายการ</span></div><div className="ps-label">รอจัดรถ · {waitingBoxes} กล่อง</div></div>
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
              <div className="empty-plan">
                <div className="empty-plan-ico"><IconTruck width={30} height={30} /></div>
                <div style={{ fontWeight: 600 }}>จัดครบทุกออเดอร์แล้ว 🎉</div>
                <div className="sub">ไม่มีออเดอร์รอจัดรถในวันนี้</div>
              </div>
            ) : (
              shown.map((o) => {
                const rec = recommendTrip(o);
                return (
                  <div key={o.id} className="wait-card">
                    <div className="wait-accent" style={{ background: zoneAccent(o) }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                        <code>{o.order_no}</code>
                        <span className="zone-pill">{o.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด'}</span>
                        {isUrgent(o) && <span className="warn-tag urgent">🔥 ด่วน</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{o.customer_name}</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{productSummary(o)} · {o.box_count} กล่อง</div>
                      <div className="wait-meta">
                        <span className="wait-chip">📍 {getDistance(o)} กม.</span>
                        {rec ? (
                          <span className="wait-chip rec">💡 แนะนำ {tripLabel(rec)}</span>
                        ) : (
                          <span className="wait-chip warn">⚠️ ไม่มีรถว่างพอ</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'center' }}>
                      <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={busy === o.id || !selectedTrip} onClick={() => assign(o.id, selectedTrip)}>
                        {busy === o.id ? '…' : `จัดเข้า ${selTrip ? tripLabel(selTrip) : 'เที่ยว'}`}
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
              <h3>เที่ยวรถ · {dayLabel}</h3>
              <div className="sub">มาตรวัดความจุ · ไทม์ไลน์เส้นทาง · ลากวางปรับลำดับได้</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowTripModal(true)}>
              <IconPlus /> สร้างเที่ยว
            </button>
          </div>
          <div className="card-scroll">
            {trips.map((t) => {
              const stops = stopsOf(t);
              const used = usedBoxes(t);
              const pct = Math.round((used / t.capacity_boxes) * 100);
              const over = used > t.capacity_boxes;
              const active = t.id === selectedTrip;
              const capColor = over ? '#f43f5e' : pct > 80 ? '#f59e0b' : '#10b981';
              const plan = active ? routePlan(stops.map((o) => geocode(o.delivery_location, o.zone_id))) : null;
              const codTotal = stops.reduce((s, o) => s + o.cod_amount, 0);
              // วันกำหนดส่งของเที่ยวนี้ (แสดงตอนเลือก 'ทุกวัน')
              const tripDates = day === 'all' ? [...new Set(stops.map((o) => o.ship_date || 'none'))].sort() : [];
              return (
                <div key={t.id} className={`plan-trip${active ? ' active' : ''}`} onClick={() => setSelectedTrip(t.id)}>
                  <div className="plan-trip-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {tripLabel(t)}
                        <span className="zone-pill">{shortZone(t.zone_name)}</span>
                      </div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{t.vehicle_type}</div>
                      <div className="cap-note" style={{ color: over ? 'var(--rose)' : '#64748b' }}>
                        {used} / {t.capacity_boxes} กล่อง · {over ? `เกิน ${pct - 100}%` : `รับเพิ่มได้ ${t.capacity_boxes - used}`}
                      </div>
                      {tripDates.length > 0 && (
                        <div className="trip-dates">
                          <span className="trip-dates-lb">🗓️ กำหนดส่ง</span>
                          {tripDates.map((dd) => (
                            <span key={dd} className={`trip-date-chip${dd === 'none' ? ' none' : ''}`}>{dd === 'none' ? 'ไม่ระบุวัน' : fmtDay(dd)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <CapGauge pct={pct} color={capColor} />
                  </div>

                  {/* toolbar: จัดลำดับ + แผนที่ + ลบ */}
                  <div className="trip-toolbar" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost xs" disabled={stops.length < 2} onClick={() => optimize(t)} title="จัดลำดับจุดส่งให้สั้นที่สุด">
                      <IconRoute width={15} height={15} /> จัดลำดับ
                    </button>
                    <button className="btn btn-primary xs" disabled={!stops.length} onClick={() => setMapTrip({ ...t, order_ids: stops.map((o) => o.id) })} title="ดูแผนที่เส้นทาง">
                      🗺️ แผนที่
                    </button>
                    <button className="btn btn-ghost xs" disabled={!stops.length} onClick={() => openMaps(t)}>Google</button>
                    {confirmDelTrip === t.id ? (
                      <>
                        <button className="btn btn-ghost xs danger" onClick={async () => { await onDeleteTrip(t.id); setConfirmDelTrip(null); }}>ยืนยันลบ</button>
                        <button className="btn btn-ghost xs" onClick={() => setConfirmDelTrip(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost xs danger" title="ลบเที่ยวรถนี้" onClick={() => setConfirmDelTrip(t.id)}>🗑️ ลบเที่ยว</button>
                    )}
                  </div>

                  {active && (
                    <>
                      {/* ไทม์ไลน์จุดส่ง (ลากวางได้) */}
                      {stops.length === 0 ? (
                        <div className="sub" style={{ color: '#94a3b8', padding: '10px 2px' }}>ยังไม่มีจุดส่งในวันนี้ — จัดออเดอร์เข้าเที่ยวนี้ได้</div>
                      ) : (
                        <div className="trip-timeline">
                          {stops.map((o, i) => {
                            const mismatch = o.zone_id !== t.zone_id;
                            return (
                              <div
                                key={o.id}
                                className={`tl-stop${dragIdx === i ? ' dragging' : ''}`}
                                draggable
                                onDragStart={() => setDragIdx(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => drop(t, i)}
                              >
                                <div className="tl-dot">{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                                  <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {o.customer_name}
                                    {day === 'all' && <span className="stop-date-chip">🗓️ {o.ship_date ? fmtDay(o.ship_date) : 'ไม่ระบุ'}</span>}
                                    {mismatch && <span className="warn-tag zone">⚠️ ผิดโซน</span>}
                                    {isUrgent(o) && <span className="warn-tag urgent">🔥</span>}
                                  </div>
                                  <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                                  {plan && <div className="stop-eta">ระยะ {plan.legs[i].km} กม.</div>}
                                </div>
                                <button className="stop-remove" title="นำออกจากเที่ยว" disabled={busy === o.id} onClick={(e) => { e.stopPropagation(); unassign(o.id, t.id); }}>×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* manifest */}
                      <div className="manifest">
                        <span>รวม <b>{used}</b> กล่อง · <b>{stops.length}</b> จุด{plan && stops.length > 0 ? <> · ระยะ ~<b>{plan.totalKm}</b> กม.</> : null}</span>
                        <span>COD รวม <b>฿{codTotal.toLocaleString()}</b></span>
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

      {showTripModal && (
        <TripModal
          drivers={drivers}
          zones={zones}
          onClose={() => setShowTripModal(false)}
          onCreate={async (input) => { await onCreateTrip(input); setShowTripModal(false); }}
        />
      )}
    </>
  );
}
