# 🚀 คู่มือ: ต่อ Supabase จริง + Deploy ขึ้น Vercel

> ปรับทีหลังได้เสมอ — รัน SQL ซ้ำได้, เปลี่ยน env ได้, push โค้ดใหม่แล้ว Vercel deploy ให้อัตโนมัติ

---

## ขั้นที่ 1️⃣ — สร้าง Supabase + ตาราง (ฟรี)

1. ไปที่ **https://supabase.com** → **Start your project** (สมัครด้วย GitHub/อีเมล)
2. **New Project**
   - Name: `fleetflow-tms`
   - Database Password: ตั้งแล้วจดไว้
   - Region: **Southeast Asia (Singapore)**
   - **Create new project** (รอ ~2 นาที)
3. เมนูซ้าย → **SQL Editor** → **New query**
4. เปิดไฟล์ [`db/schema.sql`](db/schema.sql) → คัดลอกทั้งหมด → วาง → **Run** ▶️
   - ได้ตาราง orders / order_items / zones / drivers / trips / trip_stops / status_history + ข้อมูลตัวอย่าง

## ขั้นที่ 2️⃣ — เอา API keys มา

1. เมนูซ้าย → **Project Settings** (เฟือง) → **API**
2. คัดลอก 2 ค่า:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key → `eyJhbGciOi...` (คีย์ยาว)
3. **ส่ง 2 ค่านี้ให้ผมในแชท** → ผมจะใส่ใน `.env.local` + ทดสอบการเชื่อมต่อจริงให้
   - (anon key เป็น public key ปลอดภัยที่จะแชร์ — ความปลอดภัยจริงมาจาก RLS ในฐานข้อมูล)

---

## ขั้นที่ 3️⃣ — ขึ้น GitHub

รันคำสั่งนี้ในโฟลเดอร์โปรเจกต์ (repo ถูก init + commit ไว้ให้แล้ว):

```bash
# สร้าง repo บน github.com ก่อน (New repository ชื่อ fleetflow-tms, ตั้ง Private ได้)
git remote add origin https://github.com/<username>/fleetflow-tms.git
git branch -M main
git push -u origin main
```

## ขั้นที่ 4️⃣ — Deploy บน Vercel (ฟรี)

1. ไปที่ **https://vercel.com** → สมัคร (login ด้วย GitHub ง่ายสุด)
2. **Add New… → Project** → เลือก repo `fleetflow-tms` → **Import**
3. Vercel รู้จัก Vite อัตโนมัติ (มี `vercel.json` ให้แล้ว) — **อย่าเพิ่งกด Deploy**
4. เปิด **Environment Variables** ใส่ 2 ตัว (ค่าเดียวกับ `.env.local`):
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
5. กด **Deploy** → รอ ~1 นาที → ได้ URL ฟรี เช่น `https://fleetflow-tms.vercel.app` 🎉

> อัปเดตในอนาคต: แค่ `git push` → Vercel build + deploy ให้เอง

---

## 🔐 ก่อนใช้จริงกับทีม (ทำทีหลังได้)
`db/schema.sql` เปิด RLS แบบ Demo (ใครก็เขียนได้) — เมื่อพร้อม แนะนำเปิด Supabase Auth
แล้วเปลี่ยน policy การเขียนเป็น `auth.role() = 'authenticated'` (บอกผมช่วยเพิ่มระบบ login ได้)
