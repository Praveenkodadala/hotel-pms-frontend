import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');

  const load = () => api.get('/invoices').then(r => setInvoices(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const markPaid = async () => {
    try {
      await api.patch(`/invoices/${payModal.id}/pay`, { payment_method: payMethod });
      toast.success('Invoice marked as paid');
      setPayModal(null); load();
    } catch (e) { toast.error('Failed'); }
  };

  const printInvoice = (id) => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    window.open(`${apiBase}/invoices/${id}/html`, '_blank');
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Invoices</h1>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-gray-100">
            <th className="th">Invoice #</th><th className="th">Guest</th><th className="th">Room</th>
            <th className="th">Check-in</th><th className="th">Check-out</th><th className="th">Nights</th>
            <th className="th">Total</th><th className="th">Status</th><th className="th">Actions</th>
          </tr></thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="table-row">
                <td className="td font-mono text-xs font-medium text-brand-600">{inv.inv_number}</td>
                <td className="td"><div className="font-medium">{inv.guest_name}</div><div className="text-xs text-gray-400">{inv.guest_email}</div></td>
                <td className="td">{inv.room_number} <span className="text-gray-400 text-xs">({inv.room_type})</span></td>
                <td className="td text-xs">{fmtDate(inv.check_in)}</td>
                <td className="td text-xs">{fmtDate(inv.check_out)}</td>
                <td className="td">{inv.nights}</td>
                <td className="td font-semibold">₹{Number(inv.grand_total).toLocaleString('en-IN')}</td>
                <td className="td">
                  <span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'cancelled' ? 'badge-red' : 'badge-amber'}`}>
                    {inv.status}
                  </span>
                  {inv.payment_method && <div className="text-xs text-gray-400 mt-0.5">{inv.payment_method}</div>}
                </td>
                <td className="td">
                  <div className="flex gap-2">
                    <button onClick={() => printInvoice(inv.id)} className="btn btn-sm">Print</button>
                    {inv.status === 'unpaid' && <button onClick={() => { setPayModal(inv); setPayMethod('cash'); }} className="btn btn-sm btn-success">Pay</button>}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={9} className="td text-center text-gray-400 py-8">No invoices yet — they are generated at checkout</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-4">Record payment — {payModal.inv_number}</h2>
            <div className="text-sm text-gray-600 mb-4">
              <div>Guest: <strong>{payModal.guest_name}</strong></div>
              <div>Amount: <strong className="text-emerald-700">₹{Number(payModal.grand_total).toLocaleString('en-IN')}</strong></div>
            </div>
            <label className="label">Payment method</label>
            <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {['cash','card','UPI','bank transfer','cheque'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
            <div className="flex gap-3 mt-5">
              <button onClick={markPaid} className="btn btn-success flex-1 justify-center">Confirm payment</button>
              <button onClick={() => setPayModal(null)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
