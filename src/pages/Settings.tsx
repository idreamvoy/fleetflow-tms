import { useState } from 'react';
import type { Driver, NewDriver, Zone, NewZone } from '../lib/types';
import DriverModal from '../components/DriverModal';
import ZoneModal from '../components/ZoneModal';
import { IconPlus, IconTruck, IconPin } from '../components/icons';

export default function Settings({
  drivers,
  zones,
  onSaveDriver,
  onDeleteDriver,
  onToggleOnline,
  onSaveZone,
  onDeleteZone,
}: {
  drivers: Driver[];
  zones: Zone[];
  onSaveDriver: (data: NewDriver, id?: number) => Promise<void>;
  onDeleteDriver: (id: number) => Promise<void>;
  onToggleOnline: (id: number, is_online: boolean) => Promise<void>;
  onSaveZone: (data: NewZone, id?: number) => Promise<void>;
  onDeleteZone: (id: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<'drivers' | 'zones'>('drivers');

  // --- driver modal state ---
  const [dModal, setDModal] = useState(false);
  const [dEditing, setDEditing] = useState<Driver | null>(null);
  const [dConfirm, setDConfirm] = useState<number | null>(null);
  const dSave = async (data: NewDriver, id?: number) => { await onSaveDriver(data, id); setDModal(false); setDEditing(null); };

  // --- zone modal state ---
  const [zModal, setZModal] = useState(false);
  const [zEditing, setZEditing] = useState<Zone | null>(null);
  const [zConfirm, setZConfirm] = useState<number | null>(null);
  const zSave = async (data: NewZone, id?: number) => { await onSaveZone(data, id); setZModal(false); setZEditing(null); };

  const online = drivers.filter((d) => d.is_online).length;

  return (
    <>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
          <IconTruck width={16} height={16} /> คนขับ / ขนส่ง <span className="tab-count">{drivers.length}</span>
        </button>
        <button className={`tab${tab === 'zones' ? ' active' : ''}`} onClick={() => setTab('zones')}>
          <IconPin width={16} height={16} /> โซนจัดส่ง <span className="tab-count">{zones.length}</span>
        </button>
      </div>

      {tab === 'drivers' ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>จัดการคนขับ / ขนส่ง</h3>
              <div className="sub">เพิ่ม แก้ไข ลบ ได้เอง · บันทึกลงฐานข้อมูลทันที</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="sub">ทั้งหมด {drivers.length} · ออนไลน์ {online}</span>
              <button className="btn btn-primary" onClick={() => { setDEditing(null); setDModal(true); }}><IconPlus /> เพิ่มคนขับ</button>
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
                        <button className={`drv-status ${d.is_online ? 'on' : 'off'}`} onClick={() => onToggleOnline(d.id, !d.is_online)} title="คลิกเพื่อสลับสถานะ">
                          <span className="drv-dot" />
                          {d.is_online ? 'ออนไลน์' : 'ออฟไลน์'}
                        </button>
                      </td>
                      <td>
                        {dConfirm === d.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="mini-btn danger" onClick={async () => { await onDeleteDriver(d.id); setDConfirm(null); }}>ยืนยันลบ</button>
                            <button className="mini-btn" onClick={() => setDConfirm(null)}>ยกเลิก</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="mini-btn" onClick={() => { setDEditing(d); setDModal(true); }}>แก้ไข</button>
                            <button className="mini-btn danger" onClick={() => setDConfirm(d.id)}>ลบ</button>
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
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>จัดการโซนจัดส่ง</h3>
              <div className="sub">โซนใช้แบ่งงานในหน้าวางแผน/ออเดอร์ · เพิ่มได้ เช่น “ต่างประเทศ”</div>
            </div>
            <button className="btn btn-primary" onClick={() => { setZEditing(null); setZModal(true); }}><IconPlus /> เพิ่มโซน</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th style={{ width: 90 }}>สี</th>
                  <th>ชื่อโซน</th>
                  <th style={{ width: 128 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 ? (
                  <tr><td colSpan={4} className="loading">ยังไม่มีโซน — กด “เพิ่มโซน”</td></tr>
                ) : (
                  zones.map((z, i) => (
                    <tr key={z.id}>
                      <td>{i + 1}</td>
                      <td><span className="zone-pill" style={{ background: z.color + '22', color: z.color }}>{z.name}</span></td>
                      <td style={{ fontWeight: 600 }}>{z.name}</td>
                      <td>
                        {zConfirm === z.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="mini-btn danger" onClick={async () => { await onDeleteZone(z.id); setZConfirm(null); }}>ยืนยันลบ</button>
                            <button className="mini-btn" onClick={() => setZConfirm(null)}>ยกเลิก</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="mini-btn" onClick={() => { setZEditing(z); setZModal(true); }}>แก้ไข</button>
                            <button className="mini-btn danger" onClick={() => setZConfirm(z.id)}>ลบ</button>
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
      )}

      {dModal && <DriverModal driver={dEditing} onClose={() => { setDModal(false); setDEditing(null); }} onSave={dSave} />}
      {zModal && <ZoneModal zone={zEditing} onClose={() => { setZModal(false); setZEditing(null); }} onSave={zSave} />}
    </>
  );
}
