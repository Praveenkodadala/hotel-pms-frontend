import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const STATUS_BADGE = { active: 'badge-green', disabled: 'badge-red', suspended: 'badge-red', pending: 'badge-amber' };

function StatCard({ label, value, color }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('tenants');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [search, setSearch] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name:'', email:'', phone:'', address:'', city:'', state:'', gstin:'', plan_id:'', admin_name:'', admin_email:'', admin_password:'' });
  const [userForm, setUserForm] = useState({ tenant_id:'', name:'', email:'', password:'', role:'receptionist' });

  const load = async () => {
    try {
      const [t, u, p, s, a] = await Promise.all([
        api.get('/super-admin/tenants' + (search ? `?search=${search}` : '')),
        api.get('/super-admin/users'),
        api.get('/super-admin/plans'),
        api.get('/super-admin/stats'),
        api.get('/super-admin/audit-log'),
      ]);
      setTenants(t.data); setUsers(u.data); setPlans(p.data); setStats(s.data); setAuditLog(a.data);
    } catch (e) { toast.error('Failed to load data'); }
  };
  useEffect(() => { load(); }, [search]);

  const createTenant = async () => {
    if (!tenantForm.name || !tenantForm.email || !tenantForm.admin_email || !tenantForm.admin_password)
      return toast.error('Hotel name, email, admin email and password required');
    try {
      await api.post('/super-admin/tenants', tenantForm);
      toast.success('Hotel created');
      setShowCreateTenant(false);
      setTenantForm({ name:'', email:'', phone:'', address:'', city:'', state:'', gstin:'', plan_id:'', admin_name:'', admin_email:'', admin_password:'' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const createUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) return toast.error('Name, email, password required');
    try {
      await api.post('/super-admin/users', userForm);
      toast.success('User created'); setShowCreateUser(false); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const toggleTenant = async (id, status) => {
    const action = status === 'active' ? 'disable' : 'enable';
    const reason = action === 'disable' ? prompt('Reason for disabling?') : undefined;
    try {
      await api.patch(`/super-admin/tenants/${id}/${action}`, { reason });
      toast.success(`Hotel ${action}d`); load();
    } catch (e) { toast.error('Failed'); }
  };

  const toggleUser = async (id, status) => {
    const action = status === 'active' ? 'disable' : 'enable';
    try { await api.patch(`/super-admin/users/${id}/${action}`); toast.success(`User ${action}d`); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const updateSub = async (tenant) => {
    const days = prompt(`Extend subscription by how many days? (current end: ${tenant.subscription_end ? new Date(tenant.subscription_end).toLocaleDateString() : 'none'})`);
    if (!days) return;
    const newEnd = new Date(tenant.subscription_end || Date.now());
    newEnd.setDate(newEnd.getDate() + parseInt(days));
    try {
      await api.patch(`/super-admin/tenants/${tenant.id}/subscription`, { subscription_end: newEnd.toISOString().split('T')[0], subscription_active: true });
      toast.success('Subscription updated'); load();
    } catch (e) { toast.error('Failed'); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-900"><span className="text-brand-600">H</span>otel PMS — Super Admin</div>
          <div className="text-xs text-gray-400">Platform management dashboard</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">{user?.name}</div>
          <span className="badge bg-purple-50 text-purple-700 text-xs">Super Admin</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn btn-sm">Sign out</button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total hotels" value={(stats.tenants.active || 0) + (stats.tenants.disabled || 0)} />
            <StatCard label="Active hotels" value={stats.tenants.active || 0} color="text-emerald-600" />
            <StatCard label="Disabled" value={stats.tenants.disabled || 0} color="text-red-600" />
            <StatCard label="Active subs" value={stats.subscriptions?.active_subs || 0} color="text-brand-600" />
            <StatCard label="Expired subs" value={stats.subscriptions?.expired_subs || 0} color="text-amber-600" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[['tenants', '🏨 Hotels'], ['users', '👥 Users'], ['plans', '💳 Plans'], ['audit', '📋 Audit log']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 rounded-lg text-sm border transition-colors ${tab === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{l}</button>
          ))}
        </div>

        {/* ── TENANTS TAB ── */}
        {tab === 'tenants' && (
          <div>
            <div className="flex gap-3 mb-4">
              <input className="input max-w-xs" placeholder="Search hotels…" value={search} onChange={e => setSearch(e.target.value)} />
              <button onClick={() => setShowCreateTenant(true)} className="btn btn-primary">+ Add hotel</button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="th">Hotel</th><th className="th">Email</th><th className="th">Plan</th>
                  <th className="th">Sub. end</th><th className="th">Status</th><th className="th">Actions</th>
                </tr></thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t.id} className="table-row">
                      <td className="td"><div className="font-medium">{t.name}</div><div className="text-xs text-gray-400">{t.city}</div></td>
                      <td className="td text-sm text-gray-500">{t.email}</td>
                      <td className="td"><span className="badge badge-blue text-xs">{t.plan_name || '—'}</span></td>
                      <td className="td">
                        <div className="text-xs">{fmtDate(t.subscription_end)}</div>
                        {!t.subscription_active && <span className="badge badge-red text-xs mt-0.5">Expired</span>}
                      </td>
                      <td className="td"><span className={`badge text-xs ${STATUS_BADGE[t.status] || 'badge-gray'}`}>{t.status}</span></td>
                      <td className="td">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => updateSub(t)} className="btn btn-sm">+ Sub</button>
                          <button onClick={() => toggleTenant(t.id, t.status)} className={`btn btn-sm ${t.status === 'active' ? 'btn-danger' : 'btn-success'}`}>
                            {t.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && <tr><td colSpan={6} className="td text-center text-gray-400 py-8">No hotels found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setShowCreateUser(true)} className="btn btn-primary">+ Create user</button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="th">Name</th><th className="th">Email</th><th className="th">Hotel</th>
                  <th className="th">Role</th><th className="th">Status</th><th className="th">Last login</th><th className="th"></th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="table-row">
                      <td className="td font-medium">{u.name}</td>
                      <td className="td text-sm text-gray-500">{u.email}</td>
                      <td className="td text-sm text-gray-500">{u.tenant_name || <span className="text-purple-600 text-xs font-medium">Platform</span>}</td>
                      <td className="td"><span className="badge badge-blue text-xs">{u.role}</span></td>
                      <td className="td"><span className={`badge text-xs ${STATUS_BADGE[u.status] || 'badge-gray'}`}>{u.status}</span></td>
                      <td className="td text-xs text-gray-400">{fmtTime(u.last_login_at)}</td>
                      <td className="td">
                        {u.role !== 'super_admin' && (
                          <button onClick={() => toggleUser(u.id, u.status)} className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}>
                            {u.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {tab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.id} className="card">
                <div className="text-lg font-semibold text-brand-700 mb-1">{p.name}</div>
                <div className="text-sm text-gray-500 mb-3">{p.description}</div>
                <div className="text-2xl font-bold text-gray-900 mb-4">₹{Number(p.price_monthly).toLocaleString('en-IN')}<span className="text-sm font-normal text-gray-400">/mo</span></div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Max rooms</span><span className="font-medium">{p.max_rooms === 9999 ? 'Unlimited' : p.max_rooms}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Max users</span><span className="font-medium">{p.max_users === 9999 ? 'Unlimited' : p.max_users}</span></div>
                </div>
                {p.features && (() => {
                  try {
                    const f = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
                    return (
                      <div className="mt-3 space-y-1">
                        {Object.entries(f).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-xs">
                            <span className={v ? 'text-emerald-500' : 'text-gray-300'}>{v ? '✓' : '✗'}</span>
                            <span className={v ? 'text-gray-700' : 'text-gray-400'}>{k.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>
            ))}
          </div>
        )}

        {/* ── AUDIT LOG TAB ── */}
        {tab === 'audit' && (
          <div className="card">
            <div className="space-y-0">
              {auditLog.map(l => (
                <div key={l.id} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                  <div className="text-xs text-gray-300 w-36 flex-shrink-0 mt-0.5">{fmtTime(l.created_at)}</div>
                  <div className="w-32 flex-shrink-0"><span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{l.action}</span></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-600">{l.tenant_name || '—'}</span>
                    {l.user_name && <span className="text-gray-400 text-xs ml-2">by {l.user_name}</span>}
                  </div>
                </div>
              ))}
              {auditLog.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No audit events</p>}
            </div>
          </div>
        )}
      </div>

      {/* Create Hotel Modal */}
      {showCreateTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8" onClick={e => e.target === e.currentTarget && setShowCreateTenant(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Add new hotel</h2>
              <button onClick={() => setShowCreateTenant(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Hotel details</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Hotel name *</label><input className="input" value={tenantForm.name} onChange={e => setTenantForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Email *</label><input className="input" type="email" value={tenantForm.email} onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={tenantForm.phone} onChange={e => setTenantForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Address</label><input className="input" value={tenantForm.address} onChange={e => setTenantForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">City</label><input className="input" value={tenantForm.city} onChange={e => setTenantForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><label className="label">GSTIN</label><input className="input" value={tenantForm.gstin} onChange={e => setTenantForm(f => ({ ...f, gstin: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Subscription plan</label>
                <select className="input" value={tenantForm.plan_id} onChange={e => setTenantForm(f => ({ ...f, plan_id: e.target.value }))}>
                  <option value="">No plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price_monthly).toLocaleString('en-IN')}/mo</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-5 mb-3">First admin user</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Admin name</label><input className="input" value={tenantForm.admin_name} onChange={e => setTenantForm(f => ({ ...f, admin_name: e.target.value }))} /></div>
              <div><label className="label">Admin email *</label><input className="input" type="email" value={tenantForm.admin_email} onChange={e => setTenantForm(f => ({ ...f, admin_email: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Admin password *</label><input className="input" type="password" value={tenantForm.admin_password} onChange={e => setTenantForm(f => ({ ...f, admin_password: e.target.value }))} placeholder="Min 8 characters" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={createTenant} className="btn btn-primary flex-1 justify-center">Create hotel</button>
              <button onClick={() => setShowCreateTenant(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setShowCreateUser(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Create user</h2>
              <button onClick={() => setShowCreateUser(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <label className="label">Hotel (tenant)</label>
            <select className="input" value={userForm.tenant_id} onChange={e => setUserForm(f => ({ ...f, tenant_id: e.target.value }))}>
              <option value="">Platform (no hotel)</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="label mt-3">Name</label><input className="input" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
            <label className="label mt-3">Email</label><input className="input" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
            <label className="label mt-3">Password</label><input className="input" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
            <label className="label mt-3">Role</label>
            <select className="input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
              {['super_admin','hotel_admin','manager','receptionist','housekeeping'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-3 mt-5">
              <button onClick={createUser} className="btn btn-primary flex-1 justify-center">Create</button>
              <button onClick={() => setShowCreateUser(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
