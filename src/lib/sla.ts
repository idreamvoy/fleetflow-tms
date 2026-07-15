// ============================================================
// SLA / อายุออเดอร์ — ดูว่าออเดอร์ไหนใกล้/เกินกำหนดส่ง
//  - วันที่สร้าง = created_at (วันที่สร้างเลขที่ใบสั่งงาน)
//  - กำหนดส่ง   = ship_date
// ============================================================
import type { OrderStatus } from './types';

export type SlaLevel = 'overdue' | 'due' | 'ok' | 'done' | 'none';

export interface Sla {
  ageDays: number;          // อายุออเดอร์ (วันนี้ − วันที่สร้าง)
  dueDays: number | null;   // จำนวนวันถึงกำหนดส่ง (ติดลบ = เกินกำหนด)
  level: SlaLevel;
  label: string;
}

const DAY = 86400000;
// เกณฑ์ "ใกล้ครบกำหนด" (วัน)
export const SLA_DUE_SOON = 2;

function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dateOnly(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v);
  return isNaN(d.getTime()) ? null : midnight(d);
}

export function slaOf(o: { created_at?: string | null; ship_date?: string | null; status: OrderStatus }, now: Date = new Date()): Sla {
  const today = midnight(now);
  const created = dateOnly(o.created_at);
  const ship = dateOnly(o.ship_date);
  const ageDays = created == null ? 0 : Math.max(0, Math.round((today - created) / DAY));

  // ส่งแล้ว = ปิด SLA
  if (o.status === 'delivered') return { ageDays, dueDays: null, level: 'done', label: 'ส่งแล้ว' };

  if (ship == null) return { ageDays, dueDays: null, level: 'none', label: 'ยังไม่กำหนดวันส่ง' };

  const dueDays = Math.round((ship - today) / DAY);
  if (dueDays < 0) return { ageDays, dueDays, level: 'overdue', label: `เกินกำหนด ${-dueDays} วัน` };
  if (dueDays === 0) return { ageDays, dueDays, level: 'due', label: 'ครบกำหนดวันนี้' };
  if (dueDays <= SLA_DUE_SOON) return { ageDays, dueDays, level: 'due', label: `อีก ${dueDays} วัน` };
  return { ageDays, dueDays, level: 'ok', label: `อีก ${dueDays} วัน` };
}

export const SLA_COLOR: Record<SlaLevel, string> = {
  overdue: '#f43f5e',
  due: '#f59e0b',
  ok: '#10b981',
  done: '#94a3b8',
  none: '#cbd5e1',
};
