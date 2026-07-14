import type { Order, Trip, TripStatus } from '../lib/types';
import { TRIP_STATUS_LABEL } from '../lib/types';
import { IconTruck, IconPin } from '../components/icons';

const STATUS_CLASS: Record<TripStatus, string> = {
  in_progress: 't-running',
  assigned: 't-loading',
  planning: 't-waiting',
  completed: 't-done',
};

const shortZone = (name?: string | null) => {
  const n = name ?? '';
  if (/กทม|กรุงเทพ|ปริมณฑล/.test(n)) return 'กทม.';
  if (/ต่างประเทศ/.test(n)) return 'ต่างประเทศ';
  if (/ต่างจังหวัด|ตจว/.test(n)) return 'ต่างจังหวัด';
  return n || '—';
};

export default function Tracking({ trips, orders }: { trips: Trip[]; orders: Order[] }) {
  const running = trips.filter((t) => t.status === 'in_progress').length;
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const delivered = (t: Trip) =>
    t.order_ids.filter((id) => orders.find((o) => o.id === id)?.status === 'delivered').length;

  return (
    <>
      {/* แผนที่ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3>แผนที่เส้นทาง · Live Tracking</h3>
            <div className="sub">{running} คันกำลังวิ่ง · {now}</div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="map-panel">
            <div className="map-legend">
              <span><IconPin width={13} height={13} /> คลังหลัก</span>
              <span><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} /> กทม.</span>
              <span><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> ต่างจังหวัด</span>
            </div>
            <div style={{ color: 'var(--text-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <IconTruck width={40} height={40} />
              <div style={{ fontSize: 13 }}>แผนที่แบบประมาณ — ใส่ Google Maps API key ใน <code>.env.local</code> เพื่อแสดงถนนจริง</div>
            </div>
          </div>
        </div>
      </div>

      {/* สถานะรถทุกคัน */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>สถานะรถทุกคัน</h3>
            <div className="sub">Vehicle status · {trips.length} คัน</div>
          </div>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {trips.map((t) => (
            <div className="veh-card" key={t.id}>
              <div className="veh-head">
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  TR-{String(t.id).padStart(2, '0')}
                  <span className="zone-pill">{shortZone(t.zone_name)}</span>
                </div>
                <span className={`badge ${STATUS_CLASS[t.status]}`}>{TRIP_STATUS_LABEL[t.status]}</span>
              </div>
              <div className="sub" style={{ color: '#64748b' }}>
                {t.driver_name ?? 'ยังไม่ระบุคนขับ'} · {t.vehicle_type} · ส่งแล้ว {delivered(t)}/{t.order_ids.length} จุด
              </div>
              <div className="veh-prog"><div style={{ width: `${t.progress}%` }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="sub">คืบหน้า {t.progress}%</span>
                <span style={{ fontWeight: 600 }}>ETA {t.eta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
