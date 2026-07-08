import { useState } from 'react';
import type { Order, Driver, Trip } from '../lib/types';
import { StatusBadge } from '../components/badges';
import { IconTruck, IconPin, IconCheck } from '../components/icons';

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
  const trip = trips.find((t) => t.id === tripId) ?? trips[0];
  const driver = drivers.find((d) => d.id === trip?.driver_id);
  const stops = trip ? (trip.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[]) : [];
  const done = stops.filter((o) => o.status === 'delivered').length;
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const productSummary = (o: Order) => {
    const first = o.items[0]?.product_name ?? '';
    const extra = o.items.length > 1 ? ` +${o.items.length - 1} รายการ` : '';
    return `${o.box_count} กล่อง · ${first}${extra}`;
  };

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
          {trips.map((t) => (
            <button
              key={t.id}
              className={`trip-card${t.id === tripId ? ' active' : ''}`}
              onClick={() => setTripId(t.id)}
            >
              <div className="trip-ico"><IconTruck width={20} height={20} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>TR-{String(t.id).padStart(2, '0')} · {t.driver_name ? drivers.find((d) => d.id === t.driver_id)?.vehicle : '—'}</div>
                <div className="sub" style={{ color: t.id === tripId ? '#cbd5e1' : '#94a3b8' }}>
                  {t.driver_name ?? 'ไม่ระบุ'} · {t.zone_name}
                </div>
              </div>
            </button>
          ))}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>TR-{String(trip.id).padStart(2, '0')}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>{driver?.name} · {driver?.vehicle}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{done}/{stops.length}</div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>ส่งแล้ว</div>
                    </div>
                  </div>
                  <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>
                    ทุกวัน · {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>

                <div className="phone-stops">
                  {stops.map((o, i) => {
                    const finished = o.status === 'delivered' || o.status === 'partial' || o.status === 'failed';
                    return (
                      <div key={o.id} className={`stop${finished ? ' done' : ''}`}>
                        <div className="stop-num">{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div className="stop-addr">{o.delivery_location}</div>
                          <div className="stop-prod">{productSummary(o)}</div>
                          {!finished && (
                            <div className="stop-actions">
                              <button className="stop-btn nav">
                                <IconPin width={14} height={14} /> นำทาง
                              </button>
                              <button className="stop-btn confirm" onClick={() => onOpenPod(o, trip)}>
                                <IconCheck width={14} height={14} /> บันทึกส่ง
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {stops.length === 0 && <div className="loading">เที่ยวนี้ยังไม่มีจุดส่ง</div>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
