// ============================================================
// FleetFlow TMS - Supabase client + data layer (with demo fallback)
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Order,
  OrderItem,
  NewOrder,
  Zone,
  Driver,
  Trip as TripT,
  StatusEvent as StatusEventT,
  DashboardStats,
  StatusBreakdown,
  ZoneSummary,
  Trip,
  TripStatus,
  StatusEvent,
  StatusMovement,
  ReportSummary,
  OrderStatus,
  Collection,
  PodInput,
  DriverPerformance,
} from './types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const IS_SUPABASE_CONFIGURED =
  !!URL &&
  !!KEY &&
  URL !== 'YOUR_SUPABASE_URL_HERE' &&
  KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE';

export const supabase: SupabaseClient | null = IS_SUPABASE_CONFIGURED
  ? createClient(URL as string, KEY as string)
  : null;

export const DEMO_ZONES: Zone[] = [
  { id: 1, name: 'กรุงเทพฯ & ปริมณฑล', color: '#6366f1' },
  { id: 2, name: 'ต่างจังหวัด', color: '#f59e0b' },
];

export const DEMO_DRIVERS: Driver[] = [
  { id: 1, name: 'สมชาย ก.', phone: '081-111-1111', vehicle: 'บม-1234', is_online: true },
  { id: 2, name: 'วิรัช ม.', phone: '082-222-2222', vehicle: 'ผก-8890', is_online: true },
  { id: 3, name: 'ธนา พ.', phone: '083-333-3333', vehicle: 'งก-4471', is_online: false },
  { id: 4, name: 'ประยุทธ ส.', phone: '084-444-4444', vehicle: 'สค-2210', is_online: false },
];

// ---------- แหล่งข้อมูลจำลอง (โรงแรม/โรงพยาบาล + สินค้าผ้า) ----------
const HOTELS = [
  'โรงแรมดุสิตธานี', 'โรงแรมเดอะสุโกศล', 'โรงแรมแมนดาริน โอเรียนเต็ล', 'โรงแรมเซ็นทาราแกรนด์',
  'โรงแรมอนันตรา สยาม', 'โรงแรมแชงกรี-ลา', 'โรงแรมเลอ เมอริเดียน', 'โรงแรมพูลแมน',
];
const HOSPITALS = [
  'รพ.บำรุงราษฎร์', 'รพ.ศิริราช', 'รพ.กรุงเทพ', 'รพ.รามาธิบดี', 'รพ.สมิติเวช', 'รพ.พระราม 9',
];
const PRODUCTS: Record<Collection, string[]> = {
  'Hotel Premium': ['ผ้าปูที่นอน 6 ฟุต', 'ผ้าปูที่นอน 5 ฟุต', 'ผ้าคลุมเตียง'],
  'Spa & Bath': ['ผ้าเช็ดตัว 27x54', 'ผ้าเช็ดหน้า 13x13', 'เสื้อคลุมอาบน้ำ'],
  'Banquet Line': ['ผ้าปูโต๊ะกลม', 'ผ้าแนพกิ้น', 'ผ้าคลุมเก้าอี้'],
  'Housekeeping': ['ปลอกหมอน', 'ผ้าห่มนาโน', 'ผ้ารองกันเปื้อน'],
  'Medical Care': ['ชุดผู้ป่วย ไซส์ L', 'ชุดผู้ป่วย ไซส์ M', 'เสื้อกาวน์แพทย์'],
  'Patient Series': ['ผ้าห่มผู้ป่วย', 'ปลอกหมอนกันน้ำ', 'ผ้ารองเตียงผู้ป่วย'],
};
const LOCATIONS_BKK = [
  '88/8 หมู่ 7 ต.วัดจันทร์ อ.เมืองพิษณุโลก', '33 ถ.สุขุมวิท ซ.3 แขวงคลองเตยเหนือ เขตวัฒนา กทม.',
  'ราชเทวี กทม.', '999 ถ.พระราม 1 เขตปทุมวัน กทม.', 'ถ.เจริญกรุง เขตบางรัก กทม.',
];
const LOCATIONS_UPC = [
  'อ.เมือง เชียงใหม่', 'อ.หาดใหญ่ สงขลา', 'อ.เมือง ขอนแก่น', 'อ.เมือง ภูเก็ต', 'อ.ศรีราชา ชลบุรี',
];
const ALL_STATUS: OrderStatus[] = [
  'ready', 'ready', 'waiting_ship', 'waiting_ship', 'failed', 'failed',
  'cod_waiting', 'cod_waiting', 'cod_waiting', 'cod_transferred', 'cod_transferred', 'oem',
  'delivered', 'unspecified', 'ready', 'cod_waiting', 'waiting_ship', 'cod_transferred',
  'failed', 'delivered', 'ready',
];

function boxesFor(qty: number, per: number) {
  return Math.max(1, Math.ceil(qty / per));
}

function seedOrders(): Order[] {
  const collections = Object.keys(PRODUCTS) as Collection[];
  return ALL_STATUS.map((status, i) => {
    const isHotel = i % 3 !== 2; // ~2/3 โรงแรม
    const shipping_method = i < 12 ? 'company' : 'shipping'; // 12 บริษัท / 9 ขนส่ง
    const zoneId = shipping_method === 'company' ? (i % 4 === 3 ? 2 : 1) : (i % 3 === 0 ? 1 : 2);
    // 1-2 line items
    const nItems = (i % 2) + 1;
    const items: OrderItem[] = Array.from({ length: nItems }).map((_, j) => {
      const col = collections[(i + j) % collections.length];
      const prodList = PRODUCTS[col];
      const qty = [24, 20, 44, 38, 60, 16][(i + j) % 6];
      const per = [6, 4, 5, 10][(i + j) % 4];
      return {
        id: i * 10 + j + 1,
        collection: col,
        product_name: prodList[(i + j) % prodList.length],
        qty,
        pieces_per_box: per,
        boxes: boxesFor(qty, per),
        note: j === 0 && i % 5 === 0 ? 'ด่วน' : '',
      };
    });
    const box_count = items.reduce((s, it) => s + it.boxes, 0);
    return {
      id: i + 1,
      order_no: `SO-6907-${String(i + 1).padStart(3, '0')}`,
      customer_type: isHotel ? 'hotel' : 'hospital',
      customer_name: isHotel ? HOTELS[i % HOTELS.length] : HOSPITALS[i % HOSPITALS.length],
      delivery_location: zoneId === 1 ? LOCATIONS_BKK[i % LOCATIONS_BKK.length] : LOCATIONS_UPC[i % LOCATIONS_UPC.length],
      shipping_method,
      zone_id: zoneId,
      zone_name: zoneId === 1 ? 'กรุงเทพฯ & ปริมณฑล' : 'ต่างจังหวัด',
      status,
      cod_amount: status === 'cod_waiting' || status === 'cod_transferred' ? (i + 1) * 850 : 0,
      ship_date: new Date().toISOString().slice(0, 10),
      items,
      box_count,
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
    };
  });
}

let demoOrders: Order[] = seedOrders();

function seedTrips(): Trip[] {
  const today = new Date().toISOString().slice(0, 10);
  const ts = new Date().toISOString();
  return [
    { id: 1, trip_date: today, driver_id: 1, driver_name: 'สมชาย ก.', zone_id: 1, zone_name: 'กรุงเทพฯ & ปริมณฑล', status: 'in_progress', vehicle_type: 'รถ 4 ล้อ', capacity_boxes: 120, distance_km: 42.5, progress: 62, eta: '12:10', order_ids: [1, 2, 3], created_at: ts },
    { id: 2, trip_date: today, driver_id: 2, driver_name: 'วิรัช ม.', zone_id: 2, zone_name: 'ต่างจังหวัด', status: 'in_progress', vehicle_type: 'รถ 6 ล้อ', capacity_boxes: 250, distance_km: 128.0, progress: 34, eta: '16:40', order_ids: [13, 14], created_at: ts },
    { id: 3, trip_date: today, driver_id: 3, driver_name: 'ธนา พ.', zone_id: 1, zone_name: 'กรุงเทพฯ & ปริมณฑล', status: 'assigned', vehicle_type: 'รถ 4 ล้อ', capacity_boxes: 120, distance_km: 30.0, progress: 0, eta: 'พรุ่งนี้', order_ids: [4, 5], created_at: ts },
    { id: 4, trip_date: today, driver_id: 4, driver_name: 'ประยุทธ ส.', zone_id: 2, zone_name: 'ต่างจังหวัด', status: 'planning', vehicle_type: 'รถ 6 ล้อ', capacity_boxes: 250, distance_km: 95.0, progress: 0, eta: 'พรุ่งนี้', order_ids: [15, 16], created_at: ts },
  ];
}
let demoTrips: Trip[] = seedTrips();
let historyId = 1;

// เดโม: จำลองการส่งสำเร็จ/บางส่วน + หลักฐาน POD (ให้หน้ารายงานมีข้อมูล)
function seedPodDemo(): StatusEvent[] {
  const now = Date.now();
  const recs: Array<[number, OrderStatus, number, number, number]> = [
    // [orderId, status, driverId, minsAgo, codCollected]
    [1, 'delivered', 1, 40, 0],
    [2, 'delivered', 1, 95, 0],
    [3, 'partial', 1, 130, 4200],
    [13, 'delivered', 2, 60, 0],
    [14, 'failed', 2, 150, 0],
    [4, 'delivered', 3, 55, 3800],
    [5, 'delivered', 3, 120, 0],
  ];
  const byId = new Map(demoOrders.map((o) => [o.id, o]));
  return recs.map(([oid, status, did, mins, cod], i) => {
    const o = byId.get(oid);
    if (o) o.status = status;
    return {
      id: 1000 + i, order_id: oid, order_no: o?.order_no ?? `#${oid}`, status,
      note: status === 'partial' ? 'ส่งได้บางส่วน · ที่เหลือตีกลับ' : status === 'failed' ? 'ลูกค้าไม่รับสาย' : 'ส่งครบ',
      driver_id: did, by_driver: DEMO_DRIVERS.find((d) => d.id === did)?.name ?? null,
      photo_url: status !== 'failed' ? 'demo' : null, signature_url: status === 'delivered' ? 'demo' : null,
      cod_collected: cod, created_at: new Date(now - mins * 60000).toISOString(),
    };
  });
}
let demoHistory: StatusEvent[] = seedPodDemo();

// บันทึกความเคลื่อนไหวสถานะตัวอย่าง (หน้ารายงาน)
const demoMovements: StatusMovement[] = [
  { id: 1, time: '10:05', order_no: 'SO-6907-011', from_label: 'กำลังส่ง', to_label: 'ส่งสำเร็จ', by: 'สมชาย ก.' },
  { id: 2, time: '09:40', order_no: 'SO-6907-005', from_label: 'พร้อมส่ง', to_label: 'กำลังส่ง', by: 'วิรัช ม.' },
  { id: 3, time: '09:15', order_no: 'SO-6907-007', from_label: 'พร้อมส่ง', to_label: 'รอส่ง', by: 'ธนา พ.' },
  { id: 4, time: '09:12', order_no: 'SO-6907-005', from_label: 'กำหนดส่ง', to_label: 'ค้างส่ง', by: 'ระบบ' },
  { id: 5, time: '08:50', order_no: 'SO-6907-003', from_label: 'พร้อมส่ง', to_label: 'รอโอน', by: 'ผู้จัดการ' },
  { id: 6, time: '08:20', order_no: 'SO-6907-006', from_label: 'รับเข้า', to_label: 'พร้อมส่ง', by: 'คลังสินค้า' },
  { id: 7, time: '08:05', order_no: 'SO-6907-012', from_label: 'รับเข้า', to_label: 'OEM', by: 'ระบบ' },
  { id: 8, time: '07:50', order_no: 'SO-6907-001', from_label: 'รับเข้า', to_label: 'พร้อมส่ง', by: 'คลังสินค้า' },
];

function estimateDistance(orderCount: number, zoneId: number | null): number {
  const perStop = zoneId === 2 ? 45 : 12;
  return Math.round((8 + orderCount * perStop) * 10) / 10;
}

// ============================================================
// Data API
// ============================================================
export const db = {
  async getZones(): Promise<Zone[]> {
    if (!supabase) return DEMO_ZONES;
    const { data, error } = await supabase.from('zones').select('*').order('id');
    if (error) { console.error('getZones', error); return DEMO_ZONES; }
    return data as Zone[];
  },

  async getDrivers(): Promise<Driver[]> {
    if (!supabase) return DEMO_DRIVERS;
    const { data, error } = await supabase.from('drivers').select('*').order('id');
    if (error) { console.error('getDrivers', error); return DEMO_DRIVERS; }
    return data as Driver[];
  },

  async getOrders(): Promise<Order[]> {
    if (!supabase) return demoOrders.map((o) => ({ ...o }));
    const { data, error } = await supabase
      .from('orders')
      .select('*, zones(name), order_items(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('getOrders', error); return demoOrders.map((o) => ({ ...o })); }
    return (data as any[]).map((o) => {
      const items: OrderItem[] = (o.order_items ?? []).map((it: any) => ({
        ...it, boxes: it.boxes ?? boxesFor(it.qty, it.pieces_per_box || 1),
      }));
      return {
        ...o,
        zone_name: o.zones?.name ?? null,
        items,
        box_count: items.reduce((s, it) => s + it.boxes, 0),
      } as Order;
    });
  },

  async addOrder(input: NewOrder): Promise<Order> {
    const items: OrderItem[] = input.items.map((it, j) => ({
      id: Date.now() + j,
      collection: it.collection,
      product_name: it.product_name,
      qty: it.qty,
      pieces_per_box: it.pieces_per_box,
      boxes: boxesFor(it.qty, it.pieces_per_box),
      note: it.note ?? '',
    }));
    const box_count = items.reduce((s, it) => s + it.boxes, 0);
    if (!supabase) {
      const zone = DEMO_ZONES.find((z) => z.id === input.zone_id) ?? null;
      const order: Order = {
        id: Math.max(0, ...demoOrders.map((o) => o.id)) + 1,
        order_no: input.order_no,
        customer_type: input.customer_type,
        customer_name: input.customer_name,
        delivery_location: input.delivery_location ?? '',
        shipping_method: input.shipping_method,
        zone_id: input.zone_id ?? null,
        zone_name: zone?.name ?? null,
        status: input.status ?? 'unspecified',
        cod_amount: input.cod_amount ?? 0,
        ship_date: input.ship_date ?? new Date().toISOString().slice(0, 10),
        items,
        box_count,
        created_at: new Date().toISOString(),
      };
      demoOrders = [order, ...demoOrders];
      return order;
    }
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_no: input.order_no, customer_type: input.customer_type, customer_name: input.customer_name,
        delivery_location: input.delivery_location, shipping_method: input.shipping_method,
        zone_id: input.zone_id, status: input.status ?? 'unspecified', cod_amount: input.cod_amount ?? 0,
        ship_date: input.ship_date,
      })
      .select().single();
    if (error) throw error;
    if (items.length) {
      await supabase.from('order_items').insert(
        items.map((it) => ({
          order_id: (order as any).id, collection: it.collection, product_name: it.product_name,
          qty: it.qty, pieces_per_box: it.pieces_per_box, boxes: it.boxes, note: it.note,
        }))
      );
    }
    return { ...(order as any), items, box_count } as Order;
  },

  async updateOrder(id: number, input: NewOrder): Promise<void> {
    const items: OrderItem[] = input.items.map((it, j) => ({
      id: Date.now() + j,
      collection: it.collection,
      product_name: it.product_name,
      qty: it.qty,
      pieces_per_box: it.pieces_per_box,
      boxes: boxesFor(it.qty, it.pieces_per_box),
      note: it.note ?? '',
    }));
    const box_count = items.reduce((s, it) => s + it.boxes, 0);
    if (!supabase) {
      const zone = DEMO_ZONES.find((z) => z.id === input.zone_id) ?? null;
      demoOrders = demoOrders.map((o) =>
        o.id === id
          ? {
              ...o,
              order_no: input.order_no,
              customer_type: input.customer_type,
              customer_name: input.customer_name,
              delivery_location: input.delivery_location ?? o.delivery_location,
              shipping_method: input.shipping_method,
              zone_id: input.zone_id ?? null,
              zone_name: zone?.name ?? o.zone_name,
              status: input.status ?? o.status,
              cod_amount: input.cod_amount ?? 0,
              items,
              box_count,
            }
          : o
      );
      return;
    }
    const { error } = await supabase
      .from('orders')
      .update({
        order_no: input.order_no, customer_type: input.customer_type, customer_name: input.customer_name,
        delivery_location: input.delivery_location, shipping_method: input.shipping_method,
        zone_id: input.zone_id, status: input.status, cod_amount: input.cod_amount ?? 0,
      })
      .eq('id', id);
    if (error) throw error;
    await supabase.from('order_items').delete().eq('order_id', id);
    if (items.length) {
      await supabase.from('order_items').insert(
        items.map((it) => ({
          order_id: id, collection: it.collection, product_name: it.product_name,
          qty: it.qty, pieces_per_box: it.pieces_per_box, boxes: it.boxes, note: it.note,
        }))
      );
    }
  },

  async updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
    if (!supabase) {
      demoOrders = demoOrders.map((o) => (o.id === id ? { ...o, status } : o));
      return;
    }
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) throw error;
  },

  async deleteOrder(id: number): Promise<void> {
    if (!supabase) {
      demoOrders = demoOrders.filter((o) => o.id !== id);
      return;
    }
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
  },

  async addOrderItem(orderId: number, item: { collection: Collection; product_name: string; qty: number; pieces_per_box: number }): Promise<void> {
    const boxes = boxesFor(item.qty, item.pieces_per_box);
    if (!supabase) {
      demoOrders = demoOrders.map((o) => {
        if (o.id !== orderId) return o;
        const newItem: OrderItem = { id: Date.now(), ...item, boxes, note: '' };
        const items = [...o.items, newItem];
        return { ...o, items, box_count: items.reduce((s, it) => s + it.boxes, 0) };
      });
      return;
    }
    const { error } = await supabase.from('order_items').insert({ order_id: orderId, ...item, boxes });
    if (error) throw error;
  },

  // ---------- Trips ----------
  async getTrips(): Promise<Trip[]> {
    if (!supabase) return demoTrips.map((t) => ({ ...t }));
    const { data, error } = await supabase
      .from('trips')
      .select('*, drivers(name), zones(name), trip_stops(order_id, seq)')
      .order('id');
    if (error) { console.error('getTrips', error); return demoTrips.map((t) => ({ ...t })); }
    return (data as any[]).map((t) => ({
      ...t,
      driver_name: t.drivers?.name ?? null,
      zone_name: t.zones?.name ?? null,
      order_ids: (t.trip_stops ?? []).sort((a: any, b: any) => a.seq - b.seq).map((s: any) => s.order_id),
    })) as Trip[];
  },

  async createTrip(input: { driver_id: number | null; zone_id: number | null; order_ids: number[] }): Promise<Trip> {
    const distance = estimateDistance(input.order_ids.length, input.zone_id);
    if (!supabase) {
      const driver = DEMO_DRIVERS.find((d) => d.id === input.driver_id) ?? null;
      const zone = DEMO_ZONES.find((z) => z.id === input.zone_id) ?? null;
      const trip: Trip = {
        id: Math.max(0, ...demoTrips.map((t) => t.id)) + 1,
        trip_date: new Date().toISOString().slice(0, 10),
        driver_id: input.driver_id, driver_name: driver?.name ?? null,
        zone_id: input.zone_id, zone_name: zone?.name ?? null,
        status: input.driver_id ? 'assigned' : 'planning',
        vehicle_type: 'รถ 4 ล้อ', capacity_boxes: 120, progress: 0, eta: 'พรุ่งนี้',
        distance_km: distance, order_ids: input.order_ids, created_at: new Date().toISOString(),
      };
      demoTrips = [...demoTrips, trip];
      demoOrders = demoOrders.map((o) =>
        input.order_ids.includes(o.id) ? { ...o, status: 'waiting_ship' as OrderStatus } : o
      );
      return trip;
    }
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({ trip_date: new Date().toISOString().slice(0, 10), driver_id: input.driver_id, zone_id: input.zone_id, status: input.driver_id ? 'assigned' : 'planning', distance_km: distance })
      .select().single();
    if (error) throw error;
    if (input.order_ids.length) {
      await supabase.from('trip_stops').insert(input.order_ids.map((oid, i) => ({ trip_id: (trip as any).id, order_id: oid, seq: i })));
      await supabase.from('orders').update({ status: 'waiting_ship' }).in('id', input.order_ids);
    }
    return { ...(trip as any), order_ids: input.order_ids } as Trip;
  },

  async updateTripStatus(id: number, status: TripStatus): Promise<void> {
    if (!supabase) { demoTrips = demoTrips.map((t) => (t.id === id ? { ...t, status } : t)); return; }
    const { error } = await supabase.from('trips').update({ status }).eq('id', id);
    if (error) throw error;
  },

  // จัดออเดอร์เข้าเที่ยว
  async assignOrderToTrip(orderId: number, tripId: number): Promise<void> {
    if (!supabase) {
      demoTrips = demoTrips.map((t) =>
        t.id === tripId && !t.order_ids.includes(orderId) ? { ...t, order_ids: [...t.order_ids, orderId] } : t
      );
      demoOrders = demoOrders.map((o) => (o.id === orderId ? { ...o, status: 'waiting_ship' as OrderStatus } : o));
      return;
    }
    const trip = (await this.getTrips()).find((t) => t.id === tripId);
    const seq = trip ? trip.order_ids.length : 0;
    await supabase.from('trip_stops').insert({ trip_id: tripId, order_id: orderId, seq });
    await supabase.from('orders').update({ status: 'waiting_ship' }).eq('id', orderId);
  },

  // นำออเดอร์ออกจากเที่ยว (ยกเลิกการจัดรถ)
  async unassignOrderFromTrip(orderId: number, tripId: number): Promise<void> {
    if (!supabase) {
      demoTrips = demoTrips.map((t) => (t.id === tripId ? { ...t, order_ids: t.order_ids.filter((id) => id !== orderId) } : t));
      demoOrders = demoOrders.map((o) => (o.id === orderId ? { ...o, status: 'ready' as OrderStatus } : o));
      return;
    }
    await supabase.from('trip_stops').delete().eq('trip_id', tripId).eq('order_id', orderId);
    await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId);
  },

  // บันทึกลำดับจุดส่งใหม่ (จัดลำดับอัตโนมัติ / ลากวาง)
  async reorderTripStops(tripId: number, orderIds: number[]): Promise<void> {
    if (!supabase) {
      demoTrips = demoTrips.map((t) => (t.id === tripId ? { ...t, order_ids: orderIds } : t));
      return;
    }
    await Promise.all(
      orderIds.map((oid, seq) => supabase!.from('trip_stops').update({ seq }).eq('trip_id', tripId).eq('order_id', oid))
    );
  },

  async getMovements(): Promise<StatusMovement[]> {
    // demo: log ตัวอย่าง; ของจริงดึงจาก status_history
    return [...demoMovements];
  },

  async setDriverOnline(id: number, online: boolean): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('drivers').update({ is_online: online }).eq('id', id);
    if (error) throw error;
  },

  // ---------- POD / history ----------
  async recordStatus(order: Order, status: OrderStatus, note: string, driverName: string): Promise<void> {
    await this.updateOrderStatus(order.id, status);
    if (!supabase) {
      demoHistory = [
        { id: historyId++, order_id: order.id, order_no: order.order_no, status, note: note || null, by_driver: driverName, created_at: new Date().toISOString() },
        ...demoHistory,
      ];
      return;
    }
    const { error } = await supabase.from('status_history').insert({ order_id: order.id, status, note: note || null });
    if (error) console.error('recordStatus', error);
  },

  async getHistory(): Promise<StatusEvent[]> {
    if (!supabase) return [...demoHistory];
    const { data, error } = await supabase
      .from('status_history').select('*, orders(order_no), drivers(name)').order('created_at', { ascending: false }).limit(100);
    if (error) { console.error('getHistory', error); return [...demoHistory]; }
    return (data as any[]).map((h) => ({
      ...h,
      order_no: h.orders?.order_no ?? `#${h.order_id}`,
      driver_id: h.by_driver ?? null,
      by_driver: h.drivers?.name ?? null,
    })) as StatusEvent[];
  },

  // ---------- POD: บันทึกการส่ง (proof of delivery + partial) ----------
  async recordDelivery(input: PodInput): Promise<void> {
    const { order, overall_status, driver_id, driver_name, photo_url, signature_url, cod_collected, note, items } = input;
    if (!supabase) {
      demoOrders = demoOrders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: overall_status,
              items: o.items.map((it) => {
                const pod = items.find((p) => p.item_id === it.id);
                return pod ? { ...it, delivered_qty: pod.delivered_qty, item_status: pod.item_status } : it;
              }),
            }
          : o
      );
      demoHistory = [
        {
          id: historyId++, order_id: order.id, order_no: order.order_no, status: overall_status,
          note: note || null, driver_id, by_driver: driver_name || null,
          photo_url: photo_url ?? null, signature_url: signature_url ?? null, cod_collected,
          created_at: new Date().toISOString(),
        },
        ...demoHistory,
      ];
      return;
    }
    // orders: สถานะ + เวลา/ผู้ส่ง
    const { error: e1 } = await supabase
      .from('orders')
      .update({ status: overall_status, delivered_at: new Date().toISOString(), delivered_by: driver_id })
      .eq('id', order.id);
    if (e1) throw e1;
    // order_items: ส่งได้จริง + สถานะรายรายการ
    await Promise.all(
      items.map((p) => supabase!.from('order_items').update({ delivered_qty: p.delivered_qty, item_status: p.item_status }).eq('id', p.item_id))
    );
    // status_history: หลักฐาน POD
    const { error: e3 } = await supabase.from('status_history').insert({
      order_id: order.id, status: overall_status, note: note || null, by_driver: driver_id,
      photo_url, signature_url, cod_collected,
    });
    if (e3) console.error('recordDelivery history', e3);
  },
};

// ============================================================
// Aggregations
// ============================================================
export function computeStats(orders: Order[]): DashboardStats {
  return {
    ordersToday: orders.length,
    readyToShip: orders.filter((o) => o.status === 'ready').length,
    codWaiting: orders.filter((o) => o.status === 'cod_waiting').length,
    codTransferred: orders.filter((o) => o.status === 'cod_transferred').length,
    failed: orders.filter((o) => o.status === 'failed').length,
    totalBoxes: orders.reduce((sum, o) => sum + (o.box_count || 0), 0),
  };
}

export function computeStatusBreakdown(orders: Order[]): StatusBreakdown[] {
  const defs: Array<{ key: OrderStatus; label: string; color: string }> = [
    { key: 'unspecified', label: 'ยังไม่ระบุ', color: '#94a3b8' },
    { key: 'ready', label: 'พร้อมส่ง', color: '#06b6d4' },
    { key: 'waiting_ship', label: 'รอส่ง', color: '#3b82f6' },
    { key: 'delivered', label: 'จัดส่งสำเร็จ', color: '#10b981' },
    { key: 'partial', label: 'ส่งบางส่วน', color: '#f59e0b' },
    { key: 'failed', label: 'ค้างส่ง', color: '#f43f5e' },
    { key: 'cod_waiting', label: 'รอโอน', color: '#f59e0b' },
    { key: 'cod_transferred', label: 'โอนแล้ว', color: '#22c55e' },
  ];
  return defs.map((d) => ({ key: d.key, label: d.label, color: d.color, count: orders.filter((o) => o.status === d.key).length }));
}

export function computeZoneSummary(orders: Order[], zones: Zone[]): ZoneSummary[] {
  return zones.map((z) => {
    const zoneOrders = orders.filter((o) => o.zone_id === z.id);
    return { name: z.name, color: z.color, orderCount: zoneOrders.length, boxCount: zoneOrders.reduce((s, o) => s + (o.box_count || 0), 0) };
  });
}

const REPORT_STATUS: Array<{ key: OrderStatus; label: string; color: string }> = [
  { key: 'unspecified', label: '— ยังไม่ระบุ', color: '#94a3b8' },
  { key: 'ready', label: 'พร้อมส่ง', color: '#06b6d4' },
  { key: 'waiting_ship', label: 'รอส่ง', color: '#3b82f6' },
  { key: 'delivered', label: 'จัดส่งสำเร็จ', color: '#10b981' },
  { key: 'partial', label: 'ส่งบางส่วน', color: '#f59e0b' },
  { key: 'failed', label: 'ค้างส่ง', color: '#f43f5e' },
  { key: 'cod_waiting', label: 'รอโอน', color: '#f59e0b' },
  { key: 'cod_transferred', label: 'โอนแล้ว', color: '#22c55e' },
  { key: 'oem', label: 'OEM // Made to order', color: '#a855f7' },
];

// ---------- ประสิทธิภาพคนขับ (KPI) ----------
export function computePerformance(
  drivers: Driver[],
  trips: TripT[],
  orders: Order[],
  history: StatusEventT[]
): DriverPerformance[] {
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return drivers
    .map((d) => {
      const driverTrips = trips.filter((t) => t.driver_id === d.id);
      const orderIds = driverTrips.flatMap((t) => t.order_ids);
      const dOrders = orderIds.map((id) => orderById.get(id)).filter(Boolean) as Order[];
      const delivered = dOrders.filter((o) => o.status === 'delivered' || o.status === 'partial').length;
      const failed = dOrders.filter((o) => o.status === 'failed').length;
      const finished = delivered + failed;
      const podRecords = history.filter((h) => h.driver_id === d.id && (h.status === 'delivered' || h.status === 'partial'));
      const withProof = podRecords.filter((h) => h.photo_url || h.signature_url).length;
      const codCollected = history.filter((h) => h.driver_id === d.id).reduce((s, h) => s + (h.cod_collected || 0), 0);
      return {
        driver_id: d.id, name: d.name, vehicle: d.vehicle,
        trips: driverTrips.length,
        deliveries: orderIds.length,
        delivered, failed,
        onTimeRate: finished ? Math.round((delivered / finished) * 100) : 0,
        podRate: delivered ? Math.round((withProof / delivered) * 100) : 0,
        codCollected,
      } as DriverPerformance;
    })
    .sort((a, b) => b.delivered - a.delivered || b.onTimeRate - a.onTimeRate);
}

// สรุปผลการส่ง (สำเร็จ/บางส่วน/ค้าง) สำหรับ donut
export function computeDeliveryOutcome(orders: Order[]) {
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const partial = orders.filter((o) => o.status === 'partial').length;
  const failed = orders.filter((o) => o.status === 'failed').length;
  const total = delivered + partial + failed || 1;
  return [
    { key: 'delivered', label: 'ส่งสำเร็จ', color: '#10b981', count: delivered, pct: Math.round((delivered / total) * 100) },
    { key: 'partial', label: 'ส่งบางส่วน', color: '#f59e0b', count: partial, pct: Math.round((partial / total) * 100) },
    { key: 'failed', label: 'ค้างส่ง', color: '#f43f5e', count: failed, pct: Math.round((failed / total) * 100) },
  ];
}

export function computeReport(orders: Order[]): ReportSummary {
  const total = orders.length || 1;
  const completed = orders.filter((o) => o.status === 'delivered').length;
  const failed = orders.filter((o) => o.status === 'failed').length;
  const onTimeRate = Math.round(((orders.length - failed) / total) * 100);
  const statusDist = REPORT_STATUS.map((s) => {
    const count = orders.filter((o) => o.status === s.key).length;
    return { ...s, count, pct: Math.round((count / total) * 100) };
  });
  return { totalOrders: orders.length, completed, onTimeRate, statusDist };
}
