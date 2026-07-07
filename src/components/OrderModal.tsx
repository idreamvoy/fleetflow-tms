import { useState } from 'react';
import type { NewOrder, Zone, OrderStatus, CustomerType, ShippingMethod, Collection } from '../lib/types';
import { COLLECTIONS } from '../lib/types';
import { STATUS_LABEL } from './badges';

const STATUS_OPTS: OrderStatus[] = ['unspecified', 'ready', 'waiting_ship', 'delivered', 'failed', 'cod_waiting', 'cod_transferred', 'oem'];

export default function OrderModal({
  zones,
  onClose,
  onSave,
}: {
  zones: Zone[];
  onClose: () => void;
  onSave: (o: NewOrder) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    order_no: `SO-6907-${Math.floor(100 + Math.random() * 900)}`,
    customer_type: 'hotel' as CustomerType,
    customer_name: '',
    delivery_location: '',
    shipping_method: 'company' as ShippingMethod,
    zone_id: zones[0]?.id ?? 1,
    status: 'ready' as OrderStatus,
    cod_amount: 0,
    // item
    collection: 'Hotel Premium' as Collection,
    product_name: '',
    qty: 24,
    pieces_per_box: 6,
  });
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.customer_name.trim() || !f.product_name.trim()) return;
    setSaving(true);
    try {
      const order: NewOrder = {
        order_no: f.order_no,
        customer_type: f.customer_type,
        customer_name: f.customer_name,
        delivery_location: f.delivery_location,
        shipping_method: f.shipping_method,
        zone_id: f.zone_id,
        status: f.status,
        cod_amount: Number(f.cod_amount),
        items: [{ collection: f.collection, product_name: f.product_name, qty: Number(f.qty), pieces_per_box: Number(f.pieces_per_box) }],
      };
      await onSave(order);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>เพิ่มใบสั่งขาย</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label>เลขที่ใบสั่งงาน</label>
              <input value={f.order_no} onChange={(e) => set('order_no', e.target.value)} required />
            </div>
            <div className="field">
              <label>ประเภทลูกค้า</label>
              <select value={f.customer_type} onChange={(e) => set('customer_type', e.target.value)}>
                <option value="hotel">โรงแรม</option>
                <option value="hospital">โรงพยาบาล</option>
              </select>
            </div>
            <div className="field full">
              <label>ชื่อลูกค้า *</label>
              <input value={f.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="เช่น โรงแรมดุสิตธานี / รพ.บำรุงราษฎร์" required />
            </div>
            <div className="field full">
              <label>สถานที่ส่งสินค้า</label>
              <input value={f.delivery_location} onChange={(e) => set('delivery_location', e.target.value)} placeholder="ที่อยู่จัดส่ง" />
            </div>
            <div className="field">
              <label>วิธีขนส่ง</label>
              <select value={f.shipping_method} onChange={(e) => set('shipping_method', e.target.value)}>
                <option value="company">ขนส่งบริษัท</option>
                <option value="shipping">ขนส่ง</option>
              </select>
            </div>
            <div className="field">
              <label>โซนจัดส่ง</label>
              <select value={f.zone_id} onChange={(e) => set('zone_id', Number(e.target.value))}>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>สถานะ</label>
              <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s === 'oem' ? 'OEM' : STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>ยอด COD (บาท)</label>
              <input type="number" min={0} value={f.cod_amount} onChange={(e) => set('cod_amount', e.target.value)} />
            </div>

            <div className="field full" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <label style={{ fontWeight: 700, color: 'var(--text)' }}>รายการสินค้าแรก</label>
            </div>
            <div className="field">
              <label>Collection</label>
              <select value={f.collection} onChange={(e) => set('collection', e.target.value)}>
                {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>ชื่อสินค้า *</label>
              <input value={f.product_name} onChange={(e) => set('product_name', e.target.value)} placeholder="เช่น ผ้าปูที่นอน 6 ฟุต" required />
            </div>
            <div className="field">
              <label>จำนวน (ชิ้น)</label>
              <input type="number" min={1} value={f.qty} onChange={(e) => set('qty', e.target.value)} />
            </div>
            <div className="field">
              <label>ชิ้น/กล่อง</label>
              <input type="number" min={1} value={f.pieces_per_box} onChange={(e) => set('pieces_per_box', e.target.value)} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึกใบสั่งขาย'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
