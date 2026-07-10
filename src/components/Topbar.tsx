import { IconSearch, IconBell } from './icons';

export default function Topbar({
  title,
  subtitle,
  onMenu,
  search,
  onSearch,
}: {
  title: string;
  subtitle: string;
  onMenu: () => void;
  search: string;
  onSearch: (v: string) => void;
}) {
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
        <button className="icon-btn" title="การแจ้งเตือน">
          <IconBell />
          <span className="icon-badge">4</span>
        </button>
        <div className="avatar">TMS</div>
      </div>
    </header>
  );
}
