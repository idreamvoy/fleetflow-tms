import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Order, Trip, Driver, Zone, OrderStatus, TripStatus, ItemReadiness } from '../lib/types';
import { TRIP_STATUS_LABEL, orderReadiness } from '../lib/types';
import { IconRoute, IconPin, IconTruck, IconBox, IconPlus } from '../components/icons';
import OrderDetail from '../components/OrderDetail';
import MapModal from '../components/MapModal';
import TripModal from '../components/TripModal';
import OrdersMapView from '../components/OrdersMapView';
import { IconGrid } from '../components/icons';

const shortZone = (name?: string | null) => {
  const n = name ?? '';
  if (/กทม|กรุงเทพ|ปริมณฑล/.test(n)) return 'กทม.';
  if (/ต่างประเทศ/.test(n)) return 'ต่างประเทศ';
  if (/ทั่วไป/.test(n)) return 'ทั่วไป';
  if (/ต่างจังหวัด|ตจว/.test(n)) return 'ต่างจังหวัด';
  return n || '—';
};
// ชื่อเที่ยว = ชื่อคนขับ (แทนการนับ TR-xx) — ยังไม่ระบุ ใช้ 'เที่ยว #id'
const tripLabel = (t: Trip) => t.driver_name || `เที่ยว #${t.id}`;
import type { LatLng } from '../lib/geo';
import { geocode, optimizeOrder, routePlan, WAREHOUSE, haversine } from '../lib/geo';
import { ORS_ENABLED, ensureGeocoded, ensureRoute, onGeoUpdate, cachedCoords } from '../lib/ors';

const WAREHOUSE_ORIGIN = `${WAREHOUSE.lat},${WAREHOUSE.lng}`; // คลังเนเจอร์ทัช

// รวม waiting_ship ด้วย: ออเดอร์ที่เคยจัดเข้าเที่ยวแต่เที่ยวถูกลบ จะได้ไม่หายจากกอง
const WAITING_STATUSES: OrderStatus[] = ['ready', 'waiting_ship', 'cod_waiting', 'cod_transferred', 'oem'];

// มาตรวัดความจุแบบวงกลม
function CapGauge({ pct, color }: { pct: number; color: string }) {
  const R = 15.5;
  const C = 2 * Math.PI * R;
  const dash = Math.min(100, pct) / 100 * C;
  return (
    <div className="cap-gauge">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={R} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} transform="rotate(-90 18 18)" />
      </svg>
      <div className="cap-gauge-val">{pct}%</div>
    </div>
  );
}

export default function Planning({
  orders,
  trips,
  drivers,
  zones,
  onAssign,
  onUnassign,
  onReorder,
  onSetTripDriver,
  onCreateTrip,
  onSetTripStatus,
  onDeleteTrip,
  onSetShipDate,
  onSetItemReadiness,
}: {
  orders: Order[];
  trips: Trip[];
  drivers: Driver[];
  zones: Zone[];
  onAssign: (orderId: number, tripId: number) => Promise<void>;
  onUnassign: (orderId: number, tripId: number) => Promise<void>;
  onReorder: (tripId: number, orderIds: number[]) => Promise<void>;
  onSetTripDriver: (tripId: number, driverId: number | null) => Promise<void>;
  onCreateTrip: (input: { driver_id: number | null; zone_id: number | null; vehicle_type: string; capacity_boxes: number; trip_date?: string }) => Promise<void>;
  onSetTripStatus: (tripId: number, status: TripStatus) => Promise<void>;
  onDeleteTrip: (tripId: number) => Promise<void>;
  onSetShipDate: (orderId: number, ship_date: string | null) => Promise<void>;
  onSetItemReadiness: (orderId: number, itemId: number, readiness: ItemReadiness) => Promise<void>;
}) {
  const assignedIds = useMemo(() => new Set(trips.flatMap((t) => t.order_ids)), [trips]);
  const unassigned = orders.filter((o) => !assignedIds.has(o.id) && WAITING_STATUSES.includes(o.status));

  // ORS ทำงานเบื้องหลัง: หาพิกัดจากที่อยู่จริง แล้วสั่ง re-render เมื่อได้ผล
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onGeoUpdate(forceRender), []);
  useEffect(() => {
    ensureGeocoded(orders.map((o) => ({ address: o.delivery_location, customer: o.customer_name })));
  }, [orders]);

  const [selectedTrip, setSelectedTrip] = useState<number>(trips[0]?.id ?? 0);
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [day, setDay] = useState<string>('all');
  const [mapTrip, setMapTrip] = useState<Trip | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [confirmDelTrip, setConfirmDelTrip] = useState<number | null>(null);
  const [planView, setPlanView] = useState<'board' | 'map'>('board');
  // ลากวาง: จำว่ากำลังลากออเดอร์ไหน มาจากเที่ยวไหน (null=จากกองรอจัด) ลำดับที่เท่าไหร่
  const [drag, setDrag] = useState<{ orderId: number; fromTrip: number | null; idx: number | null } | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null); // ไฮไลต์เป้าที่จะวาง

  // ---- ตัวกรองวัน: ใช้กับทั้งออเดอร์รอจัด + จุดส่งในเที่ยว ----
  // 'none' = ยังไม่ระบุวัน (ต้องหาให้เจอง่าย ๆ เพราะตอนนี้กำหนดวันกันที่หน้านี้)
  const dayMatch = (o: Order) => day === 'all' || (day === 'none' ? !o.ship_date : o.ship_date === day);
  const allStopsOf = (t: Trip) => t.order_ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[];
  const dayStopsOf = (t: Trip) => allStopsOf(t).filter(dayMatch); // จุดของวันที่เลือก (รวมส่งแล้ว)
  const stopsOf = (t: Trip) => dayStopsOf(t).filter((o) => o.status !== 'delivered'); // ที่ยังไม่ส่ง
  const deliveredOf = (t: Trip) => dayStopsOf(t).filter((o) => o.status === 'delivered').length;
  const usedBoxes = (t: Trip) => stopsOf(t).reduce((s, o) => s + o.box_count, 0);

  // เที่ยวรถของวันที่เลือก — วันเจาะจงเห็นเฉพาะรถของวันนั้น, 'ทุกวัน'/'ยังไม่ระบุ' เห็นทุกคัน
  const isRealDay = day !== 'all' && day !== 'none';
  const dayTrips = isRealDay ? trips.filter((t) => t.trip_date === day) : trips;
  const selTrip = dayTrips.find((t) => t.id === selectedTrip) ?? dayTrips[0];

  // ขอเส้นทางถนนจริงจาก ORS สำหรับเที่ยวที่เลือก (ทุกจุดต้องรู้พิกัดก่อน)
  useEffect(() => {
    if (!ORS_ENABLED) return;
    const t = trips.find((x) => x.id === selectedTrip);
    if (!t) return;
    const pts = stopsOf(t).map((o) => geocode(o.delivery_location, o.zone_id));
    if (pts.length && pts.every(Boolean)) ensureRoute([WAREHOUSE, ...(pts as LatLng[])]);
  });

  const isUrgent = (o: Order) => o.items.some((it) => (it.note || '').includes('ด่วน'));
  const productSummary = (o: Order) => {
    const first = o.items[0]?.product_name ?? '';
    return o.items.length > 1 ? `${first} +${o.items.length - 1} รายการ` : first;
  };

  // ---- Smart assign: เที่ยวที่แนะนำสำหรับออเดอร์ ----
  const recommendTrip = (o: Order): Trip | null => {
    const fit = dayTrips.filter((t) => t.zone_id === o.zone_id && usedBoxes(t) + o.box_count <= t.capacity_boxes);
    if (!fit.length) return null;
    const oPt = geocode(o.delivery_location, o.zone_id);
    if (!oPt) return fit[0]; // ไม่รู้พิกัด → แนะนำตามโซน/ความจุอย่างเดียว
    let best = fit[0];
    let bestD = Infinity;
    fit.forEach((t) => {
      const st = stopsOf(t);
      const lastStop = st[st.length - 1];
      const last = (st.length ? geocode(lastStop.delivery_location, lastStop.zone_id) : WAREHOUSE) ?? WAREHOUSE;
      const d = haversine(last, oPt);
      if (d < bestD) { bestD = d; best = t; }
    });
    return best;
  };

  // ---- date filter: วันจากออเดอร์รอจัด + วันของเที่ยวที่มีอยู่ ----
  const dayOptions = useMemo(() => {
    const s = new Set<string>();
    unassigned.forEach((o) => o.ship_date && s.add(o.ship_date));
    trips.forEach((t) => t.trip_date && s.add(t.trip_date));
    return Array.from(s).sort();
  }, [unassigned, trips]);
  const fmtDay = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

  // ---- distance from warehouse (null = หาพิกัดไม่ได้) ----
  const getDistance = (o: Order): number | null => {
    const pt = geocode(o.delivery_location, o.zone_id);
    if (!pt) return null;
    return Math.round(haversine(WAREHOUSE, pt) * 10) / 10;
  };

  // ---- ออเดอร์รอจัด (กรองวัน + เรียงระยะ) ----
  const filteredOrders = unassigned.filter(dayMatch);
  // จุดที่หาพิกัดไม่ได้ให้ไปท้ายรายการ (ไม่รู้ระยะ = เรียงไม่ได้)
  const shown = sortByDistance
    ? [...filteredOrders].sort((a, b) => (getDistance(a) ?? Infinity) - (getDistance(b) ?? Infinity))
    : filteredOrders;

  // ---- ความคืบหน้าการวางแผน (ตามวันที่เลือก) ----
  const scopeAssigned = dayTrips.reduce((s, t) => s + stopsOf(t).length, 0);
  const scopeTotal = scopeAssigned + filteredOrders.length;
  const progressPct = scopeTotal ? Math.round((scopeAssigned / scopeTotal) * 100) : 0;
  const dayLabel = day === 'all' ? 'ทุกวัน' : fmtDay(day);

  // ---- actions ----
  // ยืนยันก่อน "ย้ายวัน" ถ้าออเดอร์มีวันเดิมที่ไม่ตรงกับวันของเที่ยว (กันเลื่อนวันพลาด)
  const okToPlace = (o: Order | undefined, t: Trip | undefined) =>
    !(o?.ship_date && t?.trip_date && o.ship_date !== t.trip_date) ||
    window.confirm(`${o!.customer_name}\nเดิมกำหนดส่ง ${fmtDay(o!.ship_date!)}\nจะย้ายเป็น ${fmtDay(t!.trip_date)} ตามเที่ยวนี้ไหม?`);

  const assign = async (orderId: number, tripId: number) => {
    if (!tripId) return;
    if (!okToPlace(orders.find((x) => x.id === orderId), trips.find((x) => x.id === tripId))) return;
    setBusy(orderId);
    try { await onAssign(orderId, tripId); } finally { setBusy(null); }
  };
  const unassign = async (orderId: number, tripId: number) => {
    setBusy(orderId);
    try { await onUnassign(orderId, tripId); } finally { setBusy(null); }
  };

  // ---- ลากวาง (drag & drop) ----
  const dropOnTrip = async (t: Trip) => {
    const d = drag; setDrag(null); setDropHint(null);
    if (!d || d.fromTrip === t.id) return; // วางที่เที่ยวเดิม = ไม่ทำอะไร (จัดลำดับใช้การวางบนจุด)
    if (!okToPlace(orders.find((x) => x.id === d.orderId), t)) return;
    setBusy(d.orderId);
    try {
      if (d.fromTrip != null) await onUnassign(d.orderId, d.fromTrip);
      await onAssign(d.orderId, t.id); // App ตั้ง ship_date = วันของเที่ยวให้เอง
    } finally { setBusy(null); }
  };
  const dropOnDay = async (dateKey: string) => {
    const d = drag; setDrag(null); setDropHint(null);
    if (!d) return;
    const newDate = dateKey === 'none' ? null : dateKey;
    setBusy(d.orderId);
    try {
      if (d.fromTrip != null) await onUnassign(d.orderId, d.fromTrip); // เอาออกจากรถ แล้วเปลี่ยนวัน
      await onSetShipDate(d.orderId, newDate);
    } finally { setBusy(null); }
  };
  const dropOnWaiting = async () => {
    const d = drag; setDrag(null); setDropHint(null);
    if (!d || d.fromTrip == null) return;
    setBusy(d.orderId);
    try { await onUnassign(d.orderId, d.fromTrip); } finally { setBusy(null); }
  };
  // จัดอัตโนมัติทั้งหมด: กระจายออเดอร์ที่รอจัดเข้ารถที่เหมาะ (จำลองความจุก่อน)
  const autoAssignAll = async () => {
    const load: Record<number, number> = {};
    dayTrips.forEach((t) => { load[t.id] = usedBoxes(t); });
    const plan: Array<[number, number]> = [];
    for (const o of shown) {
      const fit = dayTrips.filter((t) => t.zone_id === o.zone_id && load[t.id] + o.box_count <= t.capacity_boxes);
      if (!fit.length) continue;
      fit.sort((a, b) => (b.capacity_boxes - load[b.id]) - (a.capacity_boxes - load[a.id])); // รถที่ว่างมากสุดก่อน
      const target = fit[0];
      load[target.id] += o.box_count;
      plan.push([o.id, target.id]);
    }
    if (!plan.length) return;
    setBusyAll(true);
    try { for (const [oid, tid] of plan) await onAssign(oid, tid); } finally { setBusyAll(false); }
  };
  // จัดลำดับจุดส่งให้สั้นที่สุด — เขียนกลับโดยคงลำดับจุดวันอื่นไว้
  const mergeBack = (t: Trip, reorderedDayIds: number[]) => {
    const daySet = new Set(reorderedDayIds);
    let k = 0;
    return t.order_ids.map((id) => (daySet.has(id) ? reorderedDayIds[k++] : id));
  };
  const optimize = async (t: Trip) => {
    const st = stopsOf(t);
    if (st.length < 2) return;
    const pts = st.map((o) => geocode(o.delivery_location, o.zone_id));
    // จัดลำดับไม่ได้ถ้ายังมีจุดที่หาพิกัดไม่เจอ — บอกไปตรง ๆ ดีกว่าจัดมั่ว
    if (pts.some((p) => !p)) {
      const bad = st.filter((_, i) => !pts[i]).map((o) => o.customer_name).join(', ');
      alert(`จัดลำดับไม่ได้ — หาพิกัดไม่เจอ: ${bad}\nกรุณาตรวจ/แก้ที่อยู่ของจุดนี้ก่อน`);
      return;
    }
    const known = pts as LatLng[];
    const nn = optimizeOrder(known);
    const nnKm = routePlan(nn.map((i) => known[i])).totalKm;
    const curKm = routePlan(known).totalKm;
    const bestIdx = nnKm < curKm ? nn : known.map((_, i) => i);
    await onReorder(t.id, mergeBack(t, bestIdx.map((i) => st[i].id)));
  };
  const openMaps = (t: Trip) => {
    const st = stopsOf(t);
    if (!st.length) return;
    const parts = [WAREHOUSE_ORIGIN, ...st.map((o) => `${o.delivery_location} ประเทศไทย`)];
    window.open('https://www.google.com/maps/dir/' + parts.map((p) => encodeURIComponent(p)).join('/'), '_blank');
  };
  // จัดลำดับภายในเที่ยวเดียวกัน (วางจุดบนจุด)
  const dropReorder = async (t: Trip, dropIdx: number) => {
    const d = drag; setDrag(null); setDropHint(null);
    if (!d || d.fromTrip !== t.id || d.idx == null || d.idx === dropIdx) return;
    const dayIds = stopsOf(t).map((o) => o.id);
    const [moved] = dayIds.splice(d.idx, 1);
    dayIds.splice(dropIdx, 0, moved);
    await onReorder(t.id, mergeBack(t, dayIds));
  };

  // ---- summary (ตามวันที่เลือก) ----
  const waitingBoxes = filteredOrders.reduce((s, o) => s + o.box_count, 0);
  const bkkWait = filteredOrders.filter((o) => o.zone_id === 1).length;
  const upcWait = filteredOrders.filter((o) => o.zone_id !== 1).length;
  const freeTrucks = dayTrips.filter((t) => usedBoxes(t) < t.capacity_boxes).length;

  const zoneAccent = (o: Order) => (isUrgent(o) ? '#f43f5e' : o.zone_id === 1 ? '#6366f1' : '#f59e0b');

  return (
    <>
      {/* สลับมุมมอง: กระดานจัดรถ ⟷ แผนที่ออเดอร์ */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${planView === 'board' ? ' active' : ''}`} onClick={() => setPlanView('board')}>
          <IconGrid width={16} height={16} /> จัดรถ
        </button>
        <button className={`tab${planView === 'map' ? ' active' : ''}`} onClick={() => setPlanView('map')}>
          <IconPin width={16} height={16} /> แผนที่ออเดอร์
        </button>
      </div>

      {planView === 'map' ? (
        <OrdersMapView orders={orders} zones={zones} />
      ) : (
      <>
      {/* Hero: ความคืบหน้า + จัดอัตโนมัติ */}
      <div className="plan-hero">
        <div className="plan-hero-ico"><IconRoute width={24} height={24} /></div>
        <div className="plan-hero-body">
          <div className="plan-hero-top">
            <span className="plan-hero-title">วางแผน · {dayLabel}</span>
            <span className="plan-hero-sub">จัดแล้ว {scopeAssigned} / {scopeTotal} ออเดอร์ · {progressPct}%</span>
          </div>
          <div className="plan-hero-bar"><div style={{ width: `${progressPct}%` }} /></div>
        </div>
        <button className="btn btn-primary plan-auto" disabled={busyAll || shown.length === 0} onClick={autoAssignAll} title="จัดออเดอร์ที่รอเข้ารถที่เหมาะโดยอัตโนมัติ">
          {busyAll ? 'กำลังจัด…' : `✨ จัดอัตโนมัติ (${shown.length})`}
        </button>
      </div>

      {/* สรุปภาพรวมการวางแผน */}
      <div className="plan-summary">
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#eef2ff', color: '#6366f1' }}><IconBox width={18} height={18} /></div>
          <div><div className="ps-val">{filteredOrders.length} <span>รายการ</span></div><div className="ps-label">รอจัดรถ · {waitingBoxes} กล่อง</div></div>
        </div>
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#ecfeff', color: '#0891b2' }}><IconPin width={18} height={18} /></div>
          <div><div className="ps-val">{bkkWait} <span>/ {upcWait}</span></div><div className="ps-label">กทม. / ต่างจังหวัด</div></div>
        </div>
        <div className="ps-card">
          <div className="ps-ico" style={{ background: '#dcfce7', color: '#10b981' }}><IconTruck width={18} height={18} /></div>
          <div><div className="ps-val">{freeTrucks} <span>/ {dayTrips.length} คัน</span></div><div className="ps-label">รถที่ยังรับได้</div></div>
        </div>
      </div>

      {/* ฟิลเตอร์วันกำหนดจัดส่ง + เรียงตามระยะ (ลากออเดอร์มาวางบนวัน = เปลี่ยนวันส่ง) */}
      <div className="filter-bar">
        <span className="filter-label">เลือกวันที่จะจัด:</span>
        <button className={`chip${day === 'all' ? ' active' : ''}`} onClick={() => setDay('all')}>
          ทุกวัน <span className="chip-count">{unassigned.length}</span>
        </button>
        {dayOptions.map((d) => (
          <button
            key={d}
            className={`chip${day === d ? ' active' : ''}${dropHint === `day:${d}` ? ' drop-on' : ''}${drag ? ' droppable' : ''}`}
            onClick={() => setDay(d)}
            onDragOver={(e) => { e.preventDefault(); setDropHint(`day:${d}`); }}
            onDragLeave={() => setDropHint((h) => (h === `day:${d}` ? null : h))}
            onDrop={() => dropOnDay(d)}
          >
            {fmtDay(d)} <span className="chip-count">{unassigned.filter((o) => o.ship_date === d).length}</span>
          </button>
        ))}
        <button
          className={`chip chip-nodate${day === 'none' ? ' active' : ''}${dropHint === 'day:none' ? ' drop-on' : ''}${drag ? ' droppable' : ''}`}
          onClick={() => setDay('none')}
          title="ออเดอร์ที่ยังไม่ได้กำหนดวันส่ง · ลากมาวางเพื่อล้างวัน"
          onDragOver={(e) => { e.preventDefault(); setDropHint('day:none'); }}
          onDragLeave={() => setDropHint((h) => (h === 'day:none' ? null : h))}
          onDrop={() => dropOnDay('none')}
        >
          ⚠ ยังไม่ระบุวัน <span className="chip-count">{unassigned.filter((o) => !o.ship_date).length}</span>
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-ghost xs${sortByDistance ? ' active' : ''}`}
            onClick={() => setSortByDistance(!sortByDistance)}
            title="เรียงตามระยะห่างจากคลัง"
          >
            📍 เรียงตามระยะ
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* ซ้าย: ออเดอร์รอจัดรถ */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>ออเดอร์รอจัดรถ</h3>
              <div className="sub">ลากการ์ดไปวางบนรถ (ขวา) หรือบนวัน (บน) · คลิกดูรายละเอียด</div>
            </div>
            <span className="sub">{shown.length} รายการ</span>
          </div>
          <div
            className={`card-scroll${dropHint === 'waiting' && drag?.fromTrip != null ? ' drop-on' : ''}`}
            onDragOver={(e) => { if (drag?.fromTrip != null) { e.preventDefault(); setDropHint('waiting'); } }}
            onDragLeave={() => setDropHint((h) => (h === 'waiting' ? null : h))}
            onDrop={dropOnWaiting}
          >
            {shown.length === 0 ? (
              <div className="empty-plan">
                <div className="empty-plan-ico"><IconTruck width={30} height={30} /></div>
                <div style={{ fontWeight: 600 }}>จัดครบทุกออเดอร์แล้ว 🎉</div>
                <div className="sub">ไม่มีออเดอร์รอจัดรถในวันนี้{drag?.fromTrip != null ? ' · วางที่นี่เพื่อนำออกจากรถ' : ''}</div>
              </div>
            ) : (
              shown.map((o) => {
                const rec = recommendTrip(o);
                return (
                  <div
                    key={o.id}
                    className={`wait-card${drag?.orderId === o.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => setDrag({ orderId: o.id, fromTrip: null, idx: null })}
                    onDragEnd={() => { setDrag(null); setDropHint(null); }}
                  >
                    <div className="wait-accent" style={{ background: zoneAccent(o) }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                        <code>{o.order_no}</code>
                        <span className="zone-pill">{o.zone_id === 1 ? 'กทม.' : 'ต่างจังหวัด'}</span>
                        {(() => { const rd = orderReadiness(o.items); return !rd.allReady ? <span className={`ready-badge ${rd.noneReady ? 'none' : 'some'}`}>พร้อม {rd.ready}/{rd.total}</span> : null; })()}
                        {isUrgent(o) && <span className="warn-tag urgent">🔥 ด่วน</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{o.customer_name}</div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{productSummary(o)} · {o.box_count} กล่อง</div>
                      <div className="ship-date-row" onClick={(e) => e.stopPropagation()}>
                        <span className="sdr-label">🗓 กำหนดส่ง</span>
                        <input
                          type="date"
                          className={`sdr-input${o.ship_date ? '' : ' empty'}`}
                          value={o.ship_date ?? ''}
                          onChange={(e) => onSetShipDate(o.id, e.target.value || null)}
                        />
                        {!o.ship_date && (
                          <button className="sdr-quick" onClick={() => onSetShipDate(o.id, new Date().toLocaleDateString('sv-SE'))}>วันนี้</button>
                        )}
                        {o.ship_date && (
                          <button className="sdr-clear" title="ล้างวันกำหนดส่ง" onClick={() => onSetShipDate(o.id, null)}>×</button>
                        )}
                      </div>
                      <div className="wait-meta">
                        {getDistance(o) == null
                          ? <span className="wait-chip warn" title="หาพิกัดจากที่อยู่ไม่เจอ — ตรวจการสะกดที่อยู่">📍 ไม่ทราบระยะ</span>
                          : <span className="wait-chip">📍 {getDistance(o)} กม.</span>}
                        {rec ? (
                          <span className="wait-chip rec">💡 แนะนำ {tripLabel(rec)}</span>
                        ) : (
                          <span className="wait-chip warn">⚠️ ไม่มีรถว่างพอ</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'center' }}>
                      <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={busy === o.id || !selTrip} onClick={() => selTrip && assign(o.id, selTrip.id)}>
                        {busy === o.id ? '…' : `จัดเข้า ${selTrip ? tripLabel(selTrip) : 'เที่ยว'}`}
                      </button>
                      {rec && rec.id !== selTrip?.id && (
                        <button className="btn btn-ghost mini" disabled={busy === o.id} onClick={() => assign(o.id, rec.id)}>
                          จัดตามแนะนำ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ขวา: เที่ยวรถ (ของวันที่เลือก) */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>รถออก · {dayLabel}</h3>
              <div className="sub">ลากออเดอร์มาวางบนรถ = จัดเข้าเที่ยว (ตั้งวันส่งให้อัตโนมัติ)</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowTripModal(true)}>
              <IconPlus /> สร้างเที่ยว{isRealDay ? ` (${fmtDay(day)})` : ''}
            </button>
          </div>
          <div className="card-scroll">
            {dayTrips.length === 0 && (
              <div className="empty-plan">
                <div className="empty-plan-ico"><IconTruck width={30} height={30} /></div>
                <div style={{ fontWeight: 600 }}>ยังไม่มีรถของวันนี้</div>
                <div className="sub">กด “สร้างเที่ยว” เพื่อเพิ่มรถสำหรับ {isRealDay ? fmtDay(day) : 'วันนี้'}</div>
              </div>
            )}
            {dayTrips.map((t) => {
              const stops = stopsOf(t);
              const doneCount = deliveredOf(t);
              const used = usedBoxes(t);
              const pct = Math.round((used / t.capacity_boxes) * 100);
              const over = used > t.capacity_boxes;
              const active = t.id === selTrip?.id;
              const capColor = over ? '#f43f5e' : pct > 80 ? '#f59e0b' : '#10b981';
              const plan = active ? routePlan(stops.map((o) => geocode(o.delivery_location, o.zone_id))) : null;
              const codTotal = stops.reduce((s, o) => s + o.cod_amount, 0);
              const canDrop = drag && drag.fromTrip !== t.id;
              return (
                <div
                  key={t.id}
                  className={`plan-trip${active ? ' active' : ''}${canDrop ? ' droppable' : ''}${dropHint === `trip:${t.id}` ? ' drop-on' : ''}`}
                  onClick={() => setSelectedTrip(t.id)}
                  onDragOver={(e) => { if (canDrop) { e.preventDefault(); setDropHint(`trip:${t.id}`); } }}
                  onDragLeave={() => setDropHint((h) => (h === `trip:${t.id}` ? null : h))}
                  onDrop={() => dropOnTrip(t)}
                >
                  <div className="plan-trip-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {tripLabel(t)}
                        <span className="trip-date-chip">🗓 {fmtDay(t.trip_date)}</span>
                        <span className="zone-pill">{shortZone(t.zone_name)}</span>
                      </div>
                      <div className="sub" style={{ color: '#94a3b8' }}>{t.vehicle_type}</div>
                      <div className="cap-note" style={{ color: over ? 'var(--rose)' : '#64748b' }}>
                        {used} / {t.capacity_boxes} กล่อง · {over ? `เกิน ${pct - 100}%` : `รับเพิ่มได้ ${t.capacity_boxes - used}`}
                        {doneCount > 0 && <span className="done-note"> · ✓ ส่งแล้ว {doneCount}</span>}
                      </div>
                    </div>
                    <CapGauge pct={pct} color={capColor} />
                  </div>

                  {/* toolbar: จัดลำดับ + แผนที่ + ลบ */}
                  <div className="trip-toolbar" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost xs" disabled={stops.length < 2} onClick={() => optimize(t)} title="จัดลำดับจุดส่งให้สั้นที่สุด">
                      <IconRoute width={15} height={15} /> จัดลำดับ
                    </button>
                    <button className="btn btn-primary xs" disabled={!stops.length} onClick={() => setMapTrip({ ...t, order_ids: stops.map((o) => o.id) })} title="ดูแผนที่เส้นทาง">
                      🗺️ แผนที่
                    </button>
                    <button className="btn btn-ghost xs" disabled={!stops.length} onClick={() => openMaps(t)}>Google</button>
                    {confirmDelTrip === t.id ? (
                      <>
                        <button className="btn btn-ghost xs danger" onClick={async () => { await onDeleteTrip(t.id); setConfirmDelTrip(null); }}>ยืนยันลบ</button>
                        <button className="btn btn-ghost xs" onClick={() => setConfirmDelTrip(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost xs danger" title="ลบเที่ยวรถนี้" onClick={() => setConfirmDelTrip(t.id)}>🗑️ ลบเที่ยว</button>
                    )}
                  </div>

                  {active && (
                    <>
                      {/* ไทม์ไลน์จุดส่ง (ลากวางได้) */}
                      {stops.length === 0 ? (
                        <div className="sub" style={{ color: '#94a3b8', padding: '10px 2px' }}>ยังไม่มีจุดส่งในวันนี้ — จัดออเดอร์เข้าเที่ยวนี้ได้</div>
                      ) : (
                        <div className="trip-timeline">
                          {stops.map((o, i) => {
                            const mismatch = o.zone_id !== t.zone_id;
                            return (
                              <div
                                key={o.id}
                                className={`tl-stop${drag?.orderId === o.id ? ' dragging' : ''}`}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); setDrag({ orderId: o.id, fromTrip: t.id, idx: i }); }}
                                onDragEnd={() => { setDrag(null); setDropHint(null); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => { e.stopPropagation(); if (drag?.fromTrip === t.id) dropReorder(t, i); else dropOnTrip(t); }}
                              >
                                <div className="tl-dot">{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setDetail(o)}>
                                  <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {o.customer_name}
                                    <input
                                      type="date"
                                      className={`stop-date-input${o.ship_date ? '' : ' empty'}`}
                                      value={o.ship_date ?? ''}
                                      title="กำหนดวันจัดส่ง"
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => { e.stopPropagation(); onSetShipDate(o.id, e.target.value || null); }}
                                    />
                                    {mismatch && <span className="warn-tag zone">⚠️ ผิดโซน</span>}
                                    {isUrgent(o) && <span className="warn-tag urgent">🔥</span>}
                                  </div>
                                  <div className="sub" style={{ color: '#94a3b8' }}>{o.delivery_location} · {o.box_count} กล่อง</div>
                                  {plan && (
                                    plan.legs[i].km == null
                                      ? <div className="stop-eta warn">⚠ หาพิกัดไม่เจอ — ตรวจที่อยู่</div>
                                      : <div className="stop-eta">
                                          ระยะ {plan.legs[i].km} กม.{plan.source === 'estimate' ? ' (ประมาณ)' : ''}
                                          {cachedCoords(o.delivery_location)?.precision === 'province' && (
                                            <span className="warn" title="ระบุได้แค่ระดับจังหวัด — ระยะอาจคลาดเคลื่อนหลายสิบ กม."> · ⚠ ตำแหน่งหยาบ (ระดับจังหวัด)</span>
                                          )}
                                        </div>
                                  )}
                                </div>
                                <button className="stop-remove" title="นำออกจากเที่ยว" disabled={busy === o.id} onClick={(e) => { e.stopPropagation(); unassign(o.id, t.id); }}>×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* manifest */}
                      <div className="manifest">
                        <span>
                          รวม <b>{used}</b> กล่อง · <b>{stops.length}</b> จุด
                          {plan && stops.length > 0 && (
                            <> · ระยะ {plan.source === 'ors' ? <><b>{plan.totalKm}</b> กม.</> : <>~<b>{plan.totalKm}</b> กม. (ประมาณ)</>}</>
                          )}
                        </span>
                        <span>COD รวม <b>฿{codTotal.toLocaleString()}</b></span>
                      </div>
                      {plan && plan.unknown > 0 && (
                        <div className="route-warn">
                          ⚠ มี {plan.unknown} จุดที่หาพิกัดจากที่อยู่ไม่เจอ — ระยะรวมยังไม่นับจุดเหล่านี้ กรุณาตรวจ/แก้ที่อยู่
                        </div>
                      )}
                      {plan && plan.source === 'estimate' && plan.unknown === 0 && !ORS_ENABLED && (
                        <div className="route-note">
                          ℹ️ ระยะเป็น<b>ค่าประมาณ</b> (เส้นตรง×1.3) — ใส่ ORS API key เพื่อใช้ระยะถนนจริง
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      <OrderDetail order={detail ? orders.find((o) => o.id === detail.id) ?? detail : null} onClose={() => setDetail(null)} onSetItemReadiness={onSetItemReadiness} />

      {mapTrip && <MapModal orders={orders} trip={mapTrip} onClose={() => setMapTrip(null)} />}

      {showTripModal && (
        <TripModal
          drivers={drivers}
          zones={zones}
          onClose={() => setShowTripModal(false)}
          onCreate={async (input) => {
            const trip_date = isRealDay ? day : new Date().toLocaleDateString('sv-SE');
            await onCreateTrip({ ...input, trip_date });
            setShowTripModal(false);
          }}
        />
      )}
    </>
  );
}
