import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Order } from '../lib/types';
import { geocode, WAREHOUSE } from '../lib/geo';

const TILE_LAYER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';

export default function MapModal({
  orders,
  trip,
  onClose,
}: {
  orders: Order[];
  trip: { order_ids: number[] };
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInst.current) {
      mapInst.current = L.map(mapRef.current!).setView([13.7, 100.5], 11);
      L.tileLayer(TILE_LAYER, { attribution: ATTRIBUTION }).addTo(mapInst.current);
    }

    const map = mapInst.current;
    const stops = trip.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
    if (!stops.length) return;

    // เคลียร์ markers เก่า
    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer);
    });

    // Warehouse marker
    const warehouseIcon = L.divIcon({
      html: '<div style="background:#10b981;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white">🏭</div>',
      iconSize: [32, 32],
      className: '',
    });
    L.marker([WAREHOUSE.lat, WAREHOUSE.lng], { icon: warehouseIcon }).bindPopup('คลังเนเจอร์ทัช').addTo(map);

    const points = stops.map((o) => geocode(o.delivery_location, o.zone_id));
    // จุดที่หาพิกัดไม่ได้ = ไม่ปักหมุด (ห้ามเดาตำแหน่ง) — แจ้งไว้ท้ายแผนที่แทน
    const placed = stops.map((o, i) => ({ o, pt: points[i], i })).filter((x) => x.pt) as Array<{ o: typeof stops[number]; pt: { lat: number; lng: number }; i: number }>;
    setMissing(stops.filter((_, i) => !points[i]).map((o) => o.customer_name));

    const bounds = L.latLngBounds([[WAREHOUSE.lat, WAREHOUSE.lng], ...placed.map((x) => [x.pt.lat, x.pt.lng] as [number, number])]);

    // Order markers
    placed.forEach(({ o, pt, i }) => {
      const icon = L.divIcon({
        html: `<div style="background:#6366f1;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;font-size:14px">${i + 1}</div>`,
        iconSize: [36, 36],
        className: '',
      });
      L.marker([pt.lat, pt.lng], { icon })
        .bindPopup(`<b>${o.customer_name}</b><br>${o.delivery_location}`)
        .addTo(map);
    });

    // Route polyline (เฉพาะจุดที่รู้พิกัด)
    const routeCoords = [
      [WAREHOUSE.lat, WAREHOUSE.lng] as [number, number],
      ...placed.map((x) => [x.pt.lat, x.pt.lng] as [number, number]),
    ];
    L.polyline(routeCoords, { color: '#6366f1', weight: 3, opacity: 0.7 }).addTo(map);

    // Fit bounds + recalc ขนาดหลัง modal เปิด (กัน tiles เพี้ยน)
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50] });
    }, 100);
  }, [orders, trip]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: '90vw',
          height: '80vh',
          maxWidth: 1200,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3>แผนที่เส้นทาง</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {missing.length > 0 && (
          <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e', fontSize: 13, flexShrink: 0 }}>
            ⚠ ไม่ได้ปักหมุด {missing.length} จุด เพราะหาพิกัดจากที่อยู่ไม่เจอ: <b>{missing.join(', ')}</b> — กรุณาตรวจ/แก้ที่อยู่
          </div>
        )}
        {/* map ต้องมีความสูงชัดเจน — ใช้ flex:1 + minHeight:0 กันยุบใน flex column */}
        <div ref={mapRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
      </div>
    </div>
  );
}
