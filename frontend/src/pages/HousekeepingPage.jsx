import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     badge: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  assigned:   { label: 'Assigned',    badge: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500' },
  in_progress:{ label: 'In Progress', badge: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-500' },
  completed:  { label: 'Completed',   badge: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  inspected:  { label: 'Approved',    badge: 'bg-emerald-50 text-emerald-700',dot: 'bg-emerald-500' },
  cancelled:  { label: 'Cancelled',   badge: 'bg-red-50 text-red-600',       dot: 'bg-red-400' },
};

const PRIORITY_BADGE = {
  low: 'bg-gray-50 text-gray-500', normal: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-50 text-amber-700', urgent: 'bg-red-50 text-red-700',
};

export default function HousekeepingPage() {
  const { user, isAtLeast, hasRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filter, setFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({ room_id: '', priority: 'normal', notes: '', assigned_to: '' });
  const [completionNotes, setCompletionNotes] = useState('');
  const [checklist, setChecklist] = useState([]);

  const load = async () => {
    const [tasksRes, staffRes, roomsRes] = await Promise.all([
      api.get('/housekeeping' + (filter ? `?status=${filter}` : '')),
      api.get('/housekeeping/staff'),
      api.get('/rooms'),
    ]);
    setTasks(tasksRes.data);
    setStaff(staffRes.data);
    setRooms(roomsRes.data);
  };
  useEffect(() => { load(); }, [filter]);

  const openTask = async (task) => {
    const { data } = await api.get(`/housekeeping/${task.id}`);
    setSelectedTask(data);
    try { setChecklist(typeof data.checklist === 'string' ? JSON.parse(data.checklist) : (data.checklist || [])); } catch { setChecklist([]); }
    setCompletionNotes(data.completion_notes || '');
  };

  const doAction = async (action, extraBody = {}) => {
    try {
      await api.patch(`/housekeeping/${selectedTask.id}/${action}`, { completion_notes: completionNotes, checklist, ...extraBody });
      toast.success(`Task ${action}ed`);
      setSelectedTask(null); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const assignTask = async (taskId, userId) => {
    try { await api.patch(`/housekeeping/${taskId}/assign`, { assigned_to: userId }); toast.success('Assigned'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const createTask = async () => {
    if (!newTask.room_id) return toast.error('Select a room');
    try {
      await api.post('/housekeeping', newTask);
      toast.success('Task created');
      setShowCreateModal(false);
      setNewTask({ room_id: '', priority: 'normal', notes: '', assigned_to: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const toggleCheckItem = (i) => {
    setChecklist(cl => cl.map((c, idx) => idx === i ? { ...c, done: !c.done } : c));
  };

  const statusCfg = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.pending;
  const fmtTime = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const stats = { total: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Housekeeping</h1>
        {isAtLeast('receptionist') && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">+ New task</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[['Total', stats.total, ''], ['Pending', stats.pending, 'text-gray-600'], ['In Progress', stats.in_progress, 'text-amber-600'], ['Done', stats.completed, 'text-purple-600']].map(([l, v, c]) => (
          <div key={l} className="card py-3">
            <div className="text-xs text-gray-400 mb-1">{l}</div>
            <div className={`text-2xl font-semibold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['', 'All'], ['pending', 'Pending'], ['assigned', 'Assigned'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['inspected', 'Approved']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${filter === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task list */}
        <div className="space-y-3">
          {tasks.length === 0 && <div className="card text-center text-gray-400 py-12 text-sm">No tasks found</div>}
          {tasks.map(task => {
            const cfg = statusCfg(task.status);
            return (
              <div key={task.id} onClick={() => openTask(task)}
                className={`card cursor-pointer hover:shadow-md transition-all ${selectedTask?.id === task.id ? 'ring-2 ring-brand-400' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold">Room {task.room_number}</span>
                      <span className="text-xs text-gray-400">{task.room_type} · Floor {task.floor}</span>
                    </div>
                    {task.last_guest && <div className="text-xs text-gray-400 mb-2">Last guest: {task.last_guest}</div>}
                    <div className="flex gap-2 flex-wrap">
                      <span className={`badge text-xs ${cfg.badge}`}><span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`}></span>{cfg.label}</span>
                      <span className={`badge text-xs ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
                      {task.room_hk_status && <span className="badge text-xs bg-gray-50 text-gray-500">{task.room_hk_status}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {task.assigned_to_name ? (
                      <div className="text-xs text-gray-500">👤 {task.assigned_to_name}</div>
                    ) : isAtLeast('manager') && task.status === 'pending' ? (
                      <select onClick={e => e.stopPropagation()} onChange={e => { if (e.target.value) assignTask(task.id, e.target.value); }}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5">
                        <option value="">Assign…</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : <span className="text-xs text-gray-300">Unassigned</span>}
                    <div className="text-xs text-gray-300 mt-1">{fmtTime(task.created_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Task detail / action panel */}
        {selectedTask && (
          <div className="card self-start sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Room {selectedTask.room_number} — {selectedTask.room_type}</h2>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge text-xs ${statusCfg(selectedTask.status).badge}`}>{statusCfg(selectedTask.status).label}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="capitalize">{selectedTask.priority}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Assigned to</span><span>{selectedTask.assigned_to_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Started</span><span>{fmtTime(selectedTask.started_at)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span>{fmtTime(selectedTask.completed_at)}</span></div>
              {selectedTask.inspected_by_name && <div className="flex justify-between"><span className="text-gray-500">Approved by</span><span>{selectedTask.inspected_by_name}</span></div>}
            </div>

            {selectedTask.notes && (
              <div className="text-xs bg-gray-50 rounded-lg p-3 mb-4 text-gray-600">{selectedTask.notes}</div>
            )}

            {/* Checklist */}
            {checklist.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Checklist</div>
                <div className="space-y-2">
                  {checklist.map((item, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={item.done} onChange={() => toggleCheckItem(i)}
                        disabled={!['in_progress', 'assigned', 'pending'].includes(selectedTask.status)}
                        className="rounded border-gray-300" />
                      <span className={item.done ? 'line-through text-gray-400' : 'text-gray-700'}>{item.item}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2">{checklist.filter(c => c.done).length}/{checklist.length} items done</div>
              </div>
            )}

            {/* Completion notes */}
            {['in_progress', 'assigned', 'pending'].includes(selectedTask.status) && (
              <div className="mb-4">
                <label className="label">Completion notes</label>
                <textarea className="input h-16 text-sm" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="Note any issues, damage, or observations…" />
              </div>
            )}

            {/* Action buttons based on role + status */}
            <div className="flex flex-col gap-2">
              {hasRole('housekeeping', 'manager', 'hotel_admin') && selectedTask.status === 'assigned' && (
                <button onClick={() => doAction('start')} className="btn btn-primary justify-center">▶ Start cleaning</button>
              )}
              {hasRole('housekeeping', 'manager', 'hotel_admin') && selectedTask.status === 'in_progress' && (
                <button onClick={() => doAction('complete')} className="btn justify-center" style={{background:'#7c3aed',color:'white',borderColor:'#7c3aed'}}>✓ Mark complete</button>
              )}
              {isAtLeast('manager') && ['completed', 'in_progress'].includes(selectedTask.status) && (
                <button onClick={() => doAction('inspect')} className="btn btn-success justify-center">✅ Approve — Room available</button>
              )}
              {isAtLeast('manager') && !['inspected', 'cancelled'].includes(selectedTask.status) && (
                <button onClick={() => doAction('cancel')} className="btn btn-danger justify-center text-xs">Cancel task</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">New housekeeping task</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <label className="label">Room</label>
            <select className="input" value={newTask.room_id} onChange={e => setNewTask(t => ({ ...t, room_id: e.target.value }))}>
              <option value="">Select room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} — {r.type} ({r.status})</option>)}
            </select>
            <label className="label mt-3">Priority</label>
            <select className="input" value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
              {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <label className="label mt-3">Assign to (optional)</label>
            <select className="input" value={newTask.assigned_to} onChange={e => setNewTask(t => ({ ...t, assigned_to: e.target.value }))}>
              <option value="">Unassigned</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="label mt-3">Notes</label>
            <textarea className="input h-16" value={newTask.notes} onChange={e => setNewTask(t => ({ ...t, notes: e.target.value }))} placeholder="Special instructions…" />
            <div className="flex gap-3 mt-5">
              <button onClick={createTask} className="btn btn-primary flex-1 justify-center">Create task</button>
              <button onClick={() => setShowCreateModal(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
