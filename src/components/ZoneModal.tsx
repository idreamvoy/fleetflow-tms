import { useState } from 'react';
import type { Zone, NewZone } from '../lib/types';

const SWATCHES = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#a855f7', '#ec4899', '#64748b'];

export default function ZoneModal({
  zone,
  onClose,
  onSave,
}: {
  zone?: Zone | null;
  onClose: () => void;
  onSave: (data: NewZone, id?: number) => Promise<void>;
}) {
  const isEdit = !!zone;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(zone?.name ?? '');
  const [color, setColor] = useState(zone?.color ?? SWATCHES[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name, color }, zone?.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <h3>{isEdit ? `แก้ไขโซน · ${zone!.name}` : 'เพิ่มโซนจัดส่ง'}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label>ชื่อโซน *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ต่างประเทศ / ภาคเหนือ" autoFocus required />
            </div>
            <div className="field">
              <label>สีประจำโซน</label>
              <div className="zone-swatches">
                {SWATCHES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`zone-swatch${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={c}
                  />
                ))}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="zone-color-input" title="เลือกสีเอง" />
              </div>
            </div>
            <div className="zone-preview">
              <span className="zone-pill" style={{ background: color + '22', color }}>{name || 'ตัวอย่างโซน'}</span>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'กำลังบันทึก…' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มโซน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
