import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const allNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞', roles: ['hotel_admin','manager','receptionist','housekeeping'] },
  { to: '/rooms', label: 'Rooms', icon: '🏠', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/reservations', label: 'Reservations', icon: '📋', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/checkinout', label: 'Check In/Out', icon: '🔑', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/housekeeping', label: 'Housekeeping', icon: '🧹', roles: ['hotel_admin','manager','receptionist','housekeeping'] },
  { to: '/invoices', label: 'Invoices', icon: '🧾', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/rates', label: 'Rates', icon: '₹', roles: ['hotel_admin','manager'] },
  { to: '/channels', label: 'Channels', icon: '🔗', roles: ['hotel_admin','manager'] },
  { to: '/admin', label: 'Hotel Admin', icon: '⚙️', roles: ['hotel_admin'] },
];

const ROLE_LABELS = { hotel_admin: 'Hotel Admin', manager: 'Manager', receptionist: 'Receptionist', housekeeping: 'Housekeeping' };
const ROLE_COLORS = { hotel_admin: 'bg-brand-100 text-brand-700', manager: 'bg-emerald-50 text-emerald-700', receptionist: 'bg-amber-50 text-amber-700', housekeeping: 'bg-purple-50 text-purple-700' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = allNav.filter(n => n.roles.includes(user?.role));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-lg font-semibold text-gray-900"><span className="text-brand-600">H</span>otel PMS</div>
          {user?.tenant_name && <div className="text-xs text-gray-400 mt-0.5 truncate">{user.tenant_name}</div>}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
            }>
              <span className="text-base leading-none w-5">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-700 truncate">{user?.name}</div>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[user?.role] || 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
          <div className="mt-2 flex gap-3">
            <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><Outlet /></main>
    </div>
  );
}
