import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomsPage from './pages/RoomsPage';
import ReservationsPage from './pages/ReservationsPage';
import CheckInOutPage from './pages/CheckInOutPage';
import RatesPage from './pages/RatesPage';
import InvoicesPage from './pages/InvoicesPage';
import ChannelsPage from './pages/ChannelsPage';
import HousekeepingPage from './pages/HousekeepingPage';
import HotelAdminPage from './pages/HotelAdminPage';
import SuperAdminPage from './pages/superadmin/SuperAdminPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 text-sm">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="checkinout" element={<CheckInOutPage />} />
        <Route path="housekeeping" element={<HousekeepingPage />} />
        <Route path="rates" element={<RatesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="admin" element={<HotelAdminPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
