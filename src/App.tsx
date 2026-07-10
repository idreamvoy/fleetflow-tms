import { useEffect, useMemo, useState } from 'react';
import Sidebar, { type PageKey } from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Planning from './pages/Planning';
import Tracking from './pages/Tracking';
import DriverApp from './pages/DriverApp';
import Reports from './pages/Reports';
import OrderModal from './components/OrderModal';
import PodModal from './components/PodModal';
import ImportModal from './components/ImportModal';
import { db, IS_SUPABASE_CONFIGURED } from './lib/supabase';
import type { Order, Zone, Driver, Trip, StatusMovement, StatusEvent, NewOrder, OrderStatus, PodInput } from './lib/types';

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'ภาพรวมระบบ · ศูนย์ควบคุมการจัดส่ง' },
  planning: { title: 'วางแผนจัดส่ง', subtitle: 'Planning · จัดรถและเส้นทาง' },
  orders: { title: 'จัดการออเดอร์', subtitle: 'Orders · คีย์ออเดอร์ ดูรายละเอียด เปลี่ยนสถานะ' },
  driver: { title: 'Driver App', subtitle: 'งานของคนขับ · เลือกวัน นำทาง และยืนยันการส่ง' },
  tracking: { title: 'ติดตามเส้นทาง', subtitle: 'Tracking · แผนที่และสถานะรถ' },
  reports: { title: 'รายงาน', subtitle: 'Reports · สรุปผลการดำเนินงาน' },
};

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [movements, setMovements] = useState<StatusMovement[]>([]);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [podTarget, setPodTarget] = useState<{ order: Order; trip: Trip } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [o, z, d, t, m, h] = await Promise.all([
      db.getOrders(), db.getZones(), db.getDrivers(), db.getTrips(), db.getMovements(), db.getHistory(),
    ]);
    setOrders(o);
    setZones(z);
    setDrivers(d);
    setTrips(t);
    setMovements(m);
    setHistory(h);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function navigate(k: PageKey) {
    setPage(k);
    setNavOpen(false);
  }

  function openAdd() {
    setEditingOrder(null);
    setShowModal(true);
  }
  function openEdit(order: Order) {
    setEditingOrder(order);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setEditingOrder(null);
  }

  async function handleSaveOrder(o: NewOrder) {
    if (editingOrder) {
      await db.updateOrder(editingOrder.id, o);
      await loadAll();
      closeModal();
      flash('บันทึกการแก้ไขแล้ว ✓');
    } else {
      await db.addOrder(o);
      await loadAll();
      closeModal();
      flash('เพิ่มออเดอร์สำเร็จ ✓');
    }
  }

  async function handleImportOrders(newOrders: NewOrder[]) {
    let ok = 0;
    for (const o of newOrders) {
      try { await db.addOrder(o); ok++; } catch (e) { console.error('import order', o.order_no, e); }
    }
    await loadAll();
    setShowImport(false);
    flash(ok === newOrders.length ? `นำเข้า ${ok} ออเดอร์สำเร็จ ✓` : `นำเข้าสำเร็จ ${ok}/${newOrders.length} ออเดอร์`);
  }

  async function handleStatusChange(id: number, status: OrderStatus) {
    await db.updateOrderStatus(id, status);
    setOrders((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    flash('อัปเดตสถานะแล้ว ✓');
  }

  async function handleDelete(id: number) {
    await db.deleteOrder(id);
    setOrders((prev) => prev.filter((x) => x.id !== id));
    flash('ลบใบสั่งขายแล้ว');
  }

  async function handleAssign(orderId: number, tripId: number) {
    await db.assignOrderToTrip(orderId, tripId);
    await loadAll();
    flash(`จัดเข้าเที่ยว TR-${String(tripId).padStart(2, '0')} แล้ว ✓`);
  }

  async function handleUnassign(orderId: number, tripId: number) {
    await db.unassignOrderFromTrip(orderId, tripId);
    await loadAll();
    flash(`นำออกจาก TR-${String(tripId).padStart(2, '0')} แล้ว · กลับไปรอจัดรถ`);
  }

  async function handleReorder(tripId: number, orderIds: number[]) {
    await db.reorderTripStops(tripId, orderIds);
    await loadAll();
    flash(`จัดลำดับจุดส่ง TR-${String(tripId).padStart(2, '0')} แล้ว ✓`);
  }

  function openPod(order: Order, trip: Trip) {
    setPodTarget({ order, trip });
  }
  async function handleRecordDelivery(input: PodInput) {
    await db.recordDelivery(input);
    await loadAll();
    const label = input.overall_status === 'delivered' ? 'ส่งสำเร็จ' : input.overall_status === 'partial' ? 'ส่งบางส่วน' : 'ค้างส่ง';
    flash(`บันทึกการส่ง ${input.order.order_no} · ${label} ✓`);
  }

  const onlineDrivers = drivers.filter((d) => d.is_online).length;

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_no.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.delivery_location ?? '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  const meta = PAGE_META[page];

  return (
    <div className="app">
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <div className={navOpen ? 'sidebar-host open' : 'sidebar-host'}>
        <Sidebar active={page} onNavigate={navigate} onlineDrivers={onlineDrivers} />
      </div>

      <div className="main">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onImport={() => setShowImport(true)}
          onMenu={() => setNavOpen((v) => !v)}
          search={search}
          onSearch={setSearch}
        />

        <div className="content">
          {loading ? (
            <div className="card"><div className="loading">กำลังโหลดข้อมูล…</div></div>
          ) : page === 'dashboard' ? (
            <Dashboard orders={orders} zones={zones} />
          ) : page === 'orders' ? (
            <Orders orders={filteredOrders} onAdd={openAdd} onImport={() => setShowImport(true)} onEdit={openEdit} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          ) : page === 'planning' ? (
            <Planning orders={orders} trips={trips} onAssign={handleAssign} onUnassign={handleUnassign} onReorder={handleReorder} />
          ) : page === 'tracking' ? (
            <Tracking trips={trips} orders={orders} />
          ) : page === 'driver' ? (
            <DriverApp drivers={drivers} trips={trips} orders={orders} onOpenPod={openPod} />
          ) : (
            <Reports orders={orders} movements={movements} drivers={drivers} trips={trips} history={history} />
          )}
        </div>
      </div>

      {showModal && <OrderModal zones={zones} order={editingOrder} onClose={closeModal} onSave={handleSaveOrder} />}

      {showImport && <ImportModal zones={zones} onClose={() => setShowImport(false)} onImport={handleImportOrders} />}

      {podTarget && (
        <PodModal
          order={podTarget.order}
          driverId={podTarget.trip.driver_id}
          driverName={podTarget.trip.driver_name ?? drivers.find((d) => d.id === podTarget.trip.driver_id)?.name ?? ''}
          onClose={() => setPodTarget(null)}
          onSave={handleRecordDelivery}
        />
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 50 }}>
        <span className={`conn ${IS_SUPABASE_CONFIGURED ? 'live' : 'demo'}`}>
          ● {IS_SUPABASE_CONFIGURED ? 'Live Database' : 'Demo Mode'}
        </span>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
