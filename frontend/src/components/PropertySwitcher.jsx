/**
 * PropertySwitcher — navbar dropdown for multi-property switching
 *
 * Placed in Layout.jsx below the "Hotel PMS" brand name.
 * When user picks a property:
 *   1. Calls switchProperty(id) in AuthContext
 *   2. Backend validates access + issues new JWT
 *   3. X-Property-ID header updated globally
 *   4. 'property-switched' event fires → pages re-fetch data
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PropertySwitcher() {
  const { user, properties, activeProperty, switchProperty, isSuperAdmin } = useAuth();
  const [open,     setOpen]     = useState(false);
  const [busy,     setBusy]     = useState(false);
  const dropRef                 = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSwitch = useCallback(async (property) => {
    if (property.id === activeProperty?.id) { setOpen(false); return; }
    setBusy(true); setOpen(false);
    try {
      await switchProperty(property.id);
      toast.success(`Switched to ${property.name}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to switch property');
    } finally { setBusy(false); }
  }, [activeProperty?.id, switchProperty]);

  // Don't render if user only has one property and is not super admin
  if (!properties || properties.length === 0) return null;
  if (properties.length === 1 && !isSuperAdmin()) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 truncate">
        <span>🏨</span>
        <span className="truncate">{activeProperty?.name || properties[0]?.name}</span>
      </div>
    );
  }

  return (
    <div ref={dropRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left transition-colors text-sm
          ${open ? 'bg-gray-100 border-gray-200' : 'bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
        title="Switch property"
      >
        {/* Logo / initial */}
        <span
          className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ background: activeProperty?.primary_color || '#185FA5' }}
        >
          {(activeProperty?.code || activeProperty?.name || 'P')[0]}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-800 truncate">
            {activeProperty?.name || 'Select property'}
          </div>
          {activeProperty?.city && (
            <div className="text-xs text-gray-400 leading-none">{activeProperty.city}</div>
          )}
        </div>

        {busy ? (
          <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        ) : (
          <span className={`text-gray-400 text-xs flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          style={{ minWidth: 220 }}>
          <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
            Switch property
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {properties.map(prop => {
              const isActive = prop.id === activeProperty?.id;
              return (
                <button key={prop.id} onClick={() => handleSwitch(prop)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors
                    ${isActive ? 'bg-brand-50' : ''}`}>
                  <span
                    className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: prop.primary_color || '#185FA5' }}
                  >
                    {(prop.code || prop.name)[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-brand-700' : 'text-gray-800'}`}>
                      {prop.name}
                      {isActive && <span className="ml-1 text-brand-500">✓</span>}
                    </div>
                    {prop.city && (
                      <div className="text-xs text-gray-400">{prop.city}{prop.code ? ` · ${prop.code}` : ''}</div>
                    )}
                  </div>
                  {prop.total_rooms > 0 && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{prop.total_rooms}r</span>
                  )}
                </button>
              );
            })}
          </div>

          {isSuperAdmin() && (
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                className="text-xs text-brand-600 hover:underline"
                onClick={() => { setOpen(false); window.location.href = '/super-admin'; }}
              >
                Manage all properties →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
