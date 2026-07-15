import { useState } from 'react';
import type { NewOrder, NewOrderItem, Order, Zone, OrderStatus, ShippingMethod } from '../lib/types';
import { STATUS_LABEL } from './badges';
import { IconPlus } from './icons';

const STATUS_OPTS: OrderStatus[] = ['unspecified', 'ready', 'waiting_ship', 'delivered', 'failed', 'cod_waiting', 'cod_transferred', 'oem'];

type ItemRow = { collection: string; product_name: string; qty: number; pieces_per_box: number; note: string };
const blankItem = (): ItemRow => ({ collection: '', product_name: '', qty: 24, pieces_per_box: 6, note: '' });

export default function OrderModal({
  zones,
  order,
  onClose,
  onSave,
}: {
  zones: Zone[];
  order?: Order | null;
  onClose: () => void;
  onSave: (o: NewOrder) => Promise<void>;
}) {
  const isEdit = !!order;
  const custType = order?.customer_type ?? 'hotel'; // ตัดฟิลด์เลือกประเภทลูกค้าออก — ใช้ค่าเดิม/ค่าเริ่มต้น
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    order_no: order?.order_no ?? `SO-6907-${Math.floor(100 + Math.random() * 900)}`,
    customer_name: order?.customer_name ?? '',
    delivery_location: order?.delivery_location ?? '',
    shipping_method: (order?.shipping_method ?? 'company') as ShippingMethod,
    zone_id: order?.zone_id ?? zones[0]?.id ?? 1,
    status: (order?.status ?? 'ready') as OrderStatus,
    cod_amount: order?.cod_amount ?? 0,
    ship_date: order?.ship_date ?? '',
    order_date: order?.created_at ? order.created_at.slice(0, 10) : new Date().toLocaleDateString('sv-SE'),
  });
  const [items, setItems] = useState<ItemRow[]>(
    order && order.items.length
      ? order.items.map((it) => ({ collection: it.collection, product_name: it.product_name, qty: it.qty, pieces_per_box: it.pieces_per_box, note: it.note ?? '' }))
      : [blankItem()]
  );
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  const addItem = () => setItems((rows) => [...rows, blankItem()]);
  const removeItem = (i: number) => setItems((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : rows));
  const setItem = (i: number, k: keyof ItemRow, v: any) =>
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const boxesOf = (r: ItemRow) => Math.max(1, Math.ceil((Number(r.qty) || 0) / (Number(r.pieces_per_box) || 1)));
  const totalBoxes = items.reduce((s, r) => s + boxesOf(r), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.customer_name.trim() || items.some((r) => !r.product_name.trim())) return;
    setSaving(true);
    try {
      const payloadItems: NewOrderItem[] = items.map((r) => ({
        collection: r.collection,
        product_name: r.product_name,
        qty: Number(r.qty),
        pieces_per_box: Number(r.pieces_per_box),
        note: r.note,
      }));
      const order: NewOrder = {
        order_no: f.order_no,
        customer_type: custType, // ค่าเริ่มต้น (ตัดฟิลด์เลือกออกแล้ว)
        customer_name: f.customer_name,
        delivery_location: f.delivery_location,
        shipping_method: f.shipping_method,
        zone_id: f.zone_id,
        status: f.status,
        cod_amount: Number(f.cod_amount),
        ship_date: f.ship_date || undefined, // ระบุหรือไม่ระบุก็ได้
        order_date: f.order_date || undefined, // วันที่สร้างใบสั่งงาน (ดู SLA)
        items: payloadItems,
      };
      await onSave(order);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>{isEdit ? `แก้ไขใบสั่งขาย · ${order!.order_no}` : 'เพิ่มใบสั่งขาย'}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label>เลขที่ใบสั่งงาน</label>
              <input value={f.order_no} onChange={(e) => set('order_no', e.target.value)} required />
            </div>
            <div className="field">
              <label>วันที่สร้างใบสั่งงาน <span className="sub" style={{ fontWeight: 400 }}>(ใช้ดู SLA)</span></label>
              <input type="date" value={f.order_date} onChange={(e) => set('order_date', e.target.value)} />
            </div>
            <div className="field">
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
            <div className="field">
              <label>กำหนดจัดส่ง <span className="sub" style={{ fontWeight: 400 }}>(ไม่ระบุก็ได้)</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="date" value={f.ship_date} onChange={(e) => set('ship_date', e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost xs" onClick={() => set('ship_date', new Date().toLocaleDateString('sv-SE'))} title="ตั้งเป็นวันนี้">วันนี้</button>
                {f.ship_date && <button type="button" className="btn btn-ghost xs" onClick={() => set('ship_date', '')} title="ล้างวันที่">×</button>}
              </div>
            </div>
          </div>

          {/* รายการสินค้า (หลายรายการได้) */}
          <div className="items-head">
            <span>รายการสินค้า ({items.length})</span>
            <span className="sub">รวม {totalBoxes} กล่อง</span>
          </div>
          <div className="items-list">
            {items.map((r, i) => (
              <div className="item-row" key={i}>
                <div className="item-grid">
                  <div className="field">
                    <label>กลุ่มสินค้า</label>
                    <input value={r.collection} onChange={(e) => setItem(i, 'collection', e.target.value)} placeholder="เช่น Hotel Premium" />
                  </div>
                  <div className="field">
                    <label>ชื่อสินค้า *</label>
                    <input value={r.product_name} onChange={(e) => setItem(i, 'product_name', e.target.value)} placeholder="เช่น ผ้าปูที่นอน 6 ฟุต" required />
                  </div>
                  <div className="field">
                    <label>จำนวน</label>
                    <input type="number" min={1} value={r.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>ชิ้น/กล่อง</label>
                    <input type="number" min={1} value={r.pieces_per_box} onChange={(e) => setItem(i, 'pieces_per_box', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>กล่อง</label>
                    <input value={boxesOf(r)} disabled className="box-readonly" />
                  </div>
                  <div className="field">
                    <label>หมายเหตุ</label>
                    <input value={r.note} onChange={(e) => setItem(i, 'note', e.target.value)} placeholder="เช่น ด่วน" />
                  </div>
                </div>
                <button type="button" className="item-remove" onClick={() => removeItem(i)} disabled={items.length === 1} title="ลบรายการ">×</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost add-item-btn" onClick={addItem}>
            <IconPlus /> เพิ่มรายการสินค้า
          </button>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : isEdit ? `บันทึกการแก้ไข (${items.length} รายการ)` : `บันทึกใบสั่งขาย (${items.length} รายการ)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
