import { useMemo, useState } from 'react';
import type { Order, Trip } from '../lib/types';
import { CARRIERS, TRIP_STATUS_LABEL } from '../lib/types';
import { IconTruck, IconRoute, IconPin } from '../components/icons';

export default function Planning({
  orders,
  trips,
  onAssign,
}: {
  orders: Order[];
  trips: Trip[];
  onAssign: (orderId: number, tripId: number) => Promise<void>;
}) {
  const assignedIds = useMemo(() => new Set(trips.flatMap((t) => t.order_ids)), [trips]);
  // ออเดอร์รอจัดรถ = ยังไม่อยู่ในเที่ยว และยังไม่ส่ง/ไม่ค้าง
  const unassigned = orders.filter(
    (o) => !assignedIds.has(o.id) && !['delivered', 'failed', 'waiting_ship'].includes(o.status)
  );

  const [selectedTrip, setSelectedTrip] = useState<number>(trips[0]?.id ?? 0);
  const [carriers, setCarriers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  // day tabs
  const [day, setDay] = useState<string>('all');
  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    unassigned.forEach((o) => m.set(o.ship_date ?? '-', (m.get(o.ship_date ?? '-') ?? 0) + 1));
    return m;
  }, [unassigned]);
  const days = ['all', ...Array.from(dayCounts.keys())];
  const dayLabel = (d: string) =>
    d === 'all' ? 'ทุกวัน' : new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const shown = day === 'all' ? unassigned : unassigned.filter((o) => o.ship_date === day);

  const assign = async (orderId: number) => {
    if (!selectedTrip) return;
    setBusy(orderId);
    try {
      await onAssign(orderId, selectedTrip);
    } finally {
      setBusy(null);
    }
  };

  const productSummary = (o: Order) => {
    const first = o.items[0]?.product_name ?? '';
    return o.items.length > 1 ? `${first} +${o.items.length - 1} รายการ` : first;
  };
  const usedBoxes = (t: Trip) =>
    t.order_ids.reduce((s, id) => s + (orders.find((o) => o.id === id)?.box_count ?? 0), 0);

  return (
    <>
      {/* Day tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <span style={{ alignSelf: 'center', color: 'var(--text-2)', fontWeight: 600, padding: '0 8px' }}>วางแผนตามวัน:</span>
        {days.map((d) => (
          <button key={d} className={`tab${day === d ? ' active' : ''}`} onClick={() => setDay(d)}>
            {dayLabel(d)} <span className="tab-count">{d === 'all' ? unassigned.length : dayCounts.get(d) ?? 0}</span>
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
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <button className="btn btn-primary" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }} disabled={busy === o.id} onClick={() => assign(o.id)}>
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
              <div className="sub">คลิกการ์ดเพื่อเลือกเที่ยวปลายทาง · กำหนดขนส่งต่อออเดอร์</div>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {trips.map((t) => {
              const used = usedBoxes(t);
              const stops = t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
              const active = t.id === selectedTrip;
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
                      <div style={{ fontWeight: 700 }}>{used} / {t.capacity_boxes} กล่อง</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{stops.length} จุดส่ง</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); }}>
                    <IconRoute width={16} height={16} /> คำนวณเส้นทาง ({t.distance_km} กม.)
                  </button>

                  {active && stops.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stops.map((o) => (
                        <div key={o.id} className="plan-stop">
                          <div className="stop-num"><IconPin width={13} height={13} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                            <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location}</div>
                          </div>
                          <select
                            className="carrier-select"
                            value={carriers[`${t.id}-${o.id}`] ?? CARRIERS[0]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setCarriers((c) => ({ ...c, [`${t.id}-${o.id}`]: e.target.value }))}
                          >
                            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {active && (
                    <div className="sub" style={{ marginTop: 8, color: 'var(--indigo)', fontWeight: 600 }}>
                      <IconTruck width={14} height={14} style={{ verticalAlign: 'middle' }} /> {TRIP_STATUS_LABEL[t.status]}
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
