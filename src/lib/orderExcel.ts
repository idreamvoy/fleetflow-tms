// ============================================================
// FleetFlow TMS — นำเข้า/ส่งออกออเดอร์ผ่าน Excel (SheetJS)
// รูปแบบ: 1 แถว = 1 รายการสินค้า · แถวที่ "เลขที่ใบสั่งงาน" ซ้ำกัน = ออเดอร์เดียวกัน
// ============================================================
import * as XLSX from 'xlsx';
import type { NewOrder, NewOrderItem, Zone, ShippingMethod, OrderStatus, CustomerType } from './types';
import { COLLECTIONS } from './types';
import { STATUS_LABEL } from '../components/badges';

// ---------- หัวคอลัมน์ (ต้องตรงกับ template) ----------
const COLS = {
  order_no: 'เลขที่ใบสั่งงาน *',
  customer_name: 'ชื่อลูกค้า *',
  delivery_location: 'สถานที่ส่ง',
  shipping_method: 'วิธีจัดส่ง',
  zone: 'โซน',
  status: 'สถานะ',
  cod_amount: 'ยอด COD (บาท)',
  ship_date: 'กำหนดจัดส่ง (ปปปป-ดด-วว)',
  collection: 'กลุ่มสินค้า',
  product_name: 'ชื่อสินค้า *',
  qty: 'จำนวน (ชิ้น) *',
  pieces_per_box: 'ชิ้น/กล่อง *',
  note: 'หมายเหตุ',
} as const;
const HEADERS = Object.values(COLS);

// ---------- reverse maps (ไทย → key) ----------
const SHIPPING_MAP: Record<string, ShippingMethod> = { 'ขนส่งบริษัท': 'company', 'ขนส่ง': 'shipping', company: 'company', shipping: 'shipping' };
const STATUS_MAP: Record<string, OrderStatus> = Object.entries(STATUS_LABEL).reduce(
  (m, [key, label]) => { m[label] = key as OrderStatus; m[key] = key as OrderStatus; return m; },
  {} as Record<string, OrderStatus>
);

// ---------- ตัวช่วย ----------
const s = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number => { const n = Number(String(v).replace(/[, ]/g, '')); return isNaN(n) ? 0 : n; };

// ---------- วันที่แบบหลวม (30-Jun / 6-Jul / 7/6 / 2026-07-15) ----------
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function isDateLike(v: string): boolean {
  const t = v.trim();
  return /^\d{1,2}[-/ ][A-Za-z]{3,}/.test(t) || /^[A-Za-z]{3,}[-/ ]\d{1,2}/.test(t) || /^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t);
}
function parseLooseDate(v: string, fallbackYear: number): string {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  let m = t.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})(?:[-/ ](\d{2,4}))?/);
  let day = 0, mon = 0, yr = fallbackYear;
  if (m) { day = +m[1]; mon = MONTHS[m[2].slice(0, 3).toLowerCase()] || 0; if (m[3]) yr = +m[3]; }
  else if ((m = t.match(/^([A-Za-z]{3,})[-/ ](\d{1,2})(?:[-/ ](\d{2,4}))?/))) { mon = MONTHS[m[1].slice(0, 3).toLowerCase()] || 0; day = +m[2]; if (m[3]) yr = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/))) { day = +m[1]; mon = +m[2]; if (m[3]) yr = +m[3]; }
  if (!mon || !day) return '';
  if (yr < 100) yr += 2000;
  if (yr > 2500) yr -= 543; // เผื่อ พ.ศ.
  return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// เดาโซนจากที่อยู่ (template บริษัทไม่มีคอลัมน์โซน)
function inferZone(address: string, zones: Zone[]): number | null {
  const bkk = zones.find((z) => /กทม|กรุงเทพ|ปริมณฑล/.test(z.name));
  const upc = zones.find((z) => /ต่างจังหวัด/.test(z.name));
  if (/กทม|กรุงเทพ|ปริมณฑล|นนทบุรี|ปทุมธานี|สมุทรปราการ|สมุทรสาคร/.test(address)) return bkk?.id ?? zones[0]?.id ?? null;
  if (/จ\.|จังหวัด/.test(address)) return upc?.id ?? zones[0]?.id ?? null;
  return zones[0]?.id ?? null;
}

// แปลง serial-date ของ Excel หรือ string → 'YYYY-MM-DD'
function normDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const str = s(v);
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
}

function matchZoneId(label: string, zones: Zone[]): number | null {
  const t = label.trim();
  if (!t) return zones[0]?.id ?? null;
  const exact = zones.find((z) => z.name === t);
  if (exact) return exact.id;
  if (/กทม|กรุงเทพ|ปริมณฑล/.test(t)) return zones.find((z) => /กทม|กรุงเทพ|ปริมณฑล/.test(z.name))?.id ?? zones[0]?.id ?? null;
  if (/ต่างจังหวัด|ตจว/.test(t)) return zones.find((z) => /ต่างจังหวัด/.test(z.name))?.id ?? zones[1]?.id ?? null;
  const partial = zones.find((z) => z.name.includes(t) || t.includes(z.name));
  return partial?.id ?? zones[0]?.id ?? null;
}

// ============================================================
// 1) ดาวน์โหลด Template
// ============================================================
export function downloadOrderTemplate(zones: Zone[]) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: ออเดอร์ (หัว + ตัวอย่าง 3 แถว = 2 ออเดอร์) ---
  const example: Record<string, string | number>[] = [
    { [COLS.order_no]: 'SO-6907-101', [COLS.customer_name]: 'โรงแรมตัวอย่าง', [COLS.delivery_location]: 'ปทุมวัน กทม.', [COLS.shipping_method]: 'ขนส่งบริษัท', [COLS.zone]: 'กทม.', [COLS.status]: 'พร้อมส่ง', [COLS.cod_amount]: 0, [COLS.ship_date]: '2026-07-15', [COLS.collection]: 'Hotel Premium', [COLS.product_name]: 'ผ้าปูที่นอน 6 ฟุต', [COLS.qty]: 240, [COLS.pieces_per_box]: 6, [COLS.note]: '' },
    { [COLS.order_no]: 'SO-6907-101', [COLS.customer_name]: 'โรงแรมตัวอย่าง', [COLS.delivery_location]: 'ปทุมวัน กทม.', [COLS.shipping_method]: 'ขนส่งบริษัท', [COLS.zone]: 'กทม.', [COLS.status]: 'พร้อมส่ง', [COLS.cod_amount]: 0, [COLS.ship_date]: '2026-07-15', [COLS.collection]: 'Spa & Bath', [COLS.product_name]: 'ผ้าเช็ดตัว 27x54', [COLS.qty]: 40, [COLS.pieces_per_box]: 10, [COLS.note]: 'ด่วน' },
    { [COLS.order_no]: 'SO-6907-102', [COLS.customer_name]: 'รพ.ตัวอย่าง', [COLS.delivery_location]: 'อ.เมือง ชลบุรี', [COLS.shipping_method]: 'ขนส่ง', [COLS.zone]: 'ต่างจังหวัด', [COLS.status]: 'รอโอน', [COLS.cod_amount]: 4200, [COLS.ship_date]: '', [COLS.collection]: 'Medical Care', [COLS.product_name]: 'ชุดผู้ป่วย ไซส์ L', [COLS.qty]: 120, [COLS.pieces_per_box]: 6, [COLS.note]: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(example, { header: HEADERS });
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'ออเดอร์');

  // --- Sheet 2: คู่มือ / ตัวเลือกที่ใช้ได้ ---
  const guide: (string | number)[][] = [
    ['📋 วิธีใช้ Template นำเข้าออเดอร์'],
    [''],
    ['1. กรอกข้อมูลในชีต "ออเดอร์" — 1 แถว = 1 รายการสินค้า'],
    ['2. ถ้าออเดอร์เดียวมีหลายสินค้า → ใส่ "เลขที่ใบสั่งงาน" เดียวกันในทุกแถว (กรอกหัวออเดอร์ซ้ำได้)'],
    ['3. คอลัมน์ที่มี * = จำเป็นต้องกรอก'],
    ['4. ลบ 3 แถวตัวอย่างออกก่อนกรอกจริง (หรือกรอกทับได้เลย)'],
    ['5. บันทึกไฟล์ แล้วกด "เลือกไฟล์ Excel" ในระบบเพื่อนำเข้า'],
    [''],
    ['── ค่าที่ใช้ได้ในแต่ละคอลัมน์ ──'],
    [''],
    ['วิธีจัดส่ง', 'ขนส่งบริษัท, ขนส่ง'],
    ['โซน', zones.map((z) => z.name).join(', ') || 'กทม., ต่างจังหวัด'],
    ['สถานะ', Object.values(STATUS_LABEL).join(', ')],
    ['กลุ่มสินค้า', 'คีย์เองได้ตามต้องการ · ตัวอย่าง: ' + COLLECTIONS.join(', ')],
    ['กำหนดจัดส่ง', 'รูปแบบ ปปปป-ดด-วว เช่น 2026-07-15 · เว้นว่างได้ (ไม่ระบุ)'],
    ['จำนวน / ชิ้นต่อกล่อง', 'ตัวเลขเท่านั้น · ระบบจะคำนวณจำนวนกล่องให้อัตโนมัติ'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 26 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'คู่มือ');

  XLSX.writeFile(wb, `FleetFlow-Template-ออเดอร์-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================
// 2) อ่านไฟล์ที่กรอกแล้ว → NewOrder[]
// ============================================================
export interface ParseResult {
  orders: NewOrder[];
  errors: string[]; // ข้อความเตือนรายแถว
  rowCount: number;
}

export async function parseOrdersFromExcel(file: File, zones: Zone[]): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets['ออเดอร์'] ?? wb.Sheets[wb.SheetNames[0]];

  // อ่านเป็นตาราง 2 มิติก่อน เพื่อตรวจว่าเป็น template บริษัท (แบบ 1 ออเดอร์หลายแถว) หรือ template FleetFlow
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true });
  if (looksLikeCompanyTemplate(grid)) return parseCompanyGrid(grid, zones);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return parseFleetflowRows(rows, zones);
}

// ---------- รูปแบบ FleetFlow (1 แถว = 1 รายการ, มีหัวคอลัมน์) ----------
function parseFleetflowRows(rows: Record<string, unknown>[], zones: Zone[]): ParseResult {
  const errors: string[] = [];
  const grouped = new Map<string, NewOrder>();

  rows.forEach((row, i) => {
    const line = i + 2; // +1 header, +1 index0
    const order_no = s(row[COLS.order_no]);
    const product_name = s(row[COLS.product_name]);
    // ข้ามแถวว่างสนิท
    if (!order_no && !product_name && !s(row[COLS.customer_name])) return;

    if (!order_no) { errors.push(`แถว ${line}: ไม่มีเลขที่ใบสั่งงาน — ข้าม`); return; }
    if (!product_name) { errors.push(`แถว ${line}: ไม่มีชื่อสินค้า — ข้าม`); return; }

    const collection = s(row[COLS.collection]); // คีย์เองได้ ไม่บังคับค่า

    const qty = num(row[COLS.qty]);
    const ppb = num(row[COLS.pieces_per_box]) || 1;
    if (qty <= 0) errors.push(`แถว ${line}: จำนวนต้องมากกว่า 0`);

    const item: NewOrderItem = { collection, product_name, qty, pieces_per_box: ppb, note: s(row[COLS.note]) };

    const existing = grouped.get(order_no);
    if (existing) {
      existing.items.push(item);
    } else {
      const shipRaw = s(row[COLS.shipping_method]);
      const statusRaw = s(row[COLS.status]);
      grouped.set(order_no, {
        order_no,
        customer_type: 'hotel', // ตัดคอลัมน์ประเภทลูกค้าออก — ใช้ค่าเริ่มต้น
        customer_name: s(row[COLS.customer_name]) || order_no,
        delivery_location: s(row[COLS.delivery_location]),
        shipping_method: SHIPPING_MAP[shipRaw] ?? 'company',
        zone_id: matchZoneId(s(row[COLS.zone]), zones),
        status: STATUS_MAP[statusRaw] ?? 'ready',
        cod_amount: num(row[COLS.cod_amount]),
        ship_date: normDate(row[COLS.ship_date]) || undefined,
        items: [item],
      });
    }
  });

  return { orders: [...grouped.values()], errors, rowCount: rows.length };
}

// ============================================================
// 3) รูปแบบ "template บริษัท" — 1 ออเดอร์ = หลายแถว
//    A=โรงแรม/รพ.  B=เลขใบสั่งงาน/วันส่ง  C=Collection  D=สินค้า
//    E=จำนวน  F=ชิ้น/กล่อง  G=สถานะ  H=หมายเหตุ  I=ที่อยู่ขนส่ง
//    ที่อยู่แตกได้หลายบรรทัด · section "ส่งสินค้าทาง…" = วิธีจัดส่ง
// ============================================================
function looksLikeCompanyTemplate(grid: unknown[][]): boolean {
  const head = grid.slice(0, 10).map((r) => (r || []).map((c) => s(c)).join(' ')).join(' | ');
  return /ที่อยู่ขนส่ง|โรงแรม\s*\/\s*โรงพยาบาล|ส่งสินค้าทาง|ใบสรุปรายการและวันส่ง/.test(head);
}

export function parseCompanyGrid(grid: unknown[][], zones: Zone[], defaultShipping: ShippingMethod = 'company'): ParseResult {
  const errors: string[] = [];
  const orders: NewOrder[] = [];
  const YEAR = new Date().getFullYear();
  const cell = (r: unknown[] | undefined, c: number) => s(r?.[c]);
  const rowEmpty = (r: unknown[] | undefined) => !r || r.every((x) => s(x) === '');
  const isProduct = (r: unknown[] | undefined) => !!r && cell(r, 3) !== '' && cell(r, 4) !== '';
  const joinRow = (r: unknown[] | undefined) => (r || []).map((x) => s(x)).join(' ');

  let shipping = defaultShipping;
  let auto = 0;
  let i = 0;

  while (i < grid.length) {
    const r = grid[i];
    if (rowEmpty(r)) { i++; continue; }
    const joined = joinRow(r);

    // section header (กำหนดวิธีจัดส่งของบล็อกถัดไป)
    if (/ส่งสินค้าทาง/.test(joined) && !isProduct(r)) {
      shipping = /บริษัท/.test(joined) ? 'company' : 'shipping';
      i++; continue;
    }
    // แถวชื่อเรื่อง / หัวคอลัมน์
    if (/ใบสรุปรายการ|โรงแรม\s*\/\s*โรงพยาบาล|ที่อยู่ขนส่ง/.test(joined) && !isProduct(r)) { i++; continue; }
    if (!isProduct(r)) { i++; continue; }

    // รวมแถวของออเดอร์นี้ (จนกว่าจะเจอแถวว่าง / ออเดอร์ถัดไป / section ใหม่)
    const block: unknown[][] = [r];
    let j = i + 1;
    while (j < grid.length) {
      const rj = grid[j];
      if (rowEmpty(rj)) break;
      if (isProduct(rj) && cell(rj, 0) !== '') break;
      if (/ส่งสินค้าทาง/.test(joinRow(rj)) && !isProduct(rj)) break;
      block.push(rj);
      j++;
    }

    // แยกเลขใบสั่งงาน / วันส่ง / ชื่อ / ที่อยู่ จากคอลัมน์ต่าง ๆ ของทั้งบล็อก
    let order_no = '', ship_date = '';
    const aLines: string[] = [], iLines: string[] = [];
    for (const br of block) {
      const braw = br[1];
      if (typeof braw === 'number') { if (!ship_date) ship_date = normDate(braw); }
      else {
        const bs = s(braw);
        if (bs) { if (isDateLike(bs)) { if (!ship_date) ship_date = parseLooseDate(bs, YEAR) || ''; } else if (!order_no) order_no = bs; }
      }
      const a = cell(br, 0); if (a) aLines.push(a);
      const ad = cell(br, 8); if (ad) iLines.push(ad);
    }

    const customer_name = aLines[0] || order_no || 'ไม่ระบุชื่อ';
    const extra = aLines.slice(1); // บรรทัดถัดมาของคอลัมน์ A (เช่น "โอนเงินแล้ว" / ชื่อผู้รับ)
    const address = iLines.join(' ');
    const customer_type: CustomerType = /รพ\.|โรงพยาบาล|hospital/i.test(customer_name) ? 'hospital' : 'hotel';
    const cod = /เก็บเงินปลายทาง|ปลายทาง|\bcod\b/i.test(address + ' ' + extra.join(' '));

    if (!order_no) { order_no = `TMP-${String(++auto).padStart(3, '0')}`; errors.push(`${customer_name}: ไม่มีเลขใบสั่งงาน → ตั้งให้ ${order_no}`); }

    const prod = block.filter(isProduct);
    if (!prod.length) { errors.push(`${customer_name}: ไม่มีสินค้าในบล็อก — ข้าม`); i = j; continue; }

    const noteParts = [...extra];
    if (cod) noteParts.unshift('เก็บเงินปลายทาง');
    const statusRaw = cell(prod[0], 6);

    const items: NewOrderItem[] = prod.map((pr, idx) => ({
      collection: cell(pr, 2),
      product_name: cell(pr, 3),
      qty: num(pr[4]),
      pieces_per_box: num(pr[5]) || 1,
      note: [cell(pr, 7), idx === 0 ? noteParts.join(' · ') : ''].filter(Boolean).join(' · '),
    }));

    orders.push({
      order_no,
      customer_type,
      customer_name,
      delivery_location: address,
      shipping_method: shipping,
      zone_id: inferZone(address, zones),
      status: STATUS_MAP[statusRaw] ?? 'unspecified',
      cod_amount: 0,
      ship_date: ship_date || undefined,
      items,
    });
    i = j;
  }

  return { orders, errors, rowCount: grid.length };
}

// ============================================================
// 4) วาง (paste) จาก Excel — TSV → ตาราง 2 มิติ → parseCompanyGrid
// ============================================================
export function parsePastedOrders(text: string, zones: Zone[], defaultShipping: ShippingMethod = 'company'): ParseResult {
  const rows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'));
  if (!rows.length || rows.every((r) => r.every((c) => s(c) === ''))) {
    return { orders: [], errors: ['ยังไม่มีข้อมูลที่วาง'], rowCount: 0 };
  }
  return parseCompanyGrid(rows, zones, defaultShipping);
}
