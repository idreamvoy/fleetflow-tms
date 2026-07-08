import type { OrderStatus } from '../lib/types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  unspecified: 'ยังไม่ระบุ',
  ready: 'พร้อมส่ง',
  waiting_ship: 'รอส่ง',
  delivered: 'จัดส่งสำเร็จ',
  partial: 'ส่งบางส่วน',
  failed: 'ค้างส่ง',
  cod_waiting: 'รอโอน',
  cod_transferred: 'โอนแล้ว',
  oem: 'OEM',
};

// สีจุด/ป้ายของแต่ละสถานะ (ตรงกับ dashboard)
export const STATUS_COLOR: Record<OrderStatus, string> = {
  unspecified: '#94a3b8',
  ready: '#06b6d4',
  waiting_ship: '#3b82f6',
  delivered: '#10b981',
  partial: '#f59e0b',
  failed: '#f43f5e',
  cod_waiting: '#f59e0b',
  cod_transferred: '#22c55e',
  oem: '#a855f7',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge b-${status}`}>{STATUS_LABEL[status]}</span>;
}
