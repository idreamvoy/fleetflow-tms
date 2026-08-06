import type { Order, ItemReadiness } from '../lib/types';
import { orderReadiness, readinessOf, READINESS_LABEL, READINESS_ORDER } from '../lib/types';
import { StatusBadge } from './badges';
import { IconBox, IconPin, IconMoney, IconTruck } from './icons';

export default function OrderDetail({
  order,
  onClose,
  onSetItemReadiness,
}: {
  order: Order | null;
  onClose: () => void;
  onSetItemReadiness?: (orderId: number, itemId: number, readiness: ItemReadiness) => void;
}) {
  if (!order) return null;
  const totalQty = order.items.reduce((s, it) => s + it.qty, 0);
  const rd = orderReadiness(order.items);
  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <div className="drawer-code"><code>{order.order_no}</code></div>
            <h3 style={{ marginTop: 4 }}>{order.customer_name}</h3>
            <span className={`type-tag ${order.customer_type}`}>{order.customer_type === 'hotel' ? 'โรงแรม' : 'โรงพยาบาล'}</span>
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          <div className="detail-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={order.status} />
            <span className={`ready-badge ${rd.allReady ? 'all' : rd.noneReady ? 'none' : 'some'}`}>
              {rd.allReady ? '✓ พร้อมส่งครบ' : `พร้อม ${rd.ready}/${rd.total} รายการ`}
            </span>
          </div>

          <div className="detail-grid">
            <div className="detail-item"><span className="di-ico"><IconPin width={15} height={15} /></span>
              <div><div className="di-label">สถานที่ส่ง</div><div className="di-val">{order.delivery_location || '—'}</div></div>
            </div>
            <div className="detail-item"><span className="di-ico"><IconTruck width={15} height={15} /></span>
              <div><div className="di-label">วิธีขนส่ง · โซน</div><div className="di-val">{order.shipping_method === 'company' ? 'ขนส่งบริษัท' : 'ขนส่ง'} · {order.zone_name ?? (order.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด')}</div></div>
            </div>
            <div className="detail-item"><span className="di-ico"><IconBox width={15} height={15} /></span>
              <div><div className="di-label">รวมกล่อง</div><div className="di-val">{order.box_count} กล่อง · {totalQty.toLocaleString()} ชิ้น</div></div>
            </div>
            <div className="detail-item"><span className="di-ico"><IconMoney width={15} height={15} /></span>
              <div><div className="di-label">COD · กำหนดจัดส่ง</div><div className="di-val">{order.cod_amount ? `฿${order.cod_amount.toLocaleString()}` : 'ไม่มี COD'} · {order.ship_date ?? '—'}</div></div>
            </div>
          </div>

          <div className="detail-section-title">
            รายการสินค้า ({order.items.length})
            {onSetItemReadiness && <span className="sub" style={{ fontWeight: 400 }}> · เปลี่ยนสถานะความพร้อมได้ที่นี่</span>}
          </div>
          <div className="detail-items">
            {order.items.map((it) => {
              const rs = readinessOf(it);
              return (
                <div className={`detail-item-row${rs === 'ready' ? '' : ' item-making'}`} key={it.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="col-tag">{it.collection}</div>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                    {it.note ? <div className="sub" style={{ color: '#f59e0b' }}>* {it.note}</div> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700 }}>{it.boxes} กล่อง</div>
                      <div className="sub">{it.qty.toLocaleString()} ชิ้น · {it.pieces_per_box}/กล่อง</div>
                    </div>
                    {onSetItemReadiness ? (
                      <select
                        className={`readiness-select ${rs}`}
                        value={rs}
                        onChange={(e) => onSetItemReadiness(order.id, it.id, e.target.value as ItemReadiness)}
                      >
                        {READINESS_ORDER.map((s) => <option key={s} value={s}>{READINESS_LABEL[s]}</option>)}
                      </select>
                    ) : (
                      <span className={`readiness-select ${rs}`} style={{ pointerEvents: 'none' }}>{READINESS_LABEL[rs]}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
