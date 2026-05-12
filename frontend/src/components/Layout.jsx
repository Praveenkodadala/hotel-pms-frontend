/**
 * Layout.jsx — Updated with PropertySwitcher in sidebar
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PropertySwitcher from './PropertySwitcher';

const allNav = [
  { to: '/dashboard',    label: 'Dashboard',    icon: '⊞', roles: ['hotel_admin','manager','receptionist','housekeeping'] },
  { to: '/rooms',        label: 'Rooms',        icon: '🏠', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/reservations', label: 'Reservations', icon: '📋', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/checkinout',   label: 'Check In/Out', icon: '🔑', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/housekeeping', label: 'Housekeeping', icon: '🧹', roles: ['hotel_admin','manager','receptionist','housekeeping'] },
  { to: '/invoices',     label: 'Invoices',     icon: '🧾', roles: ['hotel_admin','manager','receptionist'] },
  { to: '/rates',        label: 'Rates',        icon: '₹',  roles: ['hotel_admin','manager'] },
  { to: '/channels',     label: 'Channels',     icon: '🔗', roles: ['hotel_admin','manager'] },
  { to: '/admin',        label: 'Hotel Admin',  icon: '⚙️', roles: ['hotel_admin'] },
  { to: '/calendar',     label: 'Calendar',     icon: '📅', roles: ['hotel_admin','manager','receptionist'] },
];

const ROLE_LABELS = { hotel_admin: 'Hotel Admin', manager: 'Manager', receptionist: 'Receptionist', housekeeping: 'Housekeeping' };
const ROLE_BADGE  = { hotel_admin: 'bg-blue-50 text-blue-700', manager: 'bg-emerald-50 text-emerald-700', receptionist: 'bg-amber-50 text-amber-700', housekeeping: 'bg-purple-50 text-purple-700' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav      = allNav.filter(n => n.roles.includes(user?.role));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">

        {/* Brand + PropertySwitcher */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="text-lg font-semibold text-gray-900 mb-2">
            <span className="text-brand-600">H</span>otel PMS
          </div>
          {/* Property dropdown — right of brand as requested */}
          <PropertySwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                 ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }>
              <span className="w-5 text-center text-base leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-700 truncate">{user?.name}</div>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[user?.role] || 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
          <div className="mt-2">
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
