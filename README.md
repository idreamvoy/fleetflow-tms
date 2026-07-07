# 🚚 FleetFlow TMS

ระบบจัดการการจัดส่งพัสดุ (Transport Management System) ภาษาไทย
สร้างด้วย **React + Vite + TypeScript** + **Supabase** (PostgreSQL)

![status](https://img.shields.io/badge/build-passing-brightgreen) ![free](https://img.shields.io/badge/hosting-free-blue)

---

## ✨ ฟีเจอร์

- 📊 **Dashboard** — KPI (ออเดอร์วันนี้/พร้อมส่ง/รอโอน/โอนแล้ว/ค้างส่ง), กราฟโดนัทสถานะ, แบ่งโซนจัดส่ง
- 📦 **ออเดอร์** — เพิ่ม/แก้สถานะ/ลบ + ค้นหา + COD tracking
- 🗺️ วางแผนจัดส่ง · ติดตามเส้นทาง · Driver App · รายงาน (โครงหน้าพร้อมต่อยอด)
- 🔌 **เชื่อม Supabase จริง** — ถ้ายังไม่ตั้งค่า จะใช้ **Demo Mode** (ข้อมูลตัวอย่างในหน่วยความจำ) อัตโนมัติ

---

## 🚀 เริ่มใช้งาน (Local)

```bash
npm install        # ติดตั้ง dependencies
npm run dev        # รัน dev server → http://localhost:3000
npm run build      # build production → dist/
```

> ต้องมี **Node.js 18+** (โปรเจกต์นี้ทดสอบด้วย v24)

ตอนนี้เปิดมาจะเป็น **Demo Mode** ทันที (มุมขวาล่างขึ้นสีเหลือง) — ใช้ดู UI/ทดลองได้เลยโดยไม่ต้องตั้งค่าอะไร

---

## 🗄️ เชื่อมต่อ Database จริง (Supabase — ฟรี)

**1. สร้าง project**
- สมัคร [supabase.com](https://supabase.com) → New Project

**2. สร้างตาราง**
- Supabase → **SQL Editor** → New query → วางเนื้อหาไฟล์ [`db/schema.sql`](db/schema.sql) → **Run**
- ได้ตาราง: `orders`, `order_items`, `zones`, `drivers`, `trips`, `trip_stops`, `status_history` + ข้อมูลตัวอย่าง

**3. ใส่ค่าเชื่อมต่อ**
- คัดลอกไฟล์ `.env.example` เป็น `.env.local`
- Supabase → **Project Settings → API** → คัดลอกค่ามาใส่:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```
- รัน `npm run dev` ใหม่ → มุมขวาล่างเปลี่ยนเป็น **"● Live Database"** สีเขียว = เชื่อมสำเร็จ 🎉

---

## ☁️ Deploy ฟรี

### Vercel (แนะนำ)
1. push โค้ดขึ้น GitHub
2. [vercel.com](https://vercel.com) → Add New Project → เลือก repo
3. ใส่ Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy → ได้ URL ฟรี (มี `vercel.json` ตั้งค่าให้แล้ว)

### หรือ Netlify / Cloudflare Pages
- Build command: `npm run build` · Publish dir: `dist` (มี `netlify.toml` ให้แล้ว)

---

## 📁 โครงสร้าง

```
src/
├── main.tsx            # entry
├── App.tsx             # layout + routing (state-based) + logic
├── index.css           # ธีมทั้งหมด (จับคู่ดีไซน์)
├── lib/
│   ├── types.ts        # TypeScript types
│   └── supabase.ts     # client + demo fallback + CRUD + aggregations
├── components/         # Sidebar, Topbar, Donut, OrderModal, badges, icons
└── pages/              # Dashboard, Orders, Stub
db/schema.sql           # SQL สำหรับ Supabase
```

---

## 🔐 ก่อนใช้ Production จริง

`db/schema.sql` ตั้ง RLS เป็นโหมด Demo (ใครก็เขียนได้) — เมื่อพร้อมใช้จริง แนะนำเปิด Supabase Auth
แล้วเปลี่ยน policy การเขียนเป็น `auth.role() = 'authenticated'` (มีคอมเมนต์บอกในไฟล์)
