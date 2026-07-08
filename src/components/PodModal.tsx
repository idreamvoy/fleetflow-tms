import { useMemo, useRef, useState } from 'react';
import type { Order, PodInput, OrderStatus, ItemDeliveryStatus } from '../lib/types';
import { StatusBadge } from './badges';
import { IconCheck, IconBox } from './icons';

// สถานะรายรายการจากจำนวนที่ส่งได้
function itemStatusOf(deliveredQty: number, qty: number): ItemDeliveryStatus {
  if (deliveredQty <= 0) return 'returned';
  if (deliveredQty >= qty) return 'delivered';
  return 'partial';
}

export default function PodModal({
  order,
  driverId,
  driverName,
  onClose,
  onSave,
}: {
  order: Order;
  driverId: number | null;
  driverName: string;
  onClose: () => void;
  onSave: (input: PodInput) => Promise<void>;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>(
    Object.fromEntries(order.items.map((it) => [it.id, it.qty]))
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [cod, setCod] = useState<number>(order.cod_amount);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasSig = useRef(false);
  const [sigDirty, setSigDirty] = useState(false);

  // สถานะรวม
  const { overall, totalQty, deliveredQty } = useMemo(() => {
    const totalQty = order.items.reduce((s, it) => s + it.qty, 0);
    const deliveredQty = order.items.reduce((s, it) => s + (qtys[it.id] ?? 0), 0);
    const overall: OrderStatus = deliveredQty <= 0 ? 'failed' : deliveredQty >= totalQty ? 'delivered' : 'partial';
    return { overall, totalQty, deliveredQty };
  }, [qtys, order.items]);

  // ---- signature canvas ----
  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function startDraw(e: React.PointerEvent) {
    drawing.current = true;
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const p = pos(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    c.setPointerCapture(e.pointerId);
  }
  function moveDraw(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasSig.current = true;
    if (!sigDirty) setSigDirty(true);
  }
  function endDraw() { drawing.current = false; }
  function clearSig() {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasSig.current = false;
    setSigDirty(false);
  }

  // ---- photo: ย่อขนาด → JPEG dataURL ----
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      setPhoto(cv.toDataURL('image/jpeg', 0.6));
    };
    img.src = URL.createObjectURL(file);
  }

  const setQty = (id: number, v: number, max: number) => setQtys((q) => ({ ...q, [id]: Math.max(0, Math.min(max, v || 0)) }));

  async function save() {
    setSaving(true);
    const signature_url = hasSig.current && canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
    try {
      await onSave({
        order,
        driver_id: driverId,
        driver_name: driverName,
        overall_status: overall,
        photo_url: photo,
        signature_url,
        cod_collected: cod,
        note,
        items: order.items.map((it) => ({
          item_id: it.id,
          delivered_qty: qtys[it.id] ?? 0,
          item_status: itemStatusOf(qtys[it.id] ?? 0, it.qty),
        })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal pod-modal">
        <div className="modal-head">
          <div>
            <h3>บันทึกการส่ง · <code>{order.order_no}</code></h3>
            <div className="sub">{order.customer_name} · {order.delivery_location}</div>
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* สถานะรวม */}
          <div className="pod-overall">
            <span>สถานะการส่ง:</span>
            <StatusBadge status={overall} />
            <span className="sub">ส่งได้ {deliveredQty.toLocaleString()} / {totalQty.toLocaleString()} ชิ้น</span>
          </div>

          {/* รายการสินค้า (partial) */}
          <div className="pod-section-title"><IconBox width={15} height={15} /> รายการสินค้า — ระบุจำนวนที่ส่งได้จริง</div>
          <div className="pod-items">
            {order.items.map((it) => {
              const dq = qtys[it.id] ?? 0;
              const st = itemStatusOf(dq, it.qty);
              return (
                <div className="pod-item" key={it.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                    <div className="sub">{it.collection} · เต็ม {it.qty.toLocaleString()} ชิ้น</div>
                  </div>
                  <div className="pod-qty">
                    <div className="pod-quick">
                      <button className={dq >= it.qty ? 'on' : ''} onClick={() => setQty(it.id, it.qty, it.qty)}>ครบ</button>
                      <button className={dq > 0 && dq < it.qty ? 'on' : ''} onClick={() => setQty(it.id, Math.floor(it.qty / 2), it.qty)}>ครึ่ง</button>
                      <button className={dq === 0 ? 'on danger' : ''} onClick={() => setQty(it.id, 0, it.qty)}>ตีกลับ</button>
                    </div>
                    <input type="number" min={0} max={it.qty} value={dq} onChange={(e) => setQty(it.id, parseInt(e.target.value), it.qty)} />
                    <span className={`pod-item-badge s-${st}`}>{st === 'delivered' ? 'ส่งครบ' : st === 'partial' ? 'บางส่วน' : 'ตีกลับ'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pod-grid">
            {/* ถ่ายรูป */}
            <div>
              <div className="pod-section-title">📷 รูปหน้างาน</div>
              {photo ? (
                <div className="pod-photo">
                  <img src={photo} alt="POD" />
                  <button className="btn btn-ghost xs" onClick={() => setPhoto(null)}>ถ่ายใหม่</button>
                </div>
              ) : (
                <label className="pod-upload">
                  <input type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
                  <span>📸 แตะเพื่อถ่าย/เลือกรูป</span>
                </label>
              )}
            </div>

            {/* ลายเซ็น */}
            <div>
              <div className="pod-section-title">✍️ ลายเซ็นผู้รับ</div>
              <div className="pod-sign">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerLeave={endDraw}
                />
                {!sigDirty && <span className="pod-sign-hint">ลากเพื่อเซ็น</span>}
                <button className="pod-sign-clear" onClick={clearSig}>ล้าง</button>
              </div>
            </div>
          </div>

          {/* COD */}
          {order.cod_amount > 0 && (
            <div className="pod-cod">
              <div className="pod-section-title">💵 เก็บเงินปลายทาง (COD)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="sub">ยอดเรียกเก็บ ฿{order.cod_amount.toLocaleString()} · เก็บได้จริง</span>
                <input type="number" min={0} value={cod} onChange={(e) => setCod(parseInt(e.target.value) || 0)} className="pod-cod-input" />
                <span>บาท</span>
                {cod < order.cod_amount && <span className="warn-tag zone">ขาด ฿{(order.cod_amount - cod).toLocaleString()}</span>}
              </div>
            </div>
          )}

          {/* หมายเหตุ */}
          <div className="pod-section-title">📝 หมายเหตุ</div>
          <textarea className="pod-note" rows={2} placeholder="เช่น ติดรถติด / ลูกค้าขอส่งใหม่ / ของเสียหาย" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <IconCheck width={16} height={16} /> {saving ? 'กำลังบันทึก…' : 'บันทึกการส่ง'}
          </button>
        </div>
      </div>
    </div>
  );
}
