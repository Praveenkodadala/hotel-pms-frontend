import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = { hotel_admin: 'Hotel Admin', manager: 'Manager', receptionist: 'Receptionist', housekeeping: 'Housekeeping' };
const STATUS_BADGE = { active: 'badge-green', disabled: 'badge-red', invited: 'badge-amber' };

export default function HotelAdminPage() {
  const { isAtLeast } = useAuth();
  const [users, setUsers] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [tab, setTab] = useState('users');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'receptionist', phone: '' });

  const load = async () => {
    const [u, h] = await Promise.all([api.get('/admin/users'), api.get('/admin/hotel')]);
    setUsers(u.data);
    setHotel(h.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditUser(null); setForm({ name: '', email: '', password: '', role: 'receptionist', phone: '' }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', status: u.status }); setShowModal(true); };

  const save = async () => {
    if (!editUser && (!form.name || !form.email || !form.password)) return toast.error('Name, email, password required');
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, { name: form.name, phone: form.phone, role: form.role, status: form.status });
      } else {
        await api.post('/admin/users', form);
      }
      toast.success(editUser ? 'User updated' : 'User created');
      setShowModal(false); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const resetPassword = async (userId) => {
    const pwd = prompt('Enter new password (min 8 chars):');
    if (!pwd || pwd.length < 8) return toast.error('Password too short');
    try { await api.patch(`/admin/users/${userId}/reset-password`, { new_password: pwd }); toast.success('Password reset'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const disableUser = async (userId) => {
    if (!window.confirm('Disable this user?')) return;
    try { await api.delete(`/admin/users/${userId}`); toast.success('User disabled'); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Hotel Administration</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['users', 'Staff users'], ['hotel', 'Hotel profile'], ['subscription', 'Subscription']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 rounded-lg text-sm border transition-colors ${tab === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">{users.length} staff members</div>
            {isAtLeast('hotel_admin') && <button onClick={openCreate} className="btn btn-primary">+ Add staff</button>}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th>
                <th className="th">Phone</th><th className="th">Status</th><th className="th">Last login</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="td font-medium">{u.name}</td>
                    <td className="td text-gray-500">{u.email}</td>
                    <td className="td"><span className="badge badge-blue text-xs">{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td className="td text-gray-500">{u.phone || '—'}</td>
                    <td className="td"><span className={`badge text-xs ${STATUS_BADGE[u.status] || 'badge-gray'}`}>{u.status}</span></td>
                    <td className="td text-xs text-gray-400">{fmtDate(u.last_login_at)}</td>
                    <td className="td">
                      {isAtLeast('hotel_admin') && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)} className="btn btn-sm">Edit</button>
                          <button onClick={() => resetPassword(u.id)} className="btn btn-sm">Reset pwd</button>
                          {u.status === 'active' && <button onClick={() => disableUser(u.id)} className="btn btn-sm btn-danger">Disable</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hotel profile tab */}
      {tab === 'hotel' && hotel && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-sm font-semibold mb-4">Hotel details</h2>
            <div className="space-y-3 text-sm">
              {[['Hotel name', hotel.name], ['Email', hotel.email], ['Phone', hotel.phone], ['Website', hotel.website], ['Address', hotel.address], ['City', hotel.city], ['State', hotel.state], ['Country', hotel.country], ['GSTIN', hotel.gstin]].map(([l, v]) => (
                <div key={l} className="flex"><span className="text-gray-400 w-32 flex-shrink-0">{l}</span><span className="font-medium">{v || '—'}</span></div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold mb-4">Status</h2>
            <div className="space-y-3 text-sm">
              <div className="flex"><span className="text-gray-400 w-32">Status</span><span className={`badge ${hotel.status === 'active' ? 'badge-green' : 'badge-red'}`}>{hotel.status}</span></div>
              <div className="flex"><span className="text-gray-400 w-32">Subscription</span><span className={`badge ${hotel.subscription_active ? 'badge-green' : 'badge-red'}`}>{hotel.subscription_active ? 'Active' : 'Expired'}</span></div>
              <div className="flex"><span className="text-gray-400 w-32">Plan</span><span className="font-medium">{hotel.plan_name || '—'}</span></div>
              <div className="flex"><span className="text-gray-400 w-32">Expires</span><span>{fmtDate(hotel.subscription_end)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription tab */}
      {tab === 'subscription' && hotel && (
        <div className="card max-w-lg">
          <h2 className="text-sm font-semibold mb-4">Subscription</h2>
          <div className="space-y-3 text-sm">
            <div className="p-4 rounded-lg bg-brand-50 border border-brand-100">
              <div className="text-brand-700 font-semibold text-base">{hotel.plan_name || 'No plan'}</div>
              <div className="text-brand-600 text-xs mt-1">Up to {hotel.max_rooms} rooms · {hotel.max_users} users</div>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">Start date</span><span>{fmtDate(hotel.subscription_start)}</span></div>
            <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">End date</span><span>{fmtDate(hotel.subscription_end)}</span></div>
            <div className="flex justify-between py-2"><span className="text-gray-500">Status</span><span className={`badge ${hotel.subscription_active ? 'badge-green' : 'badge-red'}`}>{hotel.subscription_active ? 'Active' : 'Expired'}</span></div>
            <p className="text-xs text-gray-400 mt-4">To upgrade or renew your subscription, contact your system administrator.</p>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">{editUser ? 'Edit staff member' : 'Add staff member'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {!editUser && (
              <>
                <label className="label mt-3">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <label className="label mt-3">Password</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
              </>
            )}
            <label className="label mt-3">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 00000" />
            <label className="label mt-3">Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {editUser && (
              <>
                <label className="label mt-3">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={save} className="btn btn-primary flex-1 justify-center">{editUser ? 'Save changes' : 'Create user'}</button>
              <button onClick={() => setShowModal(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
