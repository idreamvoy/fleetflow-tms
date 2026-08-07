// ============================================================
// SLA / อายุออเดอร์ — ดูว่าออเดอร์ไหนใกล้/เกินกำหนดส่ง
//  - วันที่สร้าง = created_at (วันที่สร้างเลขที่ใบสั่งงาน) → SLA เริ่มนับตั้งแต่ตรงนี้เสมอ
//  - กำหนดส่ง   = ship_date ถ้าวางแผนกำหนดวันแล้ว ใช้วันนั้นเป็นเส้นตาย
//               ถ้ายังไม่กำหนดวันส่ง ใช้นโยบาย "ต้องส่งภายใน 7 วันหลังสร้างออเดอร์" แทน
//               (กันไม่ให้ออเดอร์ที่ยังไม่ได้จัดคิวหลุด SLA ไปเงียบๆ)
// ============================================================
import type { OrderStatus } from './types';

export type SlaLevel = 'overdue' | 'due' | 'ok' | 'done' | 'none';

export interface Sla {
  ageDays: number;          // อายุออเดอร์ (วันนี้ − วันที่สร้าง)
  dueDays: number | null;   // จำนวนวันถึงเส้นตาย (ติดลบ = เกินกำหนด)
  level: SlaLevel;
  label: string;
  isPolicyDeadline: boolean; // true = นับจากนโยบาย 7 วัน (ยังไม่มีวันส่งที่วางแผนไว้จริง)
}

const DAY = 86400000;
// เกณฑ์ "ใกล้ครบกำหนด" (วัน)
export const SLA_DUE_SOON = 2;
// นโยบาย SLA: ต้องจัดส่งภายในกี่วันหลังสร้างออเดอร์ (ใช้เมื่อยังไม่มีการกำหนดวันส่ง)
export const SLA_POLICY_DAYS = 7;

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
  if (o.status === 'delivered') return { ageDays, dueDays: null, level: 'done', label: 'ส่งแล้ว', isPolicyDeadline: false };

  // เส้นตาย: ใช้วันที่วางแผนไว้ (ship_date) ถ้ามี ไม่งั้นใช้นโยบาย SLA_POLICY_DAYS วันจากวันที่สร้าง
  // (คีย์ออเดอร์เข้ามาปุ๊บ นาฬิกา SLA เริ่มเดินทันที ไม่ต้องรอวางแผนกำหนดวันส่งก่อน)
  let deadline = ship;
  const isPolicyDeadline = ship == null;
  if (deadline == null) {
    if (created == null) return { ageDays, dueDays: null, level: 'none', label: 'ไม่ทราบวันที่สร้าง', isPolicyDeadline: false };
    deadline = created + SLA_POLICY_DAYS * DAY;
  }

  const dueDays = Math.round((deadline - today) / DAY);
  const suffix = isPolicyDeadline ? ` (ครบกำหนด SLA ${SLA_POLICY_DAYS} วัน)` : '';
  if (dueDays < 0) return { ageDays, dueDays, level: 'overdue', label: `เกินกำหนด ${-dueDays} วัน${suffix}`, isPolicyDeadline };
  if (dueDays === 0) return { ageDays, dueDays, level: 'due', label: `ครบกำหนดวันนี้${suffix}`, isPolicyDeadline };
  if (dueDays <= SLA_DUE_SOON) return { ageDays, dueDays, level: 'due', label: `อีก ${dueDays} วัน${suffix}`, isPolicyDeadline };
  return { ageDays, dueDays, level: 'ok', label: `อีก ${dueDays} วัน${suffix}`, isPolicyDeadline };
}

export const SLA_COLOR: Record<SlaLevel, string> = {
  overdue: '#f43f5e',
  due: '#f59e0b',
  ok: '#10b981',
  done: '#94a3b8',
  none: '#cbd5e1',
};
