import { useState } from 'react';
import type { Order, StatusMovement, Driver, Trip, StatusEvent } from '../lib/types';
import { computeReport, computePerformance, computeDeliveryOutcome } from '../lib/supabase';
import Donut from '../components/Donut';
import { IconCheck, IconBox, IconDownload, IconChart, IconTruck } from '../components/icons';

function exportLog(movements: StatusMovement[]) {
  const rows = [['เวลา', 'เลขที่ใบสั่ง', 'จาก', 'เป็น', 'โดย']];
  movements.forEach((m) => rows.push([m.time, m.order_no, m.from_label, m.to_label, m.by]));
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `status-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Reports({
  orders,
  movements,
  drivers,
  trips,
  history,
}: {
  orders: Order[];
  movements: StatusMovement[];
  drivers: Driver[];
  trips: Trip[];
  history: StatusEvent[];
}) {
  const [tab, setTab] = useState<'summary' | 'drivers'>('summary');
  const r = computeReport(orders);
  const perf = computePerformance(drivers, trips, orders, history);
  const outcome = computeDeliveryOutcome(orders);
  const outcomeTotal = outcome.reduce((s, o) => s + o.count, 0);
  const podRecords = history.filter((h) => h.status === 'delivered' || h.status === 'partial');
  const podCoverage = podRecords.length ? Math.round((podRecords.filter((h) => h.photo_url || h.signature_url).length / podRecords.length) * 100) : 0;
  const codTotal = history.reduce((s, h) => s + (h.cod_collected || 0), 0);

  return (
    <>
      <div className="tabs">
        <button className={`tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>
          <IconChart width={16} height={16} /> สรุปรายงาน
        </button>
        <button className={`tab${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
          <IconTruck width={16} height={16} /> ประสิทธิภาพคนขับ
        </button>
      </div>

      {tab === 'summary' ? (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div className="kpi">
              <div className="kpi-top"><div className="kpi-icon" style={{ background: '#dcfce7', color: '#10b981' }}><IconCheck width={20} height={20} /></div></div>
              <div className="kpi-label">อัตราส่งตรงเวลา</div>
              <div className="kpi-value">{r.onTimeRate}%</div>
              <div className="kpi-foot">On-time delivery rate</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><div className="kpi-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBox width={20} height={20} /></div></div>
              <div className="kpi-label">ส่งสำเร็จ / ทั้งหมด</div>
              <div className="kpi-value">{r.completed}/{r.totalOrders}</div>
              <div className="kpi-foot">Completed orders</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div><h3>สรุปตามสถานะ</h3><div className="sub">Status distribution</div></div></div>
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {r.statusDist.map((s) => (
                  <div key={s.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="legend-dot" style={{ background: s.color }} /> {s.label}</span>
                      <span style={{ fontWeight: 700 }}>{s.count} · {s.pct}%</span>
                    </div>
                    <div className="zone-bar"><div style={{ width: `${s.pct}%`, background: s.color }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div><h3>บันทึกความเคลื่อนไหวสถานะ</h3><div className="sub">Status movement log · วันนี้</div></div>
                <button className="btn btn-ghost" onClick={() => exportLog(movements)}><IconDownload width={16} height={16} /> ส่งออก</button>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {movements.length === 0 ? (
                  <div className="loading">ยังไม่มีความเคลื่อนไหว</div>
                ) : (
                  movements.map((m) => (
                    <div className="zone-row" key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 13, width: 44 }}>{m.time}</span>
                      <div style={{ flex: 1 }}>
                        <div><code>{m.order_no}</code></div>
                        <div className="sub" style={{ color: '#94a3b8' }}>{m.from_label} <span style={{ color: 'var(--indigo)' }}>→</span> {m.to_label} · โดย {m.by}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ผลการส่ง + POD coverage */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div><h3>ผลการส่งวันนี้</h3><div className="sub">Delivery outcome</div></div></div>
              <div className="donut-wrap">
                <Donut data={outcome} total={outcomeTotal} />
                <div className="donut-legend">
                  {outcome.map((o) => (
                    <div className="legend-row" key={o.key}>
                      <span className="legend-dot" style={{ background: o.color }} />
                      <span className="legend-label">{o.label}</span>
                      <span className="legend-count">{o.count} · {o.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div><h3>ตัวชี้วัดรวม</h3><div className="sub">POD & COD overview</div></div></div>
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="perf-metric">
                  <div><div className="pm-label">หลักฐาน POD ครบถ้วน</div><div className="pm-sub">มีรูป/ลายเซ็น</div></div>
                  <div className="pm-val" style={{ color: podCoverage >= 90 ? '#10b981' : podCoverage >= 70 ? '#f59e0b' : '#f43f5e' }}>{podCoverage}%</div>
                </div>
                <div className="zone-bar"><div style={{ width: `${podCoverage}%`, background: podCoverage >= 90 ? '#10b981' : '#f59e0b' }} /></div>
                <div className="perf-metric">
                  <div><div className="pm-label">COD เก็บได้รวม</div><div className="pm-sub">Cash collected today</div></div>
                  <div className="pm-val">฿{codTotal.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking คนขับ */}
          <div className="card">
            <div className="card-header"><div><h3>จัดอันดับคนขับ · เดือนนี้</h3><div className="sub">Driver performance ranking</div></div></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {perf.map((p, i) => (
                <div className="perf-card" key={p.driver_id}>
                  <div className="perf-rank">{MEDAL[i] ?? `#${i + 1}`}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.name} <span className="sub" style={{ fontWeight: 400 }}>· {p.vehicle ?? '—'}</span></div>
                    <div className="sub">{p.trips} เที่ยว · ส่งสำเร็จ {p.delivered}/{p.deliveries}{p.failed > 0 ? ` · ค้าง ${p.failed}` : ''}</div>
                    <div className="perf-bar"><div style={{ width: `${p.onTimeRate}%`, background: p.onTimeRate >= 90 ? '#10b981' : p.onTimeRate >= 75 ? '#f59e0b' : '#f43f5e' }} /></div>
                  </div>
                  <div className="perf-stats">
                    <div><span className="ps-num" style={{ color: p.onTimeRate >= 90 ? '#10b981' : p.onTimeRate >= 75 ? '#f59e0b' : '#f43f5e' }}>{p.onTimeRate}%</span><span className="ps-cap">สำเร็จ</span></div>
                    <div><span className="ps-num">{p.podRate}%</span><span className="ps-cap">POD</span></div>
                    <div><span className="ps-num">฿{(p.codCollected / 1000).toFixed(1)}k</span><span className="ps-cap">COD</span></div>
                  </div>
                </div>
              ))}
              {perf.length === 0 && <div className="loading">ยังไม่มีข้อมูลคนขับ</div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
