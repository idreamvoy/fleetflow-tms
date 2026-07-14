// ============================================================
// FleetFlow TMS - Type definitions
// ============================================================

// สถานะเดียวครอบคลุมทั้งสถานะสินค้า + COD + OEM (ตามดีไซน์จริง)
export type OrderStatus =
  | 'unspecified' // — ยังไม่ระบุ
  | 'ready' // พร้อมส่ง
  | 'waiting_ship' // รอส่ง
  | 'delivered' // จัดส่งสำเร็จ
  | 'partial' // ส่งบางส่วน
  | 'failed' // ค้างส่ง
  | 'cod_waiting' // รอโอน
  | 'cod_transferred' // โอนแล้ว
  | 'oem'; // OEM // Made to order

// สถานะการส่งรายรายการสินค้า (partial delivery)
export type ItemDeliveryStatus = 'pending' | 'delivered' | 'partial' | 'returned';
export const ITEM_STATUS_LABEL: Record<ItemDeliveryStatus, string> = {
  pending: 'ยังไม่ส่ง',
  delivered: 'ส่งครบ',
  partial: 'ส่งบางส่วน',
  returned: 'ตีกลับ',
};

export type CustomerType = 'hotel' | 'hospital'; // โรงแรม / โรงพยาบาล
export type ShippingMethod = 'company' | 'shipping'; // ขนส่งบริษัท / ขนส่ง

export const COLLECTIONS = [
  'Hotel Premium', 'Spa & Bath', 'Banquet Line', 'Housekeeping', 'Medical Care', 'Patient Series',
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export type TripStatus = 'planning' | 'assigned' | 'in_progress' | 'completed';

export interface Zone {
  id: number;
  name: string;
  color: string;
}

export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  vehicle: string | null;
  is_online: boolean;
}

export interface NewDriver {
  name: string;
  phone?: string | null;
  vehicle?: string | null;
  is_online?: boolean;
}

// รายการสินค้าในใบสั่งขาย (line item)
export interface OrderItem {
  id: number;
  collection: string; // กลุ่มสินค้า (คีย์เองได้)
  product_name: string; // ผ้าปูที่นอน 6 ฟุต
  qty: number; // จำนวน (ชิ้น)
  pieces_per_box: number; // ชิ้น/กล่อง
  boxes: number; // กล่อง (คำนวณ)
  note: string; // หมายเหตุ
  delivered_qty?: number | null; // ส่งได้จริง (partial)
  item_status?: ItemDeliveryStatus | null; // สถานะการส่งรายรายการ
}

// ใบสั่งขาย (sales order)
export interface Order {
  id: number;
  order_no: string; // เลขที่ใบสั่งงาน SO-6907-001
  customer_type: CustomerType;
  customer_name: string; // โรงแรมดุสิตธานี / รพ.บำรุงราษฎร์
  delivery_location: string; // สถานที่ส่งสินค้า
  shipping_method: ShippingMethod;
  zone_id: number | null;
  zone_name?: string | null;
  status: OrderStatus; // สถานะสินค้า
  cod_amount: number;
  ship_date: string | null; // กำหนดจัดส่ง
  items: OrderItem[];
  box_count: number; // sum ของ items.boxes
  created_at: string;
}

export interface NewOrderItem {
  collection: string; // กลุ่มสินค้า (คีย์เองได้)
  product_name: string;
  qty: number;
  pieces_per_box: number;
  note?: string;
}

export interface NewOrder {
  order_no: string;
  customer_type: CustomerType;
  customer_name: string;
  delivery_location?: string;
  shipping_method: ShippingMethod;
  zone_id?: number | null;
  status?: OrderStatus;
  cod_amount?: number;
  ship_date?: string;
  items: NewOrderItem[];
}

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  planning: 'รอออกรถ',
  assigned: 'กำลังโหลดสินค้า',
  in_progress: 'กำลังวิ่ง',
  completed: 'เสร็จสิ้น',
};

export interface Trip {
  id: number;
  trip_date: string;
  driver_id: number | null;
  driver_name?: string | null;
  zone_id: number | null;
  zone_name?: string | null;
  status: TripStatus;
  vehicle_type: string; // รถ 4 ล้อ / รถ 6 ล้อ
  capacity_boxes: number; // ความจุ (กล่อง)
  distance_km: number;
  progress: number; // % ความคืบหน้า
  eta: string; // เวลาถึงโดยประมาณ
  order_ids: number[]; // ออเดอร์ในรอบนี้ (ตามลำดับส่ง)
  created_at: string;
}

// บันทึกความเคลื่อนไหวสถานะ (สำหรับหน้ารายงาน)
export interface StatusMovement {
  id: number;
  time: string; // HH:mm
  order_no: string;
  from_label: string;
  to_label: string;
  by: string;
}

export interface StatusEvent {
  id: number;
  order_id: number;
  order_no: string;
  status: OrderStatus;
  note: string | null;
  by_driver: string | null;
  driver_id?: number | null;
  photo_url?: string | null;
  signature_url?: string | null;
  cod_collected?: number | null;
  created_at: string;
}

// ---------- POD (Proof of Delivery) ----------
export interface PodItemInput {
  item_id: number;
  delivered_qty: number;
  item_status: ItemDeliveryStatus;
}
export interface PodInput {
  order: Order;
  driver_id: number | null;
  driver_name: string;
  overall_status: OrderStatus; // delivered / partial / failed
  photo_url: string | null; // รูปหน้างาน (JPEG dataURL, ย่อแล้ว)
  signature_url: string | null; // ลายเซ็น (PNG dataURL)
  cod_collected: number; // COD ที่เก็บได้จริง
  note: string;
  items: PodItemInput[];
}

// ---------- Driver performance (KPI) ----------
export interface DriverPerformance {
  driver_id: number;
  name: string;
  vehicle: string | null;
  trips: number; // จำนวนเที่ยว
  deliveries: number; // จุดที่รับผิดชอบ
  delivered: number; // ส่งสำเร็จ (รวม partial)
  failed: number; // ค้างส่ง
  onTimeRate: number; // % สำเร็จ
  podRate: number; // % ที่มีหลักฐาน POD
  codCollected: number; // COD เก็บได้รวม
}

export interface ReportSummary {
  totalOrders: number;
  completed: number; // ส่งสำเร็จ
  onTimeRate: number; // อัตราส่งตรงเวลา %
  statusDist: { key: OrderStatus; label: string; color: string; count: number; pct: number }[];
}

export interface DashboardStats {
  ordersToday: number;
  readyToShip: number; // พร้อมส่ง (รอจัดรถ)
  codWaiting: number; // รอโอนเงิน
  codTransferred: number; // โอนแล้ว
  failed: number; // ค้างส่ง
  totalBoxes: number; // จำนวนกล่องรวม
}

export interface StatusBreakdown {
  label: string;
  key: string;
  count: number;
  color: string;
}

export interface ZoneSummary {
  name: string;
  color: string;
  orderCount: number;
  boxCount: number;
}
