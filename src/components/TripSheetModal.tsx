import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Order, Trip } from '../lib/types';
import { readinessOf, READINESS_LABEL } from '../lib/types';

// ============================================================
// ใบเช็คลิสต์ขึ้นรถ / รายงานประจำวัน (สั่งพิมพ์ → บันทึกเป็น PDF ได้)
//   - แยก 1 หน้า ต่อ 1 คนขับ (เที่ยวรถ) เพื่อให้ฉีกแจกก่อนขึ้นรถได้
//   - มีช่องติ๊กรายกล่อง + ช่องเซ็นชื่อ สำหรับเช็คของจริงหน้าคลัง
//   - ใช้ระบบ print ของเบราว์เซอร์ (รองรับภาษาไทยเต็มที่ ไม่ต้องฝังฟอนต์)
// ============================================================

const fmtFull = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function TripSheetModal({
  dateKey,
  trips,
  orders,
  onClose,
}: {
  dateKey: string;          // วันจัดส่งที่ออกรายงาน
  trips: Trip[];            // เที่ยวรถของวันนั้น
  orders: Order[];
  onClose: () => void;
}) {
  const sheets = useMemo(
    () =>
      trips.map((t) => {
        const stops = t.order_ids
          .map((id) => orders.find((o) => o.id === id))
          .filter((o): o is Order => !!o && o.status !== 'delivered');
        return {
          trip: t,
          stops,
          boxes: stops.reduce((s, o) => s + o.box_count, 0),
          cod: stops.reduce((s, o) => s + o.cod_amount, 0),
        };
      }),
    [trips, orders]
  );

  const totalStops = sheets.reduce((s, x) => s + x.stops.length, 0);
  const totalBoxes = sheets.reduce((s, x) => s + x.boxes, 0);
  const totalCod = sheets.reduce((s, x) => s + x.cod, 0);
  const printedAt = new Date().toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  // เรนเดอร์นอก #root — เพราะ .app มี height:100vh + overflow:hidden ถ้าอยู่ข้างในจะโดนตัดตอนสั่งพิมพ์ (ได้หน้าว่าง)
  return createPortal(
    <div className="overlay sheet-portal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sheet-modal">
        {/* แถบเครื่องมือ — ไม่ถูกพิมพ์ลงกระดาษ */}
        <div className="modal-head no-print">
          <div>
            <h3>ใบเช็คลิสต์ขึ้นรถ · {fmtFull(dateKey)}</h3>
            <div className="sub">
              {sheets.length} คนขับ · {totalStops} จุดส่ง · {totalBoxes} กล่อง
              {totalCod > 0 ? ` · COD ฿${totalCod.toLocaleString()}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ พิมพ์ / บันทึก PDF</button>
            <button className="close-x" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="sheet-hint no-print">
          💡 กด “พิมพ์ / บันทึก PDF” → ในหน้าต่างพิมพ์เลือกปลายทางเป็น <b>Save as PDF / บันทึกเป็น PDF</b> เพื่อได้ไฟล์แนบเมล ·
          ระบบแยกหน้าให้คนขับละ 1 แผ่นอัตโนมัติ
        </div>

        <div className="sheet-scroll">
          {sheets.length === 0 && <div className="loading">วันนี้ยังไม่มีเที่ยวรถ</div>}

          {sheets.map(({ trip, stops, boxes, cod }) => (
            <section className="sheet" key={trip.id}>
              {/* หัวกระดาษ */}
              <header className="sheet-head">
                <div>
                  <div className="sheet-title">ใบเช็คลิสต์ขึ้นรถ · FleetFlow TMS</div>
                  <div className="sheet-date">{fmtFull(dateKey)}</div>
                </div>
                <div className="sheet-driver">
                  <div className="sheet-driver-name">{trip.driver_name ?? 'ยังไม่ระบุคนขับ'}</div>
                  <div className="sheet-driver-sub">{trip.vehicle_type}{trip.zone_name ? ` · ${trip.zone_name}` : ''}</div>
                </div>
              </header>

              {/* สรุปยอดของเที่ยวนี้ */}
              <div className="sheet-summary">
                <span><b>{stops.length}</b> จุดส่ง</span>
                <span><b>{boxes}</b> กล่อง</span>
                <span>ความจุ <b>{boxes}/{trip.capacity_boxes}</b></span>
                <span>COD <b>฿{cod.toLocaleString()}</b></span>
              </div>

              {/* ตารางของที่ต้องขึ้นรถ */}
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: 26 }}>#</th>
                    <th>ลูกค้า / ที่อยู่</th>
                    <th style={{ width: 210 }}>รายการสินค้า</th>
                    <th style={{ width: 42 }}>กล่อง</th>
                    <th style={{ width: 62 }}>COD</th>
                    <th style={{ width: 34 }}>เช็ค</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 14 }}>ยังไม่มีจุดส่งในเที่ยวนี้</td></tr>
                  ) : (
                    stops.map((o, i) => (
                      <tr key={o.id}>
                        <td className="c">{i + 1}</td>
                        <td>
                          <div className="s-cust">{o.customer_name}</div>
                          <div className="s-addr">{o.delivery_location || '—'}</div>
                          <div className="s-meta">
                            {o.order_no}
                            {o.note ? <span className="s-note"> · 📝 {o.note}</span> : null}
                          </div>
                        </td>
                        <td>
                          {o.items.map((it) => (
                            <div className="s-item" key={it.id}>
                              <span>{it.product_name}</span>
                              <span className="s-qty">
                                {it.qty} ชิ้น · {it.boxes} กล่อง
                                {readinessOf(it) !== 'ready' ? ` · ⚠ ${READINESS_LABEL[readinessOf(it)]}` : ''}
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="c b">{o.box_count}</td>
                        <td className="c">{o.cod_amount ? `฿${o.cod_amount.toLocaleString()}` : '—'}</td>
                        <td className="c"><span className="s-box" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* ลายเซ็นก่อนออกรถ */}
              <footer className="sheet-foot">
                <div className="s-sign">
                  <div className="s-line" />
                  <div>ผู้จัดของ / คลังสินค้า</div>
                </div>
                <div className="s-sign">
                  <div className="s-line" />
                  <div>คนขับ ({trip.driver_name ?? '—'})</div>
                </div>
                <div className="s-sign">
                  <div className="s-line" />
                  <div>ผู้ตรวจสอบ</div>
                </div>
                <div className="s-printed">พิมพ์เมื่อ {printedAt}</div>
              </footer>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
