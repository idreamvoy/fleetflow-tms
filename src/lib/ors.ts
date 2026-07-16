// ============================================================
// หาพิกัด + ระยะทางถนนจริง
//   · หาพิกัด  = Nominatim (OpenStreetMap) — ฟรี ไม่ต้องใช้คีย์
//                 ทดสอบกับที่อยู่จริงแล้วแม่นระดับ ~100-250 ม.
//                 (ORS/Pelias หาที่อยู่ไทยไม่เจอ และเคยคืน "แม่ฮ่องสอน"
//                  ให้ รพ.ที่สีลม จึงไม่ใช้ทำ geocode)
//   · ระยะทาง  = OpenRouteService directions (ต้องมี VITE_ORS_API_KEY)
//
// ไม่มีคีย์ ORS ก็ยังหาพิกัดได้ แต่ระยะจะเป็น "ค่าประมาณ" (เส้นตรง×1.3)
// ผลทั้งหมด cache ลง localStorage — Nominatim จำกัด 1 ครั้ง/วินาที
// ============================================================
import type { LatLng } from './geo';

const KEY = (import.meta.env.VITE_ORS_API_KEY as string | undefined)?.trim();
/** มีคีย์ ORS = คำนวณระยะถนนจริงได้ (ไม่มีก็ยังหาพิกัดได้ แต่ระยะเป็นค่าประมาณ) */
export const ORS_ENABLED = !!KEY;

/** ความละเอียดของพิกัดที่หาได้ — ใช้เตือนผู้ใช้เมื่อหยาบเกินไป */
export type Precision = 'exact' | 'area' | 'province';
export interface Coords extends LatLng { precision: Precision; via: string }

const GEO_CACHE_KEY = 'ff_geo_v2';
type GeoEntry = Coords | null; // null = หาแล้วไม่เจอจริง ๆ

let geoCache: Record<string, GeoEntry> = {};
try { geoCache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); } catch { geoCache = {}; }
const saveGeo = () => { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache)); } catch { /* เต็มก็ช่างมัน */ } };

const routeCache = new Map<string, { legs: number[]; totalKm: number; totalMin: number }>();

// ---------- แจ้ง UI ให้ re-render เมื่อข้อมูลเบื้องหลังมาถึง ----------
const listeners = new Set<() => void>();
export function onGeoUpdate(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const bump = () => listeners.forEach((f) => f());

const inFlight = new Set<string>();
const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

// ---------- ล้างที่อยู่ → รายการคำค้นไล่จากละเอียดไปหยาบ ----------
export function addressCandidates(addr: string, customer?: string | null): Array<{ q: string; precision: Precision }> {
  const out: Array<{ q: string; precision: Precision }> = [];
  // ตัดหมายเหตุการส่งท้ายที่อยู่ทิ้ง ("โทร ... ส่งสินค้าชั้น 2 ...")
  const base = norm(addr.split(/โทร|Tel|ติดต่อ/i)[0]);
  if (base) out.push({ q: base, precision: 'exact' });

  // กทม.: แขวง + เขต  (เขตอาจสะกดผิด → ลองแขวงอย่างเดียวด้วย)
  const bkk = base.match(/(แขวง\S+)\s*(เขต\S+)/);
  if (bkk) {
    out.push({ q: `${bkk[1]} ${bkk[2]} กรุงเทพมหานคร`, precision: 'area' });
    out.push({ q: `${bkk[1]} กรุงเทพมหานคร`, precision: 'area' });
  }
  // ต่างจังหวัด: ต./อ./จ.
  // (?<![ก-ฮ]) กัน "จ." ที่เป็นหางคำนำหน้าบริษัท — บมจ.ธนบุรี ต้องไม่กลายเป็น "จังหวัดธนบุรี"
  const up = base.match(/(?<![ก-ฮ])(ต\.\s*\S+)\s*(?<![ก-ฮ])(อ\.\s*\S+)\s*(?<![ก-ฮ])(จ\.\s*\S+)/);
  if (up) {
    const t = up[1].replace(/ต\.\s*/, 'ตำบล'), a = up[2].replace(/อ\.\s*/, 'อำเภอ'), p = up[3].replace(/จ\.\s*/, 'จังหวัด');
    out.push({ q: `${t} ${a} ${p}`, precision: 'area' });
    out.push({ q: `${a} ${p}`, precision: 'area' });
  }
  // ชื่อลูกค้า (โรงแรม/รพ. ส่วนใหญ่อยู่ใน OpenStreetMap)
  if (customer) {
    const c = norm(customer.replace(/^(บจก?\.|บมจ\.|หจก\.|หสม\.)\s*/, ''));
    if (c) out.push({ q: c, precision: 'exact' });
  }
  // ท้ายสุด: ระดับจังหวัด — หยาบมาก ใช้เตือนว่าอย่าเชื่อระยะ
  const prov = base.match(/(?<![ก-ฮ])จ\.\s*(\S+)/);
  if (prov) out.push({ q: 'จังหวัด' + prov[1], precision: 'province' });

  const seen = new Set<string>();
  return out.filter((x) => x.q.length > 3 && !seen.has(x.q) && seen.add(x.q));
}

// ---------- Nominatim (จำกัด 1 ครั้ง/วินาที ต้องเว้นจังหวะ) ----------
let lastCall = 0;
async function nominatim(q: string): Promise<LatLng | null> {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const u = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=th&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = await r.json();
  const f = j?.[0];
  return f ? { lat: +f.lat, lng: +f.lon } : null;
}

export function cachedCoords(address?: string | null): Coords | null | undefined {
  if (!address) return undefined;
  return geoCache[norm(address)];
}

/** หาพิกัดของที่อยู่ที่ยังไม่เคยหา (ทำเบื้องหลัง แล้ว bump ให้ UI อัปเดต) */
export async function ensureGeocoded(items: Array<{ address?: string | null; customer?: string | null }>): Promise<void> {
  const todo = items
    .filter((x) => x.address && geoCache[norm(x.address)] === undefined && !inFlight.has(norm(x.address)))
    .filter((x, i, a) => a.findIndex((y) => norm(y.address!) === norm(x.address!)) === i)
    .slice(0, 10); // ค่อย ๆ ทยอย กันชน rate limit
  if (!todo.length) return;

  for (const { address, customer } of todo) {
    const key = norm(address!);
    inFlight.add(key);
    try {
      let found: GeoEntry = null;
      for (const { q, precision } of addressCandidates(key, customer)) {
        const hit = await nominatim(q);
        if (hit) { found = { ...hit, precision, via: q }; break; }
      }
      geoCache[key] = found; // null = ลองครบทุกแบบแล้วไม่เจอ → เตือนผู้ใช้
      saveGeo();
      bump();
    } catch (e) {
      console.warn('geocode failed', address, e); // error เครือข่าย: ไม่ cache จะได้ลองใหม่
    } finally {
      inFlight.delete(key);
    }
  }
}

const sig = (pts: LatLng[]) => pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

export function cachedRoute(points: LatLng[]) {
  return routeCache.get(sig(points));
}

/** ระยะถนนจริงตามลำดับจุด (คลัง → จุด1 → จุด2 …) ผ่าน ORS Directions */
export async function ensureRoute(points: LatLng[]): Promise<void> {
  if (!ORS_ENABLED || points.length < 2) return;
  const k = sig(points);
  if (routeCache.has(k) || inFlight.has(k)) return;
  inFlight.add(k);
  try {
    const r = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: { Authorization: KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }),
    });
    if (!r.ok) throw new Error(`ORS directions ${r.status}`);
    const j = await r.json();
    const segs = j?.routes?.[0]?.segments ?? [];
    if (segs.length) {
      const legs = segs.map((s: any) => Math.round((s.distance / 1000) * 10) / 10);
      routeCache.set(k, {
        legs,
        totalKm: Math.round(legs.reduce((a: number, b: number) => a + b, 0) * 10) / 10,
        totalMin: Math.round(segs.reduce((a: number, s: any) => a + s.duration, 0) / 60),
      });
      bump();
    }
  } catch (e) {
    console.warn('ORS directions failed', e);
  } finally {
    inFlight.delete(k);
  }
}
