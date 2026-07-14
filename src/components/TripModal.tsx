import { useState } from 'react';
import type { Driver, Zone } from '../lib/types';

const VEHICLE_PRESETS = ['รถ 4 ล้อ', 'รถ 6 ล้อ', 'รถ 10 ล้อ', 'รถ 12 ล้อ'];

export default function TripModal({
  drivers,
  zones,
  onClose,
  onCreate,
}: {
  drivers: Driver[];
  zones: Zone[];
  onClose: () => void;
  onCreate: (input: { driver_id: number | null; zone_id: number | null; vehicle_type: string; capacity_boxes: number }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [driverId, setDriverId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>(String(zones[0]?.id ?? ''));
  const [vehicle, setVehicle] = useState('รถ 4 ล้อ');
  const [capacity, setCapacity] = useState(120);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({
        driver_id: driverId ? Number(driverId) : null,
        zone_id: zoneId ? Number(zoneId) : null,
        vehicle_type: vehicle,
        capacity_boxes: Number(capacity) || 120,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3>สร้างเที่ยวรถใหม่</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label>คนขับ / ขนส่ง</label>
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">— ยังไม่ระบุ —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.vehicle ? ` · ${d.vehicle}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>โซนจัดส่ง</label>
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>ประเภทรถ</label>
              <input list="veh-presets" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="เช่น รถ 4 ล้อ" />
              <datalist id="veh-presets">
                {VEHICLE_PRESETS.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div className="field">
              <label>ความจุ (กล่อง)</label>
              <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังสร้าง…' : 'สร้างเที่ยวรถ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
