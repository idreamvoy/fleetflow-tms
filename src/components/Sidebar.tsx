import { IconGrid, IconRoute, IconBox, IconTruck, IconPin, IconChart, IconSettings, IconChevronLeft } from './icons';

export type PageKey = 'dashboard' | 'planning' | 'orders' | 'driver' | 'tracking' | 'reports' | 'settings';

interface NavDef {
  key: PageKey;
  label: string;
  icon: (p: any) => JSX.Element;
}

// ชื่อเมนูเป็นภาษาอังกฤษล้วน ให้เหมือนระบบ TMS จริง
const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { key: 'orders', label: 'Orders', icon: IconBox },
  { key: 'planning', label: 'Planning', icon: IconRoute },
  { key: 'driver', label: 'Driver App', icon: IconTruck },
  { key: 'tracking', label: 'Tracking', icon: IconPin },
  { key: 'reports', label: 'Reports', icon: IconChart },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export default function Sidebar({
  active,
  onNavigate,
  badges,
  runningTrips,
  collapsed,
  onToggleCollapsed,
}: {
  active: PageKey;
  onNavigate: (k: PageKey) => void;
  badges: Partial<Record<PageKey, number>>;
  runningTrips: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-logo">
          <IconTruck width={22} height={22} />
        </div>
        <div className="brand-text">
          <div className="brand-name">FleetFlow</div>
          <div className="brand-sub">TMS · v3.0</div>
        </div>
      </div>

      <button
        className="sidebar-collapse-btn"
        onClick={onToggleCollapsed}
        title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
      >
        <IconChevronLeft width={16} height={16} style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} />
      </button>

      <nav className="nav">
        {NAV.map((n) => {
          const Icon = n.icon;
          const badge = badges?.[n.key];
          return (
            <button
              key={n.key}
              className={`nav-item${active === n.key ? ' active' : ''}`}
              onClick={() => onNavigate(n.key)}
              title={collapsed ? n.label : undefined}
            >
              <Icon className="nav-icon" width={20} height={20} />
              <span className="nav-label">{n.label}</span>
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-status">
        <div className="status-title">
          <span className="status-dot" />
          <span className="nav-label">ระบบออนไลน์ · Live</span>
        </div>
        <div className="status-line nav-label">รถกำลังวิ่ง {runningTrips} คัน</div>
        <div className="status-line nav-label">อัปเดตล่าสุด {now}</div>
      </div>
    </aside>
  );
}
