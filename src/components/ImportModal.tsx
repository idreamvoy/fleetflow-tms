import { useRef, useState } from 'react';
import type { NewOrder, Zone, ShippingMethod } from '../lib/types';
import { downloadOrderTemplate, parseOrdersFromExcel, parsePastedOrders, type ParseResult } from '../lib/orderExcel';
import { IconDownload } from './icons';

type Method = 'file' | 'paste';

export default function ImportModal({
  zones,
  onClose,
  onImport,
}: {
  zones: Zone[];
  onClose: () => void;
  onImport: (orders: NewOrder[]) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<Method>('paste');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [shipping, setShipping] = useState<ShippingMethod>('shipping');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const res = await parseOrdersFromExcel(file, zones);
      setResult(res);
    } catch (err) {
      setResult({ orders: [], errors: [`อ่านไฟล์ไม่สำเร็จ: ${(err as Error).message}`], rowCount: 0 });
    } finally {
      setParsing(false);
    }
  };

  const handlePaste = (text: string) => {
    setPasteText(text);
    if (!text.trim()) { setResult(null); return; }
    setResult(parsePastedOrders(text, zones, shipping));
  };
  const changeShipping = (m: ShippingMethod) => {
    setShipping(m);
    if (pasteText.trim()) setResult(parsePastedOrders(pasteText, zones, m));
  };

  const switchMethod = (m: Method) => { setMethod(m); setResult(null); setFileName(''); };

  const confirm = async () => {
    if (!result?.orders.length) return;
    setBusy(true);
    try {
      await onImport(result.orders);
    } finally {
      setBusy(false);
    }
  };

  const totalItems = result?.orders.reduce((s, o) => s + o.items.length, 0) ?? 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>นำเข้าออเดอร์</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* เลือกวิธี */}
          <div className="tabs">
            <button className={`tab${method === 'paste' ? ' active' : ''}`} onClick={() => switchMethod('paste')}>
              📋 วางจาก Excel (Copy ตรงจากไฟล์บริษัท)
            </button>
            <button className={`tab${method === 'file' ? ' active' : ''}`} onClick={() => switchMethod('file')}>
              📁 อัปโหลดไฟล์
            </button>
          </div>

          {method === 'paste' ? (
            <>
              <div className="imp-hint">
                เปิดไฟล์ Excel ของบริษัท → เลือกคลุมตั้งแต่คอลัมน์ <b>โรงแรม/รพ. (A) ถึง ที่อยู่ขนส่ง (I)</b> ทุกแถวของออเดอร์ที่ต้องการ → กด <b>Ctrl+C</b> แล้ววางในช่องนี้ · ระบบรวมที่อยู่หลายบรรทัดให้อัตโนมัติ
              </div>
              <div className="field">
                <label>วิธีจัดส่งเริ่มต้น <span className="sub" style={{ fontWeight: 400 }}>(ถ้าในข้อมูลมีหัวข้อ “ส่งสินค้าทาง…” ระบบจะใช้ตามนั้นแทน)</span></label>
                <div className="seg">
                  <button type="button" className={`seg-btn${shipping === 'shipping' ? ' active' : ''}`} onClick={() => changeShipping('shipping')}>ขนส่ง</button>
                  <button type="button" className={`seg-btn${shipping === 'company' ? ' active' : ''}`} onClick={() => changeShipping('company')}>ขนส่งบริษัท</button>
                </div>
              </div>
              <textarea
                className="imp-paste"
                value={pasteText}
                onChange={(e) => handlePaste(e.target.value)}
                placeholder="วางข้อมูลที่ Copy จาก Excel ที่นี่…"
                rows={7}
              />
            </>
          ) : (
            <>
              {/* ขั้นที่ 1: ดาวน์โหลด template FleetFlow (ทางเลือก) */}
              <div className="imp-step">
                <div className="imp-step-num">1</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>ดาวน์โหลด Template (ถ้ายังไม่มีไฟล์)</div>
                  <div className="sub" style={{ color: '#94a3b8' }}>รูปแบบเดียวกับ “ใบสรุปรายการและวันส่งสินค้า” ที่บริษัทใช้อยู่ · หรือใช้ไฟล์เดิมได้เลย</div>
                </div>
                <button className="btn btn-ghost" style={{ color: '#059669', borderColor: '#a7f3d0' }} onClick={() => downloadOrderTemplate(zones)}>
                  <IconDownload width={16} height={16} /> ดาวน์โหลด
                </button>
              </div>
              {/* ขั้นที่ 2: เลือกไฟล์ */}
              <div className="imp-step">
                <div className="imp-step-num">2</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>เลือกไฟล์ Excel</div>
                  <div className="sub" style={{ color: '#94a3b8' }}>{fileName || 'รองรับ .xlsx / .xls / .csv · ไฟล์บริษัทเดิมก็ได้'}</div>
                </div>
                <button className="btn btn-primary" disabled={parsing} onClick={() => fileRef.current?.click()}>
                  {parsing ? 'กำลังอ่าน…' : 'เลือกไฟล์'}
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
              </div>
            </>
          )}

          {/* ผลลัพธ์ preview */}
          {result && (
            <div className="imp-preview">
              <div className="imp-summary">
                <div><b style={{ fontSize: 20, color: 'var(--indigo)' }}>{result.orders.length}</b> ออเดอร์</div>
                <div><b style={{ fontSize: 20 }}>{totalItems}</b> รายการสินค้า</div>
                {result.errors.length > 0 && <div style={{ color: '#f59e0b' }}><b style={{ fontSize: 20 }}>{result.errors.length}</b> คำเตือน</div>}
              </div>

              {result.orders.length > 0 && (
                <div className="imp-list">
                  {result.orders.slice(0, 10).map((o) => (
                    <div key={o.order_no} className="imp-row">
                      <code>{o.order_no}</code>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name}</span>
                      <span className="zone-pill" style={{ fontSize: 11 }}>{o.shipping_method === 'company' ? 'ขนส่งบริษัท' : 'ขนส่ง'}</span>
                      <span className="sub">{o.items.length} รายการ</span>
                    </div>
                  ))}
                  {result.orders.length > 10 && <div className="sub" style={{ textAlign: 'center', padding: 4 }}>… และอีก {result.orders.length - 10} ออเดอร์</div>}
                </div>
              )}

              {result.errors.length > 0 && (
                <details className="imp-errors">
                  <summary>⚠️ คำเตือน {result.errors.length} รายการ (คลิกดู)</summary>
                  <div className="imp-err-list">
                    {result.errors.slice(0, 20).map((e, i) => <div key={i}>• {e}</div>)}
                    {result.errors.length > 20 && <div>… และอีก {result.errors.length - 20} รายการ</div>}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" disabled={!result?.orders.length || busy} onClick={confirm}>
            {busy ? 'กำลังนำเข้า…' : result?.orders.length ? `นำเข้า ${result.orders.length} ออเดอร์` : 'นำเข้า'}
          </button>
        </div>
      </div>
    </div>
  );
}
