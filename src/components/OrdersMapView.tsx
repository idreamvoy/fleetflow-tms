import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Order, Zone } from '../lib/types';
import { WAREHOUSE, geocode } from '../lib/geo';
import { ensureGeocoded, onGeoUpdate, cachedCoords } from '../lib/ors';
import { STATUS_LABEL } from './badges';

const TILE_LAYER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';

// สีประจำวันกำหนดส่ง (วนซ้ำเมื่อวันเยอะ)
export const DATE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#0ea5e9', '#f97316'];
export const NO_DATE_COLOR = '#94a3b8';
export const NO_DATE = '__none__';

export const fmtDay = (iso: string) =>
  iso === NO_DATE ? 'ไม่ระบุวัน' : new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
export const dayNum = (iso: string) => (iso === NO_DATE ? '?' : String(Number(iso.slice(8, 10))));

/** วันกำหนดส่งทั้งหมด เรียงจากน้อยไปมาก · "ไม่ระบุวัน" ไว้ท้ายสุดเสมอ */
export function dayKeysOf(list: Array<{ ship_date?: string | null }>): string[] {
  const s = new Set<string>();
  list.forEach((o) => s.add(o.ship_date || NO_DATE));
  const dated = [...s].filter((d) => d !== NO_DATE).sort();
  return s.has(NO_DATE) ? [...dated, NO_DATE] : dated;
}

/** แจกสีให้แต่ละวัน — วันต่างกันต้องได้คนละสี (ไม่ระบุวัน = เทาเสมอ) */
export function dayColorMap(dayKeys: string[]): Map<string, string> {
  const m = new Map<string, string>();
  let i = 0;
  dayKeys.forEach((d) => m.set(d, d === NO_DATE ? NO_DATE_COLOR : DATE_COLORS[i++ % DATE_COLORS.length]));
  return m;
}

const esc = (s?: string | null) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export default function OrdersMapView({ orders, zones }: { orders: Order[]; zones: Zone[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [hideDelivered, setHideDelivered] = useState(true);

  // หาพิกัดเบื้องหลัง (Nominatim throttle 1/วิ · cache ไว้แล้วไม่ยิงซ้ำ)
  useEffect(() => onGeoUpdate(force), []);
  useEffect(() => {
    ensureGeocoded(orders.map((o) => ({ address: o.delivery_location, customer: o.customer_name })));
  }, [orders]);

  const visible = useMemo(
    () => orders.filter((o) => !(hideDelivered && o.status === 'delivered')),
    [orders, hideDelivered]
  );

  // จัดกลุ่มตามวันกำหนดส่ง + แจกสี
  const dayKeys = useMemo(() => dayKeysOf(visible), [visible]);
  const colorOf = useMemo(() => dayColorMap(dayKeys), [dayKeys]);

  const shown = useMemo(
    () => (dayFilter === 'all' ? visible : visible.filter((o) => (o.ship_date || NO_DATE) === dayFilter)),
    [visible, dayFilter]
  );

  // แยกออกว่าอันไหนปักหมุดได้ / ยังหาพิกัดไม่ได้
  const located = shown.filter((o) => geocode(o.delivery_location, o.zone_id));
  const pending = shown.filter((o) => o.delivery_location && cachedCoords(o.delivery_location) === undefined);
  const failed = shown.filter((o) => !geocode(o.delivery_location, o.zone_id) && cachedCoords(o.delivery_location) !== undefined);

  // ---- สร้างแผนที่ครั้งเดียว ----
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const m = L.map(boxRef.current).setView([13.75, 100.55], 10);
    L.tileLayer(TILE_LAYER, { attribution: ATTRIBUTION }).addTo(m);
    L.marker([WAREHOUSE.lat, WAREHOUSE.lng], {
      icon: L.divIcon({
        html: '<div style="background:#0f172a;color:#fff;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏭</div>',
        iconSize: [30, 30], className: '',
      }),
    }).bindPopup('<b>คลังเนเจอร์ทัช</b><br>จุดเริ่มต้นทุกเที่ยว').addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    setTimeout(() => m.invalidateSize(), 80);
    return () => { m.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // ---- วาดหมุดใหม่เมื่อข้อมูล/ตัวกรองเปลี่ยน ----
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pts: [number, number][] = [[WAREHOUSE.lat, WAREHOUSE.lng]];
    located.forEach((o) => {
      const p = geocode(o.delivery_location, o.zone_id)!;
      const key = o.ship_date || NO_DATE;
      const color = colorOf.get(key) ?? NO_DATE_COLOR;
      const coarse = cachedCoords(o.delivery_location)?.precision === 'province';
      const icon = L.divIcon({
        className: '',
        iconSize: [30, 30],
        html:
          `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;` +
          `display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;` +
          `border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)${coarse ? ';opacity:.6;border-style:dashed' : ''}">` +
          `${esc(dayNum(key))}</div>`,
      });
      L.marker([p.lat, p.lng], { icon })
        .bindPopup(
          `<div style="min-width:190px">` +
          `<b>${esc(o.customer_name)}</b><br>` +
          `<code>${esc(o.order_no)}</code> · ${esc(STATUS_LABEL[o.status])}<br>` +
          `<span style="color:${color};font-weight:700">🗓 ${esc(fmtDay(key))}</span> · ${o.box_count} กล่อง<br>` +
          `<span style="color:#64748b;font-size:12px">${esc(o.zone_name ?? '')}</span><br>` +
          `<span style="color:#94a3b8;font-size:11px">${esc((o.delivery_location ?? '').slice(0, 90))}</span>` +
          (coarse ? `<br><span style="color:#b45309;font-size:11px">⚠ ตำแหน่งหยาบ (ระดับจังหวัด)</span>` : '') +
          `</div>`
        )
        .addTo(layer);
      pts.push([p.lat, p.lng]);
    });

    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
  }, [located, colorOf]);

  const countOf = (k: string) => (k === 'all' ? visible.length : visible.filter((o) => (o.ship_date || NO_DATE) === k).length);
  const boxesOf = (k: string) =>
    (k === 'all' ? visible : visible.filter((o) => (o.ship_date || NO_DATE) === k)).reduce((s, o) => s + o.box_count, 0);

  // สรุปโซนของวันที่เลือก — ตอบคำถาม "วันนี้จองไปโซนไหนบ้าง"
  const zoneRows = useMemo(() => {
    const m = new Map<string, { n: number; boxes: number; color: string }>();
    shown.forEach((o) => {
      const name = o.zone_name ?? 'ไม่ระบุโซน';
      const z = zones.find((x) => x.id === o.zone_id);
      const cur = m.get(name) ?? { n: 0, boxes: 0, color: z?.color ?? '#94a3b8' };
      m.set(name, { n: cur.n + 1, boxes: cur.boxes + o.box_count, color: cur.color });
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [shown, zones]);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>แผนที่ออเดอร์ · จองโซนไหน วันไหน</h3>
          <div className="sub">หมุด = เลขวันกำหนดส่ง · สีเดียวกัน = วันเดียวกัน · คลิกหมุดดูรายละเอียด</div>
        </div>
        <label className="map-toggle">
          <input type="checkbox" checked={hideDelivered} onChange={(e) => setHideDelivered(e.target.checked)} />
          ซ่อนที่ส่งแล้ว
        </label>
      </div>

      {/* ตัวกรองวัน = legend สีในตัว */}
      <div className="chips map-days">
        <button className={`chip${dayFilter === 'all' ? ' active' : ''}`} onClick={() => setDayFilter('all')}>
          ทุกวัน<span className="chip-count">{countOf('all')}</span>
        </button>
        {dayKeys.map((d) => (
          <button key={d} className={`chip${dayFilter === d ? ' active' : ''}`} onClick={() => setDayFilter(d)}>
            <span className="chip-dot" style={{ background: colorOf.get(d) }} />
            {fmtDay(d)}<span className="chip-count">{countOf(d)}</span>
          </button>
        ))}
      </div>

      <div className="map-stat">
        <span>ปักหมุด <b>{located.length}</b> / {shown.length} ออเดอร์</span>
        <span><b>{boxesOf(dayFilter)}</b> กล่อง</span>
        {zoneRows.map(([name, z]) => (
          <span key={name} className="map-zone"><span className="chip-dot" style={{ background: z.color }} />{name} <b>{z.n}</b></span>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="route-note" style={{ margin: '0 16px' }}>
          ⏳ กำลังหาพิกัดอีก {pending.length} ที่อยู่… (ครั้งแรกช้าหน่อย ครั้งต่อไปจำไว้แล้ว)
        </div>
      )}
      {failed.length > 0 && (
        <div className="route-warn" style={{ margin: '8px 16px 0' }}>
          ⚠ ไม่ได้ปักหมุด {failed.length} ออเดอร์ เพราะหาพิกัดจากที่อยู่ไม่เจอ: <b>{failed.slice(0, 4).map((o) => o.customer_name).join(', ')}</b>
          {failed.length > 4 ? ` และอีก ${failed.length - 4}` : ''} — ตรวจ/แก้ที่อยู่ในหน้าออเดอร์
        </div>
      )}

      <div ref={boxRef} className="map-box" />
    </div>
  );
}
