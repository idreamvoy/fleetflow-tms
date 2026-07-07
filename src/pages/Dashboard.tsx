import type { Order, Zone } from '../lib/types';
import { computeStats, computeStatusBreakdown, computeZoneSummary } from '../lib/supabase';
import Donut from '../components/Donut';
import { IconBox, IconTruck, IconMoney, IconCheck, IconAlert } from '../components/icons';

export default function Dashboard({ orders, zones }: { orders: Order[]; zones: Zone[] }) {
  const stats = computeStats(orders);
  const breakdown = computeStatusBreakdown(orders);
  const zoneSummary = computeZoneSummary(orders, zones);
  const totalBoxes = stats.totalBoxes;
  const maxZoneOrders = Math.max(1, ...zoneSummary.map((z) => z.orderCount));

  const kpis = [
    { label: 'ออเดอร์วันนี้', value: stats.ordersToday, foot: 'เทียบเมื่อวาน', chip: '+12%', icon: IconBox, color: '#6366f1', bg: '#eef2ff' },
    { label: 'พร้อมส่ง', value: stats.readyToShip, foot: 'รอจัดรถ', icon: IconTruck, color: '#06b6d4', bg: '#cffafe' },
    { label: 'รอโอน', value: stats.codWaiting, foot: 'รอโอนเงิน', icon: IconMoney, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'โอนแล้ว', value: stats.codTransferred, foot: 'เสร็จสมบูรณ์', icon: IconCheck, color: '#10b981', bg: '#dcfce7' },
    { label: 'ค้างส่ง', value: stats.failed, foot: 'ต้องแก้ไข', icon: IconAlert, color: '#f43f5e', bg: '#ffe4e6' },
  ];

  return (
    <>
      {/* KPI cards */}
      <div className="kpi-grid">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div className="kpi" key={k.label}>
              <div className="kpi-top">
                <div className="kpi-icon" style={{ background: k.bg, color: k.color }}>
                  <Icon width={20} height={20} />
                </div>
                {k.chip ? <span className="kpi-chip chip-up">{k.chip}</span> : null}
              </div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-foot">{k.foot}</div>
            </div>
          );
        })}
      </div>

      {/* Donut + Zone split */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>สถานะการจัดส่งวันนี้</h3>
              <div className="sub">Delivery status breakdown</div>
            </div>
            <span className="sub">
              {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="donut-wrap">
            <Donut data={breakdown} total={stats.ordersToday} />
            <div className="donut-legend">
              {breakdown.map((b) => (
                <div className="legend-row" key={b.key}>
                  <span className="legend-dot" style={{ background: b.color }} />
                  <span className="legend-label">{b.label}</span>
                  <span className="legend-count">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>แบ่งโซนจัดส่ง</h3>
              <div className="sub">Zone split · กทม. vs ตจว.</div>
            </div>
          </div>
          {zoneSummary.map((z) => (
            <div className="zone-row" key={z.name}>
              <div className="zone-head">
                <span className="zone-name">{z.name}</span>
                <span className="zone-nums">
                  {z.orderCount} ออเดอร์ · {z.boxCount} กล่อง
                </span>
              </div>
              <div className="zone-bar">
                <div style={{ width: `${(z.orderCount / maxZoneOrders) * 100}%`, background: z.color }} />
              </div>
            </div>
          ))}
          <div className="zone-boxes">
            <div>
              <div className="sub">จำนวนกล่องรวมวันนี้</div>
              <div className="big">{totalBoxes.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="sub">กล่อง</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
