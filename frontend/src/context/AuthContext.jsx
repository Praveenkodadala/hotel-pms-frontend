/**
 * AuthContext — Multi-property aware (ESM)
 *
 * On login: receives { token, user, properties[], active_property }
 * Stores active_property_id in localStorage so api.js sends it on every call.
 * Exposes switchProperty() which calls /auth/switch-property + updates token.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [properties,     setProperties]     = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [loading,        setLoading]        = useState(true);

  // ── Restore session ───────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('pms_token');
    if (!token) { setLoading(false); return; }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const propertyId = localStorage.getItem('pms_active_property_id');
    if (propertyId) api.defaults.headers.common['X-Property-ID'] = propertyId;

    api.get('/auth/me')
      .then(r => {
        setUser(r.data);
        setProperties(r.data.properties || []);
        const active = r.data.active_property || r.data.properties?.[0] || null;
        setActiveProperty(active);
        if (active?.id) {
          localStorage.setItem('pms_active_property_id', active.id);
          api.defaults.headers.common['X-Property-ID'] = active.id;
        }
      })
      .catch(() => {
        localStorage.removeItem('pms_token');
        localStorage.removeItem('pms_active_property_id');
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pms_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    if (data.active_property?.id) {
      localStorage.setItem('pms_active_property_id', data.active_property.id);
      api.defaults.headers.common['X-Property-ID'] = data.active_property.id;
    }
    setUser(data.user);
    setProperties(data.properties || []);
    setActiveProperty(data.active_property || null);
    return data;
  };

  // ── Logout ────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('pms_token');
    localStorage.removeItem('pms_active_property_id');
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['X-Property-ID'];
    setUser(null);
    setProperties([]);
    setActiveProperty(null);
  };

  // ── Switch property ───────────────────────────────────────────
  const switchProperty = useCallback(async (propertyId) => {
    if (propertyId === activeProperty?.id) return activeProperty;
    const { data } = await api.post('/auth/switch-property', { property_id: propertyId });
    // Update token (has new active_property_id in payload)
    localStorage.setItem('pms_token', data.token);
    api.defaults.headers.common['Authorization']  = `Bearer ${data.token}`;
    localStorage.setItem('pms_active_property_id', propertyId);
    api.defaults.headers.common['X-Property-ID'] = propertyId;
    setActiveProperty(data.active_property);
    // Notify pages to reload their data
    window.dispatchEvent(new CustomEvent('property-switched', { detail: data.active_property }));
    return data.active_property;
  }, [activeProperty?.id]);

  // ── Role helpers ──────────────────────────────────────────────
  const isSuperAdmin = () => user?.role === 'super_admin';
  const isAtLeast    = (role) => {
    const w = { super_admin:100, hotel_admin:80, manager:60, receptionist:40, housekeeping:20 };
    return (w[user?.role] || 0) >= (w[role] || 0);
  };
  const hasRole = (...roles) => roles.includes(user?.role);

  return (
    <AuthContext.Provider value={{
      user, properties, activeProperty,
      loading, login, logout, switchProperty,
      isSuperAdmin, isAtLeast, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
