import { IconGrid, IconRoute, IconBox, IconTruck, IconPin, IconChart } from './icons';

export type PageKey = 'dashboard' | 'planning' | 'orders' | 'driver' | 'tracking' | 'reports';

interface NavDef {
  key: PageKey;
  label: string;
  icon: (p: any) => JSX.Element;
  badge?: number;
}

const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { key: 'planning', label: 'วางแผนจัดส่ง', icon: IconRoute, badge: 4 },
  { key: 'orders', label: 'ออเดอร์', icon: IconBox, badge: 3 },
  { key: 'driver', label: 'Driver app', icon: IconTruck },
  { key: 'tracking', label: 'ติดตามเส้นทาง', icon: IconPin },
  { key: 'reports', label: 'รายงาน', icon: IconChart },
];

export default function Sidebar({
  active,
  onNavigate,
  onlineDrivers,
}: {
  active: PageKey;
  onNavigate: (k: PageKey) => void;
  onlineDrivers: number;
}) {
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <IconTruck width={22} height={22} />
        </div>
        <div>
          <div className="brand-name">FleetFlow</div>
          <div className="brand-sub">TMS · v3.0</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              className={`nav-item${active === n.key ? ' active' : ''}`}
              onClick={() => onNavigate(n.key)}
            >
              <Icon className="nav-icon" width={20} height={20} />
              <span>{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-status">
        <div className="status-title">
          <span className="status-dot" />
          ระบบออนไลน์ · Live
        </div>
        <div className="status-line">รถกำลังวิ่ง {onlineDrivers} คัน</div>
        <div className="status-line">อัปเดตล่าสุด {now}</div>
      </div>
    </aside>
  );
}
