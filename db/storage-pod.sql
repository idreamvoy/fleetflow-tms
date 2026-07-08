-- ============================================================
-- FleetFlow TMS — Supabase Storage สำหรับหลักฐาน POD
-- เก็บรูปหน้างาน + ลายเซ็นเป็นไฟล์จริง (แทน base64 ในตาราง)
-- วิธีใช้: Supabase Dashboard > SQL Editor > Run
-- (ปลอดภัย รันซ้ำได้)
-- ============================================================

-- 1) สร้าง bucket 'pod' แบบ public (อ่านรูปผ่าน URL ได้เลย)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod', 'pod', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Policies — โหมด Demo: อ่าน/อัปโหลดได้ (anon)
--    ⚠️ Production: เปลี่ยน insert/update ให้เป็น auth.role() = 'authenticated'
DROP POLICY IF EXISTS "pod read"   ON storage.objects;
DROP POLICY IF EXISTS "pod insert" ON storage.objects;
DROP POLICY IF EXISTS "pod update" ON storage.objects;

CREATE POLICY "pod read"   ON storage.objects FOR SELECT USING (bucket_id = 'pod');
CREATE POLICY "pod insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pod');
CREATE POLICY "pod update" ON storage.objects FOR UPDATE USING (bucket_id = 'pod');
