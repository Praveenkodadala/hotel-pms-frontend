import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const nights = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));

export default function CheckInOutPage() {
  const [confirmed, setConfirmed] = useState([]);
  const [checkedIn, setCheckedIn] = useState([]);
  const [selCI, setSelCI] = useState('');
  const [selCO, setSelCO] = useState('');
  const [idType, setIdType] = useState('Aadhar Card');
  const [idNum, setIdNum] = useState('');
  const [ciNotes, setCiNotes] = useState('');
  const [coPreview, setCoPreview] = useState(null);

  const load = () => {
    api.get('/reservations?status=confirmed').then(r => setConfirmed(r.data)).catch(() => {});
    api.get('/reservations?status=checked_in').then(r => setCheckedIn(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const selCIRes = confirmed.find(r => r.id === selCI);
  const selCORes = checkedIn.find(r => r.id === selCO);

  useEffect(() => {
    if (selCORes) {
      const n = nights(selCORes.actual_check_in || selCORes.check_in, new Date());
      const charges = selCORes.base_rate * n;
      setCoPreview({ nights: n, rate: selCORes.base_rate, charges, tax: Math.round(charges * 0.12), grand: charges + Math.round(charges * 0.12) });
    } else setCoPreview(null);
  }, [selCO]);

  const doCheckIn = async () => {
    if (!selCI) return toast.error('Select a reservation');
    if (!idNum.trim()) return toast.error('Enter guest ID number');
    try {
      await api.post(`/checkin/${selCI}`, { id_type: idType, id_number: idNum, notes: ciNotes });
      toast.success(`${selCIRes.first_name} ${selCIRes.last_name} checked in`);
      setSelCI(''); setIdNum(''); setCiNotes(''); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const doCheckOut = async () => {
    if (!selCO) return toast.error('Select a checked-in guest');
    if (!window.confirm(`Check out ${selCORes.first_name} ${selCORes.last_name} and generate invoice?`)) return;
    try {
      const { data } = await api.post(`/checkin/checkout/${selCO}`);
      toast.success(`Checked out · Invoice ${data.invoice.inv_number} generated`);
      setSelCO(''); setCoPreview(null); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Check in / Check out</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Check In */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Check in guest</h2>
          <label className="label">Reservation</label>
          <select className="input" value={selCI} onChange={e => setSelCI(e.target.value)}>
            <option value="">Select confirmed reservation…</option>
            {confirmed.map(r => <option key={r.id} value={r.id}>{r.res_number} — {r.first_name} {r.last_name} (Room {r.room_number})</option>)}
          </select>

          {selCIRes && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-sm border border-emerald-100">
              <div className="font-medium text-emerald-800">{selCIRes.first_name} {selCIRes.last_name}</div>
              <div className="text-emerald-700 text-xs mt-1">
                Room {selCIRes.room_number} ({selCIRes.room_type}) · {nights(selCIRes.check_in, selCIRes.check_out)} nights · {selCIRes.adults} adult{selCIRes.adults > 1 ? 's' : ''}
              </div>
              <div className="text-emerald-600 text-xs">{fmtDate(selCIRes.check_in)} → {fmtDate(selCIRes.check_out)}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="label">ID type</label>
              <select className="input" value={idType} onChange={e => setIdType(e.target.value)}>
                {['Aadhar Card','Passport','PAN Card','Driver Licence','Voter ID'].map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">ID number</label>
              <input className="input" value={idNum} onChange={e => setIdNum(e.target.value)} placeholder="Document number" /></div>
          </div>
          <label className="label mt-3">Notes</label>
          <textarea className="input h-16" value={ciNotes} onChange={e => setCiNotes(e.target.value)} placeholder="Special requests, notes…" />
          <button onClick={doCheckIn} className="btn btn-success mt-4 w-full justify-center">Check in</button>
        </div>

        {/* Check Out */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Check out guest</h2>
          <label className="label">Checked-in guest</label>
          <select className="input" value={selCO} onChange={e => setSelCO(e.target.value)}>
            <option value="">Select checked-in guest…</option>
            {checkedIn.map(r => <option key={r.id} value={r.id}>Room {r.room_number} — {r.first_name} {r.last_name}</option>)}
          </select>

          {selCORes && coPreview && (
            <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice preview</div>
              <div className="p-4 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Guest</span><span className="font-medium">{selCORes.first_name} {selCORes.last_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Room</span><span>{selCORes.room_number} ({selCORes.room_type})</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Nights</span><span>{coPreview.nights}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Rate/night</span><span>₹{Number(coPreview.rate).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Room charges</span><span>₹{Number(coPreview.charges).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GST (12%)</span><span>₹{Number(coPreview.tax).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold text-base">
                  <span>Total</span><span>₹{Number(coPreview.grand).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          <button onClick={doCheckOut} disabled={!selCO} className="btn btn-danger mt-4 w-full justify-center">Check out &amp; generate invoice</button>
        </div>
      </div>
    </div>
  );
}
