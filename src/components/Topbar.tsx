import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconBell } from './icons';

export interface Notification {
  id: string;
  icon: string;
  title: string;
  detail: string;
  level: 'danger' | 'warn' | 'info';
  page?: 'orders' | 'planning' | 'tracking';
}

export default function Topbar({
  title,
  subtitle,
  onMenu,
  search,
  onSearch,
  notifications,
  onOpenNotification,
}: {
  title: string;
  subtitle: string;
  onMenu: () => void;
  search: string;
  onSearch: (v: string) => void;
  notifications: Notification[];
  onOpenNotification: (n: Notification) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกนอกกล่อง หรือกด Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onMenu} aria-label="เมนู">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="search">
        <IconSearch />
        <input
          placeholder="ค้นหาออเดอร์ / ลูกค้า"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="notif-wrap" ref={wrapRef}>
          <button
            className={`icon-btn${open ? ' active' : ''}`}
            title="การแจ้งเตือน"
            onClick={() => setOpen((v) => !v)}
          >
            <IconBell />
            {notifications.length > 0 && <span className="icon-badge">{notifications.length}</span>}
          </button>

          {open && (
            <div className="notif-panel">
              <div className="notif-head">
                <span>การแจ้งเตือน</span>
                <span className="sub">{notifications.length} รายการ</span>
              </div>
              {notifications.length === 0 ? (
                <div className="notif-empty">✓ ไม่มีเรื่องต้องจัดการตอนนี้</div>
              ) : (
                <div className="notif-list">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      className={`notif-item ${n.level}`}
                      onClick={() => { setOpen(false); onOpenNotification(n); }}
                    >
                      <span className="notif-ico">{n.icon}</span>
                      <span className="notif-body">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-detail">{n.detail}</span>
                      </span>
                      {n.page && <span className="notif-go">→</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="avatar">TMS</div>
      </div>
    </header>
  );
}
