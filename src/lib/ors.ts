// ============================================================
// OpenRouteService — หาพิกัดจากที่อยู่จริง + ระยะทางถนนจริง
// ใช้ได้เมื่อมี VITE_ORS_API_KEY (สมัครฟรีที่ openrouteservice.org)
// ถ้าไม่มีคีย์ ระบบจะถอยไปใช้ "ค่าประมาณ" ใน geo.ts และติดป้ายบอกชัดเจน
//
// โควตาฟรี: geocode 1,000/วัน · directions 2,000/วัน
// จึง cache ผลลง localStorage เพื่อไม่ยิงซ้ำ
// ============================================================
import type { LatLng } from './geo';

const KEY = (import.meta.env.VITE_ORS_API_KEY as string | undefined)?.trim();
export const ORS_ENABLED = !!KEY;

const GEO_CACHE_KEY = 'ff_ors_geo_v1';
type GeoEntry = { lat: number; lng: number } | null; // null = ยิงแล้วแต่หาไม่เจอ (อย่ายิงซ้ำ)

let geoCache: Record<string, GeoEntry> = {};
try { geoCache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); } catch { geoCache = {}; }
const saveGeo = () => { try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache)); } catch { /* เต็มก็ช่างมัน */ } };

// เส้นทางไม่ต้อง persist — เก็บในหน่วยความจำพอ
const routeCache = new Map<string, { legs: number[]; totalKm: number; totalMin: number }>();

// ---------- แจ้ง UI ให้ re-render เมื่อข้อมูลเบื้องหลังมาถึง ----------
const listeners = new Set<() => void>();
export function onGeoUpdate(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const bump = () => listeners.forEach((f) => f());

// ---------- คิวกันยิงพร้อมกันเกินลิมิต (40 ครั้ง/นาที) ----------
const inFlight = new Set<string>();
const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

export function cachedCoords(address?: string | null): LatLng | null | undefined {
  if (!address) return undefined;
  const v = geoCache[norm(address)];
  return v === undefined ? undefined : v; // undefined = ยังไม่เคยหา, null = หาไม่เจอ
}

/** หาพิกัดจากที่อยู่ผ่าน ORS (เบื้องหลัง) — ผลเก็บ cache แล้ว bump ให้ UI อัปเดต */
export async function ensureGeocoded(addresses: Array<string | null | undefined>): Promise<void> {
  if (!ORS_ENABLED) return;
  const todo = [...new Set(addresses.filter(Boolean).map((a) => norm(a as string)))]
    .filter((a) => geoCache[a] === undefined && !inFlight.has(a));
  if (!todo.length) return;

  for (const addr of todo.slice(0, 20)) { // กันยิงรัวเกินลิมิต
    inFlight.add(addr);
    try {
      const url = `https://api.openrouteservice.org/geocode/search?api_key=${KEY}&text=${encodeURIComponent(addr)}&boundary.country=TH&size=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`ORS geocode ${r.status}`);
      const j = await r.json();
      const c = j?.features?.[0]?.geometry?.coordinates;
      geoCache[addr] = Array.isArray(c) ? { lat: c[1], lng: c[0] } : null;
    } catch (e) {
      console.warn('ORS geocode failed', addr, e);
      // ไม่ cache เป็น null ตอน error เครือข่าย จะได้ลองใหม่รอบหน้า
    } finally {
      inFlight.delete(addr);
    }
  }
  saveGeo();
  bump();
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
