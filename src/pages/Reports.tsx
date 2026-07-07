import type { Order, StatusMovement } from '../lib/types';
import { computeReport } from '../lib/supabase';
import { IconCheck, IconBox, IconDownload } from '../components/icons';

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

export default function Reports({ orders, movements }: { orders: Order[]; movements: StatusMovement[] }) {
  const r = computeReport(orders);

  return (
    <>
      {/* KPI */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#dcfce7', color: '#10b981' }}><IconCheck width={20} height={20} /></div>
          </div>
          <div className="kpi-label">อัตราส่งตรงเวลา</div>
          <div className="kpi-value">{r.onTimeRate}%</div>
          <div className="kpi-foot">On-time delivery rate</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBox width={20} height={20} /></div>
          </div>
          <div className="kpi-label">ส่งสำเร็จ / ทั้งหมด</div>
          <div className="kpi-value">{r.completed}/{r.totalOrders}</div>
          <div className="kpi-foot">Completed orders</div>
        </div>
      </div>

      <div className="grid-2">
        {/* สรุปตามสถานะ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>สรุปตามสถานะ</h3>
              <div className="sub">Status distribution</div>
            </div>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {r.statusDist.map((s) => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="legend-dot" style={{ background: s.color }} /> {s.label}
                  </span>
                  <span style={{ fontWeight: 700 }}>{s.count} · {s.pct}%</span>
                </div>
                <div className="zone-bar"><div style={{ width: `${s.pct}%`, background: s.color }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* บันทึกความเคลื่อนไหวสถานะ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>บันทึกความเคลื่อนไหวสถานะ</h3>
              <div className="sub">Status movement log · วันนี้</div>
            </div>
            <button className="btn btn-ghost" onClick={() => exportLog(movements)}>
              <IconDownload width={16} height={16} /> ส่งออก
            </button>
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
                    <div className="sub" style={{ color: '#94a3b8' }}>
                      {m.from_label} <span style={{ color: 'var(--indigo)' }}>→</span> {m.to_label} · โดย {m.by}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
