import type { Order } from '../lib/types';
import { StatusBadge } from './badges';
import { IconBox, IconPin, IconMoney, IconTruck } from './icons';

export default function OrderDetail({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null;
  const totalQty = order.items.reduce((s, it) => s + it.qty, 0);
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
          <div className="detail-row"><StatusBadge status={order.status} /></div>

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

          <div className="detail-section-title">รายการสินค้า ({order.items.length})</div>
          <div className="detail-items">
            {order.items.map((it) => (
              <div className="detail-item-row" key={it.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="col-tag">{it.collection}</div>
                  <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                  {it.note ? <div className="sub" style={{ color: '#f59e0b' }}>* {it.note}</div> : null}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 700 }}>{it.boxes} กล่อง</div>
                  <div className="sub">{it.qty.toLocaleString()} ชิ้น · {it.pieces_per_box}/กล่อง</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
