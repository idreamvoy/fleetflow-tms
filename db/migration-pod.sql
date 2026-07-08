-- ============================================================
-- FleetFlow TMS — Migration: POD + Partial Delivery + Performance
-- วิธีใช้: คัดลอกทั้งหมด → Supabase Dashboard > SQL Editor > Run
-- (ปลอดภัย รันซ้ำได้ — ใช้ IF NOT EXISTS)
-- ============================================================

-- 1) สถานะใหม่: ส่งบางส่วน (partial)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partial';

-- 2) POD บนบันทึกสถานะ (status_history มี photo_url + by_driver อยู่แล้ว)
ALTER TABLE status_history ADD COLUMN IF NOT EXISTS signature_url TEXT;          -- ลายเซ็น (PNG dataURL)
ALTER TABLE status_history ADD COLUMN IF NOT EXISTS cod_collected NUMERIC(12,2); -- COD ที่เก็บได้จริง

-- 3) ส่งบางส่วนรายรายการสินค้า
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivered_qty INT;                       -- ส่งได้จริงกี่ชิ้น
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_status  TEXT DEFAULT 'pending';     -- pending/delivered/partial/returned

-- 4) เวลาส่งจริง + ผู้ส่ง (สำหรับรายงานประสิทธิภาพ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by BIGINT REFERENCES drivers(id);
