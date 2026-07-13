import { useState } from 'react';
import type { Order, Zone } from '../lib/types';
import { STATUS_LABEL, STATUS_COLOR } from './badges';

const SHIP_LABEL: Record<string, string> = { company: 'ขนส่งบริษัท', shipping: 'ขนส่ง' };
const SHIP_ICON: Record<string, string> = { company: '🚚', shipping: '📦' };
const SHIP_ORDER = ['company', 'shipping'];

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
  const st = (s: string) => (STATUS_LABEL as Record<string, string>)[s] ?? s;
  const clr = (s: string) => (STATUS_COLOR as Record<string, string>)[s] ?? '#64748b';

  // สรุปตามสถานะ
  const statusMap = new Map<string, number>();
  orders.forEach((o) => statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1));
  const statusRows = [...statusMap.entries()].map(([k, v]) => ({ key: k, label: st(k), color: clr(k), count: v }));

  // สรุปตามโซน
  const zoneMap = new Map<number, number>();
  orders.forEach((o) => { const z = o.zone_id ?? 0; zoneMap.set(z, (zoneMap.get(z) ?? 0) + 1); });
  const zoneName = (id: number) => zones.find((z) => z.id === id)?.name ?? 'ไม่ระบุโซน';
  const zoneRows = [...zoneMap.entries()].map(([id, count]) => ({ name: zoneName(id), count }));

  // จัดกลุ่มตามวิธีขนส่ง
  const groups = SHIP_ORDER
    .map((method) => ({ method, list: orders.filter((o) => o.shipping_method === method) }))
    .filter((g) => g.list.length > 0);
  const groupBoxes = (list: Order[]) => list.reduce((s, o) => s + o.box_count, 0);

  // ---- ข้อความสรุปสำหรับส่งฝ่ายขาย (LINE / แชท) ----
  const buildText = () => {
    const lines: string[] = [];
    lines.push(`📦 สรุปงานจัดส่ง ${shortDate}`);
    lines.push(`รวม ${orders.length} ออเดอร์ · ${totalBoxes} กล่อง${totalCod ? ` · COD ฿${totalCod.toLocaleString()}` : ''}`);
    lines.push('');
    statusRows.forEach((s) => lines.push(`▪️ ${s.label}: ${s.count}`));
    if (zoneRows.length) lines.push('โซน: ' + zoneRows.map((z) => `${z.name} ${z.count}`).join(' · '));
    groups.forEach((g) => {
      lines.push('');
      lines.push(`━━ ${SHIP_ICON[g.method]} ${SHIP_LABEL[g.method]} (${g.list.length} ออเดอร์ · ${groupBoxes(g.list)} กล่อง) ━━`);
      g.list.forEach((o, i) => {
        lines.push(`${i + 1}. ${o.order_no} · ${o.customer_name} · ${st(o.status)}`);
        if (o.delivery_location) lines.push(`   📍 ${o.delivery_location}`);
        o.items.forEach((it) => {
          const note = it.note ? ` (${it.note})` : '';
          lines.push(`   - ${it.collection} ${it.product_name} · ${it.qty} ชิ้น · ${it.boxes} กล่อง${note}`);
        });
      });
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
      <div className="modal" style={{ maxWidth: 620 }}>
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

              {/* รายการ แยกตามวิธีขนส่ง + รายละเอียดสินค้า */}
              {groups.map((g) => (
                <div key={g.method}>
                  <div className="dsum-ship-head">
                    <span>{SHIP_ICON[g.method]} {SHIP_LABEL[g.method]}</span>
                    <span className="dsum-ship-nums">{g.list.length} ออเดอร์ · {groupBoxes(g.list)} กล่อง</span>
                  </div>
                  <div className="dsum-list">
                    {g.list.map((o, i) => (
                      <div key={o.id} className="dsum-order">
                        <div className="dsum-order-head">
                          <span className="dsum-idx">{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <code>{o.order_no}</code>
                              <span style={{ fontWeight: 600 }}>{o.customer_name}</span>
                            </div>
                            {o.delivery_location && <div className="sub" style={{ color: '#94a3b8' }}>📍 {o.delivery_location}</div>}
                          </div>
                          <span className="dsum-status" style={{ color: clr(o.status) }}>{st(o.status)}</span>
                        </div>
                        <div className="dsum-items">
                          {o.items.map((it) => (
                            <div key={it.id} className="dsum-item">
                              <span className="dsum-col">{it.collection}</span>
                              <span className="dsum-prod">{it.product_name}</span>
                              <span className="dsum-qty">{it.qty} ชิ้น · <b>{it.boxes}</b> กล่อง</span>
                              {it.note && <span className="dsum-note">* {it.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
