import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ title, items, onClick }) {
  const location = useLocation();

  return (
    <aside className='sidebar'>
      <h3>{title}</h3>
      <nav className='sidebar-nav'>
        {items.map((item) => {
          // If item has onClick (section switching) use button; otherwise use Link (navigation)
          const isActive = item.active || location.pathname === item.to;
          const className = `sidebar-link ${isActive ? 'active' : ''}`;

          return item.onClick ? (
            <button
              key={item.section || item.label}
              className={className}
              onClick={() => item.onClick()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                padding: '0.55rem 0.65rem',
                font: 'inherit',
                color: 'inherit',
                borderRadius: '10px',
                fontWeight: '600',
              }}
            >
              {item.label}
            </button>
          ) : (
            <Link key={item.to} to={item.to} className={className}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

