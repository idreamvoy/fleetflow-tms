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
import { IconGrid, IconCalendar } from './components/icons';
import { db, IS_SUPABASE_CONFIGURED } from './lib/supabase';
import type { Order, Zone, Driver, Trip, StatusMovement, NewOrder, OrderStatus } from './lib/types';

const PAGE_META: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'ภาพรวมระบบ', subtitle: 'Dashboard · ศูนย์ควบคุมการจัดส่ง' },
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [o, z, d, t, m] = await Promise.all([
      db.getOrders(), db.getZones(), db.getDrivers(), db.getTrips(), db.getMovements(),
    ]);
    setOrders(o);
    setZones(z);
    setDrivers(d);
    setTrips(t);
    setMovements(m);
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

  async function handleAddOrder(o: NewOrder) {
    await db.addOrder(o);
    await loadAll();
    setShowModal(false);
    flash('เพิ่มออเดอร์สำเร็จ ✓');
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

  async function handleAddItem(id: number) {
    await db.addOrderItem(id, { collection: 'Hotel Premium', product_name: 'ผ้าปูที่นอน 6 ฟุต', qty: 24, pieces_per_box: 6 });
    await loadAll();
    flash('เพิ่มรายการสินค้าแล้ว ✓');
  }

  async function handleAssign(orderId: number, tripId: number) {
    await db.assignOrderToTrip(orderId, tripId);
    await loadAll();
    flash(`จัดเข้าเที่ยว TR-${String(tripId).padStart(2, '0')} แล้ว ✓`);
  }

  async function handlePod(order: Order, status: OrderStatus, note: string, driverName: string) {
    await db.recordStatus(order, status, note, driverName);
    await loadAll();
    flash(status === 'delivered' ? 'บันทึกส่งสำเร็จ ✓' : 'บันทึกส่งไม่สำเร็จ');
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
          onImport={() => flash('นำเข้า Excel — เชื่อมต่อไฟล์จริงได้ในขั้นถัดไป')}
          onMenu={() => setNavOpen((v) => !v)}
          search={search}
          onSearch={setSearch}
        />

        <div className="content">
          {page === 'dashboard' && (
            <div className="tabs">
              <button className="tab active"><IconGrid width={16} height={16} /> สรุปภาพรวม</button>
              <button className="tab"><IconCalendar width={16} height={16} /> ปฏิทินจัดส่ง</button>
            </div>
          )}

          {loading ? (
            <div className="card"><div className="loading">กำลังโหลดข้อมูล…</div></div>
          ) : page === 'dashboard' ? (
            <Dashboard orders={orders} zones={zones} />
          ) : page === 'orders' ? (
            <Orders orders={filteredOrders} onAdd={() => setShowModal(true)} onStatusChange={handleStatusChange} onDelete={handleDelete} onAddItem={handleAddItem} />
          ) : page === 'planning' ? (
            <Planning orders={orders} trips={trips} onAssign={handleAssign} />
          ) : page === 'tracking' ? (
            <Tracking trips={trips} orders={orders} />
          ) : page === 'driver' ? (
            <DriverApp drivers={drivers} trips={trips} orders={orders} onPod={handlePod} />
          ) : (
            <Reports orders={orders} movements={movements} />
          )}
        </div>
      </div>

      {showModal && <OrderModal zones={zones} onClose={() => setShowModal(false)} onSave={handleAddOrder} />}

      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 50 }}>
        <span className={`conn ${IS_SUPABASE_CONFIGURED ? 'live' : 'demo'}`}>
          ● {IS_SUPABASE_CONFIGURED ? 'Live Database' : 'Demo Mode'}
        </span>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
