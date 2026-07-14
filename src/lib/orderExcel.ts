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
// หัวคอลัมน์ตาม "ใบสรุปรายการและวันส่งสินค้า" ที่บริษัทใช้จริง (A–I)
const CO_HEAD = [
  'โรงแรม / โรงพยาบาล', 'เลขที่ใบสั่งงาน', 'Collection / กลิ่น', 'สินค้า',
  'จำนวน', 'ชิ้นต่อกล่อง', 'สถานะสินค้า', 'หมายเหตุ', 'ที่อยู่ขนส่ง',
];
const BLANK = ['', '', '', '', '', '', '', '', ''];

// แถวข้อมูลของ Sheet 1 (แยกออกมาเพื่อทดสอบว่า template ที่แจก นำกลับเข้าระบบได้จริง)
export function buildCompanyTemplateAoa(): (string | number)[][] {
  return [
    ['ใบสรุปรายการและวันส่งสินค้า'],
    BLANK,
    ['ส่งสินค้าทางขนส่ง'],
    CO_HEAD,
    // ตัวอย่างที่ 1 — มีเลขใบสั่งงาน + วันส่งใต้เลขใบสั่งงาน + ที่อยู่ 3 บรรทัด
    ['บจ.ตัวอย่าง รีสอร์ท', 'SO2607060013', 'Rejuvenate', 'Rejuvenate Shower Gel 10 Liters', 1, 1, 'ยังไม่ระบุ', '', 'เล็ตส์ ซี หัวหิน อัลเฟรสโก้ รีสอร์ท'],
    ['', '6-Jul', '', '', '', '', '', '', '83/155 ซ.หมู่บ้านหนองแก ต.หนองแก อ.หัวหิน'],
    ['', '', '', '', '', '', '', '', 'จ.ประจวบคีรีขันธ์ 77110'],
    ['', '', '', '', '', '', '', '', 'โทร 032-536888, 098-0100-289'],
    BLANK,
    // ตัวอย่างที่ 2 — ไม่มีเลขใบสั่งงาน + มีหมายเหตุใต้ชื่อลูกค้า + เก็บเงินปลายทาง
    ['บจก.ตัวอย่าง แซค', '', 'Melody Bloom', 'Melody Bloom Bath & Shower Gel 10 Liters', 2, 1, 'ยังไม่ระบุ', '', 'ทีบีพาร์ท (เก็บเงินปลายทาง)'],
    ['30/6 โอนเงินแล้ว', '30-Jun', '', '', '', '', '', '', 'หมู่ที่ 4 ต.ปากน้ำปราณ อ.ปราณบุรี จ.ประจวบคีรีขันธ์ 77220'],
    ['', '', '', '', '', '', '', '', 'ติดต่อ คุณภาคภูมิ โทร 088-814-1111'],
    BLANK,
    // ตัวอย่างที่ 3 — ออเดอร์เดียวมีหลายสินค้า (แถวสินค้าถัดไปเว้นคอลัมน์ A ไว้)
    ['รพ.ตัวอย่าง', 'SO2607070006', 'Housekeeping', 'ผ้าปูที่นอน 6 ฟุต', 240, 6, 'พร้อมส่ง', '', '33 ถ.สุขุมวิท เขตวัฒนา กทม. 10110'],
    ['', '7-Jul', 'Spa & Bath', 'ผ้าเช็ดตัว 27x54', 40, 10, '', 'ด่วน', 'โทร 02-123-4567'],
    BLANK,
    ['ส่งสินค้าทางบริษัท'],
    CO_HEAD,
    ['โรงแรมตัวอย่าง', 'SO2607070010', 'Hotel Premium', 'ปลอกหมอน', 120, 10, 'พร้อมส่ง', '', 'ปทุมวัน กทม. 10330'],
    ['', '8-Jul', '', '', '', '', '', '', 'โทร 02-999-8888'],
  ];
}

export function downloadOrderTemplate(zones: Zone[]) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: หน้าตาเหมือนไฟล์บริษัท (1 ออเดอร์ = หลายแถว, ที่อยู่แตกบรรทัดได้) ---
  const ws = XLSX.utils.aoa_to_sheet(buildCompanyTemplateAoa());
  ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 8 }, { wch: 11 }, { wch: 13 }, { wch: 14 }, { wch: 46 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // ชื่อเรื่อง
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }, // ส่งสินค้าทางขนส่ง
    { s: { r: 15, c: 0 }, e: { r: 15, c: 8 } }, // ส่งสินค้าทางบริษัท
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'ใบสรุปรายการ');

  // --- Sheet 2: คู่มือ ---
  const guide: (string | number)[][] = [
    ['📋 วิธีใช้ — Template นี้ใช้รูปแบบเดียวกับ "ใบสรุปรายการและวันส่งสินค้า" ของบริษัท'],
    [''],
    ['1. กรอกในชีต "ใบสรุปรายการ" ตามตัวอย่าง (ลบตัวอย่างออก หรือกรอกทับได้เลย)'],
    ['2. 1 ออเดอร์ = 1 บล็อก · คั่นแต่ละออเดอร์ด้วยแถวว่าง 1 แถว'],
    ['3. ที่อยู่ (คอลัมน์ I) แตกได้หลายบรรทัด — ระบบจะรวมให้เป็นที่อยู่เดียว'],
    ['4. ถ้าออเดอร์เดียวมีหลายสินค้า → เพิ่มแถวสินค้าใต้กัน โดยเว้นคอลัมน์ A (ชื่อลูกค้า) ไว้'],
    ['5. บันทึกไฟล์ แล้วกด "เลือกไฟล์" ในระบบ — หรือ Copy คอลัมน์ A ถึง I แล้ววางในแท็บ "วางจาก Excel"'],
    [''],
    ['── ระบบอ่านแต่ละคอลัมน์อย่างไร ──'],
    [''],
    ['A · โรงแรม / โรงพยาบาล', 'บรรทัดแรก = ชื่อลูกค้า · บรรทัดถัดไป = หมายเหตุ (เช่น "30/6 โอนเงินแล้ว")'],
    ['B · เลขที่ใบสั่งงาน', 'ใส่เลข SO… = เลขใบสั่งงาน · ใส่วันที่ (เช่น 6-Jul) = กำหนดส่ง · ใส่ทั้งคู่คนละบรรทัดได้'],
    ['C · Collection / กลิ่น', 'คีย์เองได้ตามต้องการ · ตัวอย่าง: ' + COLLECTIONS.join(', ')],
    ['D · สินค้า', 'ชื่อสินค้า (จำเป็น)'],
    ['E · จำนวน', 'ตัวเลข (จำเป็น)'],
    ['F · ชิ้นต่อกล่อง', 'ตัวเลข · ระบบคำนวณจำนวนกล่องให้อัตโนมัติ'],
    ['G · สถานะสินค้า', Object.values(STATUS_LABEL).join(', ') + ' (เว้นว่าง = ยังไม่ระบุ)'],
    ['H · หมายเหตุ', 'อิสระ'],
    ['I · ที่อยู่ขนส่ง', 'หลายบรรทัดได้ · ระบบเดาโซนจากที่อยู่ และจับคำว่า "เก็บเงินปลายทาง" เป็น COD'],
    [''],
    ['หัวข้อ "ส่งสินค้าทาง…"', 'ส่งสินค้าทางขนส่ง = ขนส่ง · ส่งสินค้าทางบริษัท = ขนส่งบริษัท'],
    ['โซนที่มีในระบบ', zones.map((z) => z.name).join(', ') || 'กทม., ต่างจังหวัด'],
    ['ไม่ใส่เลขใบสั่งงาน', 'ระบบจะตั้งเลขชั่วคราวให้ (TMP-001, TMP-002 …)'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 24 }, { wch: 92 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'คู่มือ');

  XLSX.writeFile(wb, `ใบสรุปรายการและวันส่งสินค้า-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  // แถวโครงสร้างของฟอร์ม (ชื่อเรื่อง / หัวข้อ "ส่งสินค้าทาง…" / แถวหัวคอลัมน์)
  // ต้องเช็คก่อน isProduct เพราะแถวหัวคอลัมน์ก็มีคำว่า "สินค้า"/"จำนวน" อยู่ในช่อง D/E
  const isTitle = (r: unknown[] | undefined) => /ใบสรุปรายการ/.test(cell(r, 0));
  const isSection = (r: unknown[] | undefined) => /ส่งสินค้าทาง/.test(cell(r, 0));
  const isHeader = (r: unknown[] | undefined) =>
    /โรงแรม\s*\/\s*โรงพยาบาล/.test(cell(r, 0)) ||
    /ที่อยู่ขนส่ง/.test(cell(r, 8)) ||
    (/^สินค้า$/.test(cell(r, 3)) && /^จำนวน$/.test(cell(r, 4)));
  const isStructural = (r: unknown[] | undefined) => isTitle(r) || isSection(r) || isHeader(r);

  let shipping = defaultShipping;
  let auto = 0;
  let i = 0;

  while (i < grid.length) {
    const r = grid[i];
    if (rowEmpty(r)) { i++; continue; }

    // หัวข้อ "ส่งสินค้าทาง…" = กำหนดวิธีจัดส่งของบล็อกถัดไป
    if (isSection(r)) {
      shipping = /บริษัท/.test(cell(r, 0)) ? 'company' : 'shipping';
      i++; continue;
    }
    // แถวชื่อเรื่อง / แถวหัวคอลัมน์ — ข้าม (ต้องเช็คก่อน isProduct)
    if (isTitle(r) || isHeader(r)) { i++; continue; }
    if (!isProduct(r)) { i++; continue; }

    // รวมแถวของออเดอร์นี้ (จนกว่าจะเจอแถวว่าง / ออเดอร์ถัดไป / section ใหม่)
    const block: unknown[][] = [r];
    let j = i + 1;
    while (j < grid.length) {
      const rj = grid[j];
      if (rowEmpty(rj)) break;
      if (isStructural(rj)) break;
      if (isProduct(rj) && cell(rj, 0) !== '') break; // ออเดอร์ถัดไป
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
