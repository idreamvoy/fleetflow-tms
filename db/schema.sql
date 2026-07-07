-- ============================================================
-- FleetFlow TMS (ไทย) — Supabase Schema
-- ระบบใบสั่งขาย/จัดส่งผ้าให้โรงแรม–โรงพยาบาล
-- วิธีใช้: คัดลอกทั้งหมด → Supabase Dashboard > SQL Editor > Run
-- ============================================================

DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS trip_stops CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS trip_status CASCADE;
DROP TYPE IF EXISTS customer_type CASCADE;
DROP TYPE IF EXISTS shipping_method CASCADE;

-- ---------- ENUMs ----------
-- สถานะเดียวครอบคลุมสถานะสินค้า + COD + OEM (ตามดีไซน์จริง)
CREATE TYPE order_status AS ENUM (
  'unspecified',      -- — ยังไม่ระบุ
  'ready',            -- พร้อมส่ง
  'waiting_ship',     -- รอส่ง
  'delivered',        -- จัดส่งสำเร็จ
  'failed',           -- ค้างส่ง
  'cod_waiting',      -- รอโอน
  'cod_transferred',  -- โอนแล้ว
  'oem'               -- OEM // Made to order
);
CREATE TYPE trip_status AS ENUM ('planning', 'assigned', 'in_progress', 'completed');
CREATE TYPE customer_type AS ENUM ('hotel', 'hospital');       -- โรงแรม / โรงพยาบาล
CREATE TYPE shipping_method AS ENUM ('company', 'shipping');   -- ขนส่งบริษัท / ขนส่ง

-- ---------- โซนจัดส่ง ----------
CREATE TABLE zones (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- คนขับ ----------
CREATE TABLE drivers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  vehicle    TEXT,                  -- ทะเบียนรถ
  is_online  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- ใบสั่งขาย (orders) ----------
CREATE TABLE orders (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_no          TEXT UNIQUE NOT NULL,          -- เลขที่ใบสั่งงาน SO-6907-001
  customer_type     customer_type NOT NULL DEFAULT 'hotel',
  customer_name     TEXT NOT NULL,                 -- โรงแรมดุสิตธานี / รพ.บำรุงราษฎร์
  delivery_location TEXT,                          -- สถานที่ส่งสินค้า
  shipping_method   shipping_method NOT NULL DEFAULT 'company',
  zone_id           BIGINT REFERENCES zones(id),
  status            order_status DEFAULT 'unspecified',
  cod_amount        NUMERIC(12,2) DEFAULT 0,
  ship_date         DATE,                          -- กำหนดจัดส่ง
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ---------- รายการสินค้าในใบสั่ง (line items) ----------
CREATE TABLE order_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  collection     TEXT NOT NULL,       -- Hotel Premium / Spa & Bath / Medical Care ...
  product_name   TEXT NOT NULL,       -- ผ้าปูที่นอน 6 ฟุต
  qty            INT NOT NULL DEFAULT 1,   -- จำนวน (ชิ้น)
  pieces_per_box INT NOT NULL DEFAULT 1,   -- ชิ้น/กล่อง
  boxes          INT NOT NULL DEFAULT 1,   -- กล่อง
  note           TEXT DEFAULT ''
);

-- ---------- รอบจัดส่ง ----------
CREATE TABLE trips (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_date      DATE NOT NULL,
  driver_id      BIGINT REFERENCES drivers(id),
  zone_id        BIGINT REFERENCES zones(id),
  status         trip_status DEFAULT 'planning',
  vehicle_type   TEXT DEFAULT 'รถ 4 ล้อ',   -- รถ 4 ล้อ / รถ 6 ล้อ
  capacity_boxes INT DEFAULT 120,           -- ความจุ (กล่อง)
  distance_km    NUMERIC(8,1),              -- ระยะทาง (estimate mode)
  progress       INT DEFAULT 0,             -- % ความคืบหน้า
  eta            TEXT DEFAULT '',           -- เวลาถึงโดยประมาณ
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trip_stops (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_id  BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seq      INT DEFAULT 0,
  lat      NUMERIC(9,6),
  lng      NUMERIC(9,6),
  UNIQUE (trip_id, order_id)
);

-- ---------- ประวัติสถานะ / POD ----------
CREATE TABLE status_history (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  note       TEXT,
  by_driver  BIGINT REFERENCES drivers(id),
  photo_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_shipping ON orders(shipping_method);
CREATE INDEX idx_orders_zone     ON orders(zone_id);
CREATE INDEX idx_items_order     ON order_items(order_id);
CREATE INDEX idx_status_order    ON status_history(order_id);

-- ============================================================
-- ข้อมูลตัวอย่าง
-- ============================================================
INSERT INTO zones (name, color) VALUES
  ('กรุงเทพฯ & ปริมณฑล', '#6366f1'),
  ('ต่างจังหวัด', '#f59e0b');

INSERT INTO drivers (name, phone, vehicle, is_online) VALUES
  ('สมชาย ก.', '081-111-1111', 'บม-1234', true),
  ('วิรัช ม.', '082-222-2222', 'ผก-8890', true),
  ('ธนา พ.', '083-333-3333', 'งก-4471', false),
  ('ประยุทธ ส.', '084-444-4444', 'สค-2210', false);

INSERT INTO orders (order_no, customer_type, customer_name, delivery_location, shipping_method, zone_id, status, cod_amount, ship_date) VALUES
  ('SO-6907-001', 'hotel',    'โรงแรมดุสิตธานี',      '88/8 หมู่ 7 ต.วัดจันทร์ อ.เมืองพิษณุโลก', 'company', 1, 'ready',           0,    current_date),
  ('SO-6907-002', 'hotel',    'โรงแรมเดอะสุโกศล',     'ราชเทวี กทม.',                          'company', 1, 'waiting_ship',    0,    current_date),
  ('SO-6907-003', 'hospital', 'รพ.บำรุงราษฎร์',       '33 ถ.สุขุมวิท เขตวัฒนา กทม.',           'company', 1, 'cod_waiting',     4200, current_date),
  ('SO-6907-004', 'hotel',    'โรงแรมเซ็นทาราแกรนด์', 'เขตปทุมวัน กทม.',                       'shipping', 2, 'cod_transferred', 3800, current_date),
  ('SO-6907-005', 'hospital', 'รพ.ศิริราช',           'เขตบางกอกน้อย กทม.',                    'company', 1, 'failed',          0,    current_date);

INSERT INTO order_items (order_id, collection, product_name, qty, pieces_per_box, boxes, note) VALUES
  (1, 'Hotel Premium', 'ผ้าปูที่นอน 6 ฟุต', 24, 6, 4, ''),
  (1, 'Spa & Bath',    'ผ้าเช็ดตัว 27x54',   40, 10, 4, ''),
  (2, 'Banquet Line',  'ผ้าปูโต๊ะกลม',       20, 5, 4, 'ด่วน'),
  (3, 'Medical Care',  'ชุดผู้ป่วย ไซส์ L',  60, 6, 10, ''),
  (4, 'Housekeeping',  'ปลอกหมอน',           38, 10, 4, ''),
  (5, 'Patient Series','ผ้าห่มผู้ป่วย',      16, 4, 4, '');

-- ============================================================
-- Row Level Security (โหมด Demo — เปิดให้ทดลอง)
-- ⚠️ Production: เปลี่ยนสิทธิ์เขียนเป็น auth.role() = 'authenticated'
-- ============================================================
ALTER TABLE zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zones','drivers','orders','order_items','trips','trip_stops','status_history']
  LOOP
    EXECUTE format('CREATE POLICY "read %1$s"  ON %1$s FOR SELECT USING (true);', t);
    EXECUTE format('CREATE POLICY "write %1$s" ON %1$s FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;
