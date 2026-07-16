// ============================================================
// FleetFlow TMS — Route intelligence (estimate mode)
// พิกัดโดยประมาณของสถานที่ในไทย → คำนวณระยะทาง + จัดลำดับ + ETA
// (ยังไม่ใช้ Google Directions API — ประเมินจากพิกัดเส้นตรง)
// ============================================================

import { cachedCoords, cachedRoute, ORS_ENABLED } from './ors';

export interface LatLng {
  lat: number;
  lng: number;
}

// คลังสินค้าหลัก (จุดเริ่มต้นทุกเที่ยว)
// คลังสินค้า เนเจอร์ทัช · ซ.กิ่งแก้ว 25/1 ต.ราชาเทวะ อ.บางพลี สมุทรปราการ
export const WAREHOUSE: LatLng = { lat: 13.6799388, lng: 100.7093006 };
export const WAREHOUSE_NAME = 'คลังสินค้า เนเจอร์ทัช';

// ตารางพิกัดโดยประมาณจากคำสำคัญในที่อยู่
const PLACES: Array<{ kw: string; lat: number; lng: number }> = [
  // กรุงเทพฯ & ปริมณฑล
  { kw: 'ปทุมวัน', lat: 13.744, lng: 100.532 },
  { kw: 'ราชเทวี', lat: 13.759, lng: 100.533 },
  { kw: 'วัฒนา', lat: 13.74, lng: 100.584 },
  { kw: 'คลองเตย', lat: 13.708, lng: 100.583 },
  { kw: 'ห้วยขวาง', lat: 13.777, lng: 100.574 },
  { kw: 'บางรัก', lat: 13.728, lng: 100.524 },
  { kw: 'สุขุมวิท', lat: 13.738, lng: 100.56 },
  { kw: 'สีลม', lat: 13.725, lng: 100.534 },
  { kw: 'บางกอกน้อย', lat: 13.762, lng: 100.47 },
  { kw: 'พระราม 1', lat: 13.746, lng: 100.53 },
  { kw: 'เจริญกรุง', lat: 13.722, lng: 100.514 },
  { kw: 'ปริมณฑล', lat: 13.85, lng: 100.6 },
  { kw: 'กิ่งแก้ว', lat: 13.68, lng: 100.709 },
  { kw: 'ราชาเทวะ', lat: 13.68, lng: 100.709 },
  { kw: 'บางพลี', lat: 13.6, lng: 100.71 },
  { kw: 'สุวรรณภูมิ', lat: 13.69, lng: 100.75 },
  { kw: 'สมุทรปราการ', lat: 13.599, lng: 100.597 },
  { kw: 'บางนา', lat: 13.668, lng: 100.604 },
  { kw: 'กทม', lat: 13.746, lng: 100.534 },
  // ต่างจังหวัด
  { kw: 'พิษณุโลก', lat: 16.821, lng: 100.266 },
  { kw: 'เชียงใหม่', lat: 18.788, lng: 98.985 },
  { kw: 'ขอนแก่น', lat: 16.439, lng: 102.836 },
  { kw: 'ภูเก็ต', lat: 7.88, lng: 98.392 },
  { kw: 'บางละมุง', lat: 12.93, lng: 100.89 },
  { kw: 'พัทยา', lat: 12.933, lng: 100.882 },
  { kw: 'ชลบุรี', lat: 13.361, lng: 100.985 },
  { kw: 'ระยอง', lat: 12.681, lng: 101.277 },
  { kw: 'ศรีราชา', lat: 13.174, lng: 100.931 },
  { kw: 'หาดใหญ่', lat: 7.008, lng: 100.468 },
  { kw: 'สงขลา', lat: 7.19, lng: 100.595 },
];

// แปลงที่อยู่ (ข้อความ) → พิกัด
//  1) พิกัดจริงจาก OpenRouteService (ถ้ามีคีย์ + โหลดมาแล้ว)
//  2) เดาจากคำสำคัญในตาราง PLACES (ค่าประมาณ)
//  3) null = ไม่รู้จริง ๆ → ต้องเตือน ห้ามเดา
// หมายเหตุ: เดิมข้อ 3 คืน "ศูนย์กลางภาค" ทำให้ที่อยู่สะกดผิด 1 ตัว
// กลายเป็นระยะ 213 กม. แบบเงียบ ๆ จึงตัดออก
export function geocode(location: string | null | undefined, _zoneId?: number | null): LatLng | null {
  if (!location) return null;
  const ors = cachedCoords(location);
  if (ors) return ors;
  for (const p of PLACES) if (location.includes(p.kw)) return { lat: p.lat, lng: p.lng };
  return null;
}

// ระยะทางเส้นตรง (กม.) — Haversine
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// คูณ 1.3 ชดเชยระยะถนนจริง (เส้นตรง → ถนน)
const ROAD_FACTOR = 1.3;

export const AVG_SPEED_KMH = 35; // ความเร็วเฉลี่ยประเมิน
export const SERVICE_MIN = 12; // เวลาต่อจุด (นาที)
export const START_MIN = 8 * 60; // ออกรถ 08:00

// ระยะรวมของเส้นทาง (คลัง → จุดตามลำดับ)
function routeCost(points: LatLng[], order: number[]): number {
  let cur = WAREHOUSE;
  let total = 0;
  for (const i of order) { total += haversine(cur, points[i]); cur = points[i]; }
  return total;
}

// nearest-neighbor (สำหรับจุดจำนวนมาก)
function nearestNeighbor(points: LatLng[]): number[] {
  const n = points.length;
  const visited = new Array(n).fill(false);
  const order: number[] = [];
  let cur = WAREHOUSE;
  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversine(cur, points[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    visited[best] = true;
    order.push(best);
    cur = points[best];
  }
  return order;
}

// brute-force หาลำดับที่สั้นที่สุดจริง (จุด ≤ 8) — permutation ทั้งหมด
function bruteForce(points: LatLng[]): number[] {
  const n = points.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  let bestOrder = idx.slice();
  let bestCost = Infinity;
  const permute = (arr: number[], k: number) => {
    if (k === arr.length) {
      const c = routeCost(points, arr);
      if (c < bestCost) { bestCost = c; bestOrder = arr.slice(); }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(idx, 0);
  return bestOrder;
}

// จัดลำดับจุดส่งให้ระยะสั้นที่สุด (เริ่มจากคลัง) → คืนลำดับ index
export function optimizeOrder(points: LatLng[]): number[] {
  const n = points.length;
  if (n <= 1) return points.map((_, i) => i);
  return n <= 8 ? bruteForce(points) : nearestNeighbor(points);
}

export interface RouteLeg {
  idx: number; // index ใน points ตามลำดับที่ให้มา
  km: number | null; // ระยะจากจุดก่อนหน้า · null = ไม่รู้พิกัดจุดนี้
  etaMin: number; // เวลาถึง (นาทีจากเที่ยงคืน)
}

export interface RoutePlan {
  legs: RouteLeg[];
  totalKm: number;
  totalMin: number;
  source: 'ors' | 'estimate'; // ors = ระยะถนนจริง · estimate = เส้นตรง×1.3
  unknown: number; // จำนวนจุดที่หาพิกัดไม่ได้
}

// คำนวณระยะ/เวลา ตามลำดับจุดที่กำหนด (points เรียงตามลำดับส่งแล้ว)
// รับ null ได้ = จุดที่หาพิกัดไม่ได้ → ไม่คิดระยะให้ (แทนที่จะเดา)
export function routePlan(points: Array<LatLng | null>): RoutePlan {
  const unknown = points.filter((p) => !p).length;

  // ทางที่แม่นจริง: ทุกจุดมีพิกัด + ORS ส่งเส้นทางถนนมาแล้ว
  if (!unknown && points.length && ORS_ENABLED) {
    const full = [WAREHOUSE, ...(points as LatLng[])];
    const r = cachedRoute(full);
    if (r) {
      let clock = START_MIN;
      const legs: RouteLeg[] = points.map((_, idx) => {
        const km = r.legs[idx] ?? 0;
        clock += (km / AVG_SPEED_KMH) * 60 + SERVICE_MIN;
        return { idx, km, etaMin: Math.round(clock) };
      });
      return { legs, totalKm: r.totalKm, totalMin: r.totalMin, source: 'ors', unknown: 0 };
    }
  }

  // ค่าประมาณ: เส้นตรง × 1.3 · ข้ามจุดที่ไม่รู้พิกัด
  let cur: LatLng = WAREHOUSE;
  let clock = START_MIN;
  let totalKm = 0;
  const legs: RouteLeg[] = points.map((p, idx) => {
    if (!p) return { idx, km: null, etaMin: Math.round(clock) };
    const km = haversine(cur, p) * ROAD_FACTOR;
    clock += (km / AVG_SPEED_KMH) * 60 + SERVICE_MIN;
    cur = p;
    totalKm += km;
    return { idx, km: Math.round(km * 10) / 10, etaMin: Math.round(clock) };
  });
  return { legs, totalKm: Math.round(totalKm * 10) / 10, totalMin: Math.round(clock - START_MIN), source: 'estimate', unknown };
}

export function fmtClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}
