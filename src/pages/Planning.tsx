import { useMemo, useState } from 'react';
import type { Order, Trip, OrderStatus } from '../lib/types';
import { CARRIERS, TRIP_STATUS_LABEL } from '../lib/types';
import { IconRoute, IconPin } from '../components/icons';

// สถานะที่ถือว่า "รอจัดรถ" (ตามที่ลูกค้ากำหนด)
const WAITING_STATUSES: OrderStatus[] = ['ready', 'cod_waiting', 'cod_transferred', 'oem'];

export default function Planning({
  orders,
  trips,
  onAssign,
  onUnassign,
}: {
  orders: Order[];
  trips: Trip[];
  onAssign: (orderId: number, tripId: number) => Promise<void>;
  onUnassign: (orderId: number, tripId: number) => Promise<void>;
}) {
  const assignedIds = useMemo(() => new Set(trips.flatMap((t) => t.order_ids)), [trips]);
  const unassigned = orders.filter((o) => !assignedIds.has(o.id) && WAITING_STATUSES.includes(o.status));

  const [selectedTrip, setSelectedTrip] = useState<number>(trips[0]?.id ?? 0);
  const [carriers, setCarriers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  // ฟิลเตอร์ตามวันกำหนดจัดส่ง
  const [day, setDay] = useState<string>('all');
  const dayOptions = useMemo(() => {
    const s = new Set<string>();
    unassigned.forEach((o) => o.ship_date && s.add(o.ship_date));
    return Array.from(s).sort();
  }, [unassigned]);
  const shown = day === 'all' ? unassigned : unassigned.filter((o) => o.ship_date === day);
  const fmtDay = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  const assign = async (orderId: number) => {
    if (!selectedTrip) return;
    setBusy(orderId);
    try { await onAssign(orderId, selectedTrip); } finally { setBusy(null); }
  };
  const unassign = async (orderId: number, tripId: number) => {
    setBusy(orderId);
    try { await onUnassign(orderId, tripId); } finally { setBusy(null); }
  };

  const productSummary = (o: Order) => {
    const first = o.items[0]?.product_name ?? '';
    return o.items.length > 1 ? `${first} +${o.items.length - 1} รายการ` : first;
  };
  const usedBoxes = (t: Trip) => t.order_ids.reduce((s, id) => s + (orders.find((o) => o.id === id)?.box_count ?? 0), 0);

  // เปิด Google Maps นำทางตามลำดับจุดส่ง
  const openRoute = (t: Trip) => {
    const stops = t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
    if (!stops.length) return;
    const parts = ['คลังสินค้า FleetFlow กรุงเทพ', ...stops.map((o) => `${o.delivery_location} ประเทศไทย`)];
    window.open('https://www.google.com/maps/dir/' + parts.map((p) => encodeURIComponent(p)).join('/'), '_blank');
  };

  return (
    <>
      {/* ฟิลเตอร์วันกำหนดจัดส่ง */}
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
      </div>

      <div className="grid-2">
        {/* ซ้าย: ออเดอร์รอจัดรถ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>ออเดอร์รอจัดรถ</h3>
              <div className="sub">เลือกเที่ยวทางขวา แล้วกด “จัดเข้าเที่ยว”</div>
            </div>
            <span className="sub">{shown.length} รายการ</span>
          </div>
          <div className="card-scroll">
            {shown.length === 0 ? (
              <div className="loading">ไม่มีออเดอร์รอจัดรถ 🎉</div>
            ) : (
              shown.map((o) => (
                <div key={o.id} className="wait-card">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <code>{o.order_no}</code>
                      <span className="zone-pill">{o.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด'}</span>
                    </div>
                    <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                    <div className="sub" style={{ color: '#94a3b8' }}>{productSummary(o)}</div>
                    <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                  </div>
                  <button className="btn btn-primary" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }} disabled={busy === o.id || !selectedTrip} onClick={() => assign(o.id)}>
                    {busy === o.id ? '…' : 'จัดเข้าเที่ยว'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ขวา: เที่ยวรถวันนี้ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>เที่ยวรถวันนี้ · TR-{String(selectedTrip).padStart(2, '0')}</h3>
              <div className="sub">คลิกการ์ดเพื่อเลือกเที่ยวปลายทาง · แก้ไข/ยกเลิกได้</div>
            </div>
          </div>
          <div className="card-scroll">
            {trips.map((t) => {
              const used = usedBoxes(t);
              const stops = t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
              const active = t.id === selectedTrip;
              const over = used > t.capacity_boxes;
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
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: over ? 'var(--rose)' : 'inherit' }}>{used} / {t.capacity_boxes} กล่อง</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{stops.length} จุดส่ง</div>
                    </div>
                  </div>

                  {/* ขนส่งประจำคัน (ด้านบนการ์ด) + คำนวณเส้นทาง */}
                  <div className="trip-toolbar" onClick={(e) => e.stopPropagation()}>
                    <label className="trip-carrier">
                      <span>ขนส่ง</span>
                      <select value={carriers[t.id] ?? CARRIERS[0]} onChange={(e) => setCarriers((c) => ({ ...c, [t.id]: e.target.value }))}>
                        {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <button className="btn btn-ghost" disabled={!stops.length} onClick={() => openRoute(t)}>
                      <IconRoute width={16} height={16} /> คำนวณเส้นทาง
                    </button>
                  </div>

                  {active && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {stops.length === 0 ? (
                        <div className="sub" style={{ color: '#94a3b8', padding: '4px 2px' }}>ยังไม่มีจุดส่ง — จัดออเดอร์เข้าเที่ยวนี้ได้</div>
                      ) : (
                        stops.map((o) => (
                          <div key={o.id} className="plan-stop">
                            <div className="stop-num"><IconPin width={13} height={13} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                              <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                            </div>
                            <button className="stop-remove" title="นำออกจากเที่ยว" disabled={busy === o.id} onClick={() => unassign(o.id, t.id)}>×</button>
                          </div>
                        ))
                      )}
                      <div className="sub" style={{ color: 'var(--indigo)', fontWeight: 600, marginTop: 2 }}>
                        สถานะเที่ยว: {TRIP_STATUS_LABEL[t.status]}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
