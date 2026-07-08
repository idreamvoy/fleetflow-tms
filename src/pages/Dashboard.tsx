import { useState } from 'react';
import type { Order, Zone } from '../lib/types';
import { computeStats, computeStatusBreakdown, computeZoneSummary } from '../lib/supabase';
import Donut from '../components/Donut';
import { IconBox, IconTruck, IconMoney, IconCheck, IconAlert, IconGrid, IconCalendar } from '../components/icons';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function Dashboard({ orders, zones }: { orders: Order[]; zones: Zone[] }) {
  const [view, setView] = useState<'summary' | 'calendar'>('summary');
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

  // ---- ข้อมูลปฏิทิน (ตามกำหนดจัดส่ง) ----
  const byDate = new Map<string, Order[]>();
  orders.forEach((o) => {
    if (!o.ship_date) return;
    byDate.set(o.ship_date, [...(byDate.get(o.ship_date) ?? []), o]);
  });
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const keyOf = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <>
      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${view === 'summary' ? ' active' : ''}`} onClick={() => setView('summary')}>
          <IconGrid width={16} height={16} /> สรุปภาพรวม
        </button>
        <button className={`tab${view === 'calendar' ? ' active' : ''}`} onClick={() => setView('calendar')}>
          <IconCalendar width={16} height={16} /> ปฏิทินจัดส่ง
        </button>
      </div>

      {view === 'summary' ? (
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
                <span className="sub">{today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                    <span className="zone-nums">{z.orderCount} ออเดอร์ · {z.boxCount} กล่อง</span>
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
      ) : (
        /* ---- ปฏิทินจัดส่ง ---- */
        <div className="card">
          <div className="card-header">
            <div>
              <h3>ปฏิทินจัดส่ง</h3>
              <div className="sub">Delivery calendar · ตามวันกำหนดจัดส่ง</div>
            </div>
            <span className="sub" style={{ fontWeight: 700, color: 'var(--text)' }}>
              {today.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="cal-pad">
            <div className="cal-grid cal-head">
              {WEEKDAYS.map((w) => <div key={w} className="cal-dow">{w}</div>)}
            </div>
            <div className="cal-grid">
              {cells.map((d, i) => {
                if (d === null) return <div key={`b${i}`} className="cal-cell empty" />;
                const list = byDate.get(keyOf(d)) ?? [];
                const boxes = list.reduce((s, o) => s + o.box_count, 0);
                const isToday = d === today.getDate();
                return (
                  <div key={d} className={`cal-cell${isToday ? ' today' : ''}${list.length ? ' has' : ''}`}>
                    <div className="cal-day">{d}</div>
                    {list.length > 0 && (
                      <div className="cal-info">
                        <span className="cal-badge">{list.length} ออเดอร์</span>
                        <span className="cal-boxes">{boxes} กล่อง</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
