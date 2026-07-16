import { useMemo, useState } from 'react';
import type { Order, Driver, Trip } from '../lib/types';
import { StatusBadge } from '../components/badges';
import { slaOf } from '../lib/sla';
import { IconTruck, IconPin, IconCheck, IconBox } from '../components/icons';

type DayKey = 'today' | 'tomorrow' | 'all';

const dstr = (d: Date) => d.toLocaleDateString('sv-SE');
const TODAY = () => dstr(new Date());
const TOMORROW = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dstr(d); };
const fmtDay = (iso?: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ไม่ระบุ';

const tripLabel = (t: Trip) => t.driver_name || `เที่ยว #${t.id}`;

// ดึงเบอร์โทรจากที่อยู่ (template บริษัทมักมี "โทร 081-xxx-xxxx" ต่อท้าย)
function extractPhone(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}|0\d{8,9}/);
  return m ? m[0] : null;
}

export default function DriverApp({
  drivers,
  trips,
  orders,
  onOpenPod,
}: {
  drivers: Driver[];
  trips: Trip[];
  orders: Order[];
  onOpenPod: (order: Order, trip: Trip) => void;
}) {
  const [tripId, setTripId] = useState<number>(trips[0]?.id ?? 0);
  const [day, setDay] = useState<DayKey>('all');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const trip = trips.find((t) => t.id === tripId) ?? trips[0];
  const driver = drivers.find((d) => d.id === trip?.driver_id);
  const vehicle = driver?.vehicle ?? trip?.vehicle_type ?? '';
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const allStops = useMemo(
    () => (trip ? (trip.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[]) : []),
    [trip, orders]
  );

  const today = TODAY(), tomorrow = TOMORROW();
  const inDay = (o: Order, k: DayKey) => (k === 'all' ? true : k === 'today' ? o.ship_date === today : o.ship_date === tomorrow);
  const stops = allStops.filter((o) => inDay(o, day));
  const countFor = (k: DayKey) => allStops.filter((o) => inDay(o, k)).length;

  // สรุปของงานที่แสดงอยู่
  const done = stops.filter((o) => o.status === 'delivered').length;
  const pct = stops.length ? Math.round((done / stops.length) * 100) : 0;
  const boxes = stops.reduce((s, o) => s + o.box_count, 0);
  const codTotal = stops.reduce((s, o) => s + (o.status === 'delivered' ? 0 : o.cod_amount), 0);

  const stopsOfTrip = (t: Trip) => t.order_ids.length;
  const codOfTrip = (t: Trip) =>
    t.order_ids.reduce((s, id) => s + (orders.find((o) => o.id === id)?.cod_amount ?? 0), 0);

  const toggleItems = (id: number) =>
    setOpenItems((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const DAYS: Array<{ k: DayKey; label: string }> = [
    { k: 'today', label: 'วันนี้' },
    { k: 'tomorrow', label: 'พรุ่งนี้' },
    { k: 'all', label: 'ทุกวัน' },
  ];

  return (
    <div className="grid-2">
      {/* ซ้าย: เลือกเที่ยว/คนขับ */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>เลือกเที่ยว/คนขับ</h3>
            <div className="sub">คนขับเห็นเฉพาะงานเที่ยวของตัวเองบนมือถือ · เดโมเลือกเที่ยวได้</div>
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trips.length === 0 && <div className="loading">ยังไม่มีเที่ยวรถ — สร้างได้ที่หน้า “วางแผนจัดส่ง”</div>}
          {trips.map((t) => {
            const cod = codOfTrip(t);
            return (
              <button key={t.id} className={`trip-card${t.id === tripId ? ' active' : ''}`} onClick={() => setTripId(t.id)}>
                <div className="trip-ico"><IconTruck width={20} height={20} /></div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{tripLabel(t)}</div>
                  <div className="sub" style={{ color: t.id === tripId ? '#cbd5e1' : '#94a3b8' }}>
                    {drivers.find((d) => d.id === t.driver_id)?.vehicle ?? t.vehicle_type} · {t.zone_name ?? '—'}
                  </div>
                  <div className="sub" style={{ color: t.id === tripId ? '#cbd5e1' : '#94a3b8' }}>
                    {stopsOfTrip(t)} จุด{cod > 0 ? ` · เก็บเงิน ฿${cod.toLocaleString()}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ขวา: mockup มือถือ Driver */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-status">
              <span>{now}</span>
              <span>FleetFlow Driver</span>
              <span>●●●</span>
            </div>

            {!trip ? (
              <div className="loading">ยังไม่มีเที่ยว</div>
            ) : (
              <>
                <div className="phone-trip">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{tripLabel(trip)}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>{vehicle}{trip.zone_name ? ` · ${trip.zone_name}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{done}/{stops.length}</div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>ส่งแล้ว</div>
                    </div>
                  </div>
                  <div className="phone-prog"><div className="phone-prog-bar" style={{ width: `${pct}%` }} /></div>
                </div>

                {/* เลือกวัน */}
                <div className="phone-days">
                  {DAYS.map((d) => (
                    <button key={d.k} className={`phone-day${day === d.k ? ' active' : ''}`} onClick={() => setDay(d.k)}>
                      {d.label}<span className="phone-day-n">{countFor(d.k)}</span>
                    </button>
                  ))}
                </div>

                {/* สรุปงานวันนี้ */}
                <div className="phone-sum">
                  <span><b>{stops.length}</b> จุด</span>
                  <span><b>{boxes}</b> กล่อง</span>
                  <span className={codTotal > 0 ? 'cod-on' : ''}>เก็บเงิน <b>฿{codTotal.toLocaleString()}</b></span>
                </div>

                <div className="phone-stops">
                  {stops.map((o, i) => {
                    const finished = o.status === 'delivered' || o.status === 'partial' || o.status === 'failed';
                    const phone = extractPhone(o.delivery_location);
                    const late = slaOf(o).level === 'overdue';
                    const open = openItems.has(o.id);
                    return (
                      <div key={o.id} className={`stop${finished ? ' done' : ''}`}>
                        <div className="stop-num">{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                            {day === 'all' && <span className="stop-date-chip">🗓 {fmtDay(o.ship_date)}</span>}
                            {late && !finished && <span className="stop-late">⚠ เกินกำหนด</span>}
                            {o.cod_amount > 0 && <span className="stop-cod">💰 เก็บ ฿{o.cod_amount.toLocaleString()}</span>}
                          </div>
                          <div className="stop-addr">{o.delivery_location}</div>

                          <button className="stop-prod-btn" onClick={() => toggleItems(o.id)}>
                            <IconBox width={13} height={13} /> {o.box_count} กล่อง · {o.items.length} รายการ
                            <span className="stop-caret">{open ? '▲' : '▼'}</span>
                          </button>
                          {open && (
                            <div className="stop-items">
                              {o.items.map((it) => (
                                <div key={it.id} className="stop-item">
                                  <span className="si-name">{it.product_name}</span>
                                  <span className="si-qty">{it.qty} ชิ้น · {it.boxes} กล่อง</span>
                                  {it.note ? <span className="si-note">* {it.note}</span> : null}
                                </div>
                              ))}
                            </div>
                          )}

                          {!finished && (
                            <div className="stop-actions">
                              <button
                                className="stop-btn nav"
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.delivery_location || o.customer_name)}`, '_blank')}
                              >
                                <IconPin width={14} height={14} /> นำทาง
                              </button>
                              {phone && (
                                <a className="stop-btn call" href={`tel:${phone.replace(/\D/g, '')}`} title={`โทร ${phone}`}>
                                  📞 โทร
                                </a>
                              )}
                              <button className="stop-btn confirm" onClick={() => onOpenPod(o, trip)}>
                                <IconCheck width={14} height={14} /> บันทึกส่ง
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {stops.length === 0 && (
                    <div className="loading">
                      {allStops.length === 0 ? 'เที่ยวนี้ยังไม่มีจุดส่ง' : `ไม่มีงาน${day === 'today' ? 'วันนี้' : 'พรุ่งนี้'} — ลองดู “ทุกวัน”`}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
