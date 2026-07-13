import { useState } from 'react';
import type { Driver, NewDriver } from '../lib/types';
import DriverModal from '../components/DriverModal';
import { IconPlus, IconTruck } from '../components/icons';

export default function Settings({
  drivers,
  onSave,
  onDelete,
  onToggleOnline,
}: {
  drivers: Driver[];
  onSave: (data: NewDriver, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onToggleOnline: (id: number, is_online: boolean) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (d: Driver) => { setEditing(d); setModalOpen(true); };
  const close = () => { setModalOpen(false); setEditing(null); };

  const save = async (data: NewDriver, id?: number) => {
    await onSave(data, id);
    close();
  };

  const online = drivers.filter((d) => d.is_online).length;

  return (
    <>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className="tab active"><IconTruck width={16} height={16} /> คนขับ / ขนส่ง</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>จัดการคนขับ / ขนส่ง</h3>
            <div className="sub">เพิ่ม แก้ไข ลบ ได้เอง · บันทึกลงฐานข้อมูลทันที</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="sub">ทั้งหมด {drivers.length} · ออนไลน์ {online}</span>
            <button className="btn btn-primary" onClick={openAdd}><IconPlus /> เพิ่มคนขับ</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>ชื่อคนขับ / ขนส่ง</th>
                <th>ประเภทรถ / ทะเบียน</th>
                <th style={{ width: 130 }}>เบอร์โทร</th>
                <th style={{ width: 108 }}>สถานะ</th>
                <th style={{ width: 128 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={6} className="loading">ยังไม่มีคนขับ — กด “เพิ่มคนขับ”</td></tr>
              ) : (
                drivers.map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td>{d.vehicle || <span className="sub" style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td>{d.phone || <span className="sub" style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td>
                      <button
                        className={`drv-status ${d.is_online ? 'on' : 'off'}`}
                        onClick={() => onToggleOnline(d.id, !d.is_online)}
                        title="คลิกเพื่อสลับสถานะ"
                      >
                        <span className="drv-dot" />
                        {d.is_online ? 'ออนไลน์' : 'ออฟไลน์'}
                      </button>
                    </td>
                    <td>
                      {confirmId === d.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="mini-btn danger" onClick={async () => { await onDelete(d.id); setConfirmId(null); }}>ยืนยันลบ</button>
                          <button className="mini-btn" onClick={() => setConfirmId(null)}>ยกเลิก</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="mini-btn" onClick={() => openEdit(d)}>แก้ไข</button>
                          <button className="mini-btn danger" onClick={() => setConfirmId(d.id)}>ลบ</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <DriverModal driver={editing} onClose={close} onSave={save} />}
    </>
  );
}
