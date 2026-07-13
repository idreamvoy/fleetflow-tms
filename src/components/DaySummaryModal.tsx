import { useState } from 'react';
import type { Order, Zone } from '../lib/types';
import { STATUS_LABEL, STATUS_COLOR } from './badges';

export default function DaySummaryModal({
  dateKey,
  orders,
  zones,
  onClose,
}: {
  dateKey: string;
  orders: Order[];
  zones: Zone[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const d = new Date(dateKey);
  const dateLabel = d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  const totalBoxes = orders.reduce((s, o) => s + o.box_count, 0);
  const totalCod = orders.reduce((s, o) => s + o.cod_amount, 0);
  const delivered = orders.filter((o) => o.status === 'delivered').length;

  // สรุปตามสถานะ
  const statusMap = new Map<string, number>();
  orders.forEach((o) => statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1));
  const statusRows = [...statusMap.entries()].map(([k, v]) => ({
    key: k,
    label: (STATUS_LABEL as Record<string, string>)[k] ?? k,
    color: (STATUS_COLOR as Record<string, string>)[k] ?? '#94a3b8',
    count: v,
  }));

  // สรุปตามโซน
  const zoneMap = new Map<number, number>();
  orders.forEach((o) => { const z = o.zone_id ?? 0; zoneMap.set(z, (zoneMap.get(z) ?? 0) + 1); });
  const zoneName = (id: number) => zones.find((z) => z.id === id)?.name ?? 'ไม่ระบุโซน';
  const zoneRows = [...zoneMap.entries()].map(([id, count]) => ({ name: zoneName(id), count }));

  const st = (s: string) => (STATUS_LABEL as Record<string, string>)[s] ?? s;

  // ---- ข้อความสรุปสำหรับส่งฝ่ายขาย (LINE / แชท) ----
  const buildText = () => {
    const lines: string[] = [];
    lines.push(`📦 สรุปงานจัดส่ง ${shortDate}`);
    lines.push(`รวม ${orders.length} ออเดอร์ · ${totalBoxes} กล่อง${totalCod ? ` · COD ฿${totalCod.toLocaleString()}` : ''}`);
    lines.push('');
    statusRows.forEach((s) => lines.push(`▪️ ${s.label}: ${s.count}`));
    if (zoneRows.length) {
      lines.push('');
      lines.push('โซน: ' + zoneRows.map((z) => `${z.name} ${z.count}`).join(' · '));
    }
    lines.push('');
    lines.push('รายการ:');
    orders.forEach((o, i) => {
      lines.push(`${i + 1}. ${o.order_no} · ${o.customer_name} · ${o.box_count} กล่อง · ${st(o.status)}`);
    });
    return lines.join('\n');
  };

  const copy = async () => {
    const text = buildText();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // fallback: textarea + execCommand (สำหรับเบราว์เซอร์/บริบทที่ clipboard API ถูกบล็อก)
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0 }}>สรุปงานจัดส่ง</h3>
            <div className="sub" style={{ color: '#94a3b8' }}>{dateLabel}</div>
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orders.length === 0 ? (
            <div className="loading">ไม่มีงานจัดส่งในวันนี้</div>
          ) : (
            <>
              {/* สถิติรวม */}
              <div className="dsum-stats">
                <div className="dsum-stat"><div className="dsum-val">{orders.length}</div><div className="dsum-lab">ออเดอร์</div></div>
                <div className="dsum-stat"><div className="dsum-val">{totalBoxes}</div><div className="dsum-lab">กล่อง</div></div>
                <div className="dsum-stat"><div className="dsum-val">{delivered}/{orders.length}</div><div className="dsum-lab">ส่งสำเร็จ</div></div>
                <div className="dsum-stat"><div className="dsum-val">฿{totalCod.toLocaleString()}</div><div className="dsum-lab">COD รวม</div></div>
              </div>

              {/* สถานะ + โซน */}
              <div className="dsum-tags">
                {statusRows.map((s) => (
                  <span key={s.key} className="dsum-tag">
                    <span className="dsum-dot" style={{ background: s.color }} />
                    {s.label} <b>{s.count}</b>
                  </span>
                ))}
              </div>
              {zoneRows.length > 0 && (
                <div className="dsum-zones">
                  {zoneRows.map((z) => <span key={z.name}>📍 {z.name} <b>{z.count}</b></span>)}
                </div>
              )}

              {/* รายการออเดอร์ */}
              <div className="dsum-list">
                {orders.map((o, i) => (
                  <div key={o.id} className="dsum-row">
                    <span className="dsum-idx">{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code>{o.order_no}</code>
                        <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
                      </div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location || '—'} · {o.box_count} กล่อง</div>
                    </div>
                    <span className="dsum-status" style={{ color: (STATUS_COLOR as Record<string, string>)[o.status] ?? '#64748b' }}>
                      {st(o.status)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>ปิด</button>
          {orders.length > 0 && (
            <button className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} onClick={copy}>
              {copied ? '✓ คัดลอกแล้ว — วางใน LINE ได้เลย' : '📋 คัดลอกสรุป (ส่งฝ่ายขาย)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
