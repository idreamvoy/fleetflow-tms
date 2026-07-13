import { useState } from 'react';
import type { Driver, NewDriver } from '../lib/types';

export default function DriverModal({
  driver,
  onClose,
  onSave,
}: {
  driver?: Driver | null;
  onClose: () => void;
  onSave: (data: NewDriver, id?: number) => Promise<void>;
}) {
  const isEdit = !!driver;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: driver?.name ?? '',
    vehicle: driver?.vehicle ?? '',
    phone: driver?.phone ?? '',
    is_online: driver?.is_online ?? false,
  });
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      await onSave(
        { name: f.name, vehicle: f.vehicle, phone: f.phone, is_online: f.is_online },
        driver?.id
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h3>{isEdit ? `แก้ไขคนขับ · ${driver!.name}` : 'เพิ่มคนขับ / ขนส่ง'}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label>ชื่อคนขับ / ขนส่ง *</label>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น รบ อภิ / LALAMOVE" autoFocus required />
            </div>
            <div className="field">
              <label>ประเภทรถ / ทะเบียน <span className="sub" style={{ fontWeight: 400 }}>(ไม่ระบุก็ได้)</span></label>
              <input value={f.vehicle} onChange={(e) => set('vehicle', e.target.value)} placeholder="เช่น รถบริษัท กทม. / บม-1234" />
            </div>
            <div className="field">
              <label>เบอร์โทร <span className="sub" style={{ fontWeight: 400 }}>(ไม่ระบุก็ได้)</span></label>
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="เช่น 081-234-5678" />
            </div>
            <label className="drv-toggle">
              <input type="checkbox" checked={f.is_online} onChange={(e) => set('is_online', e.target.checked)} />
              <span>ออนไลน์ (พร้อมรับงาน)</span>
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !f.name.trim()}>
              {saving ? 'กำลังบันทึก…' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มคนขับ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
