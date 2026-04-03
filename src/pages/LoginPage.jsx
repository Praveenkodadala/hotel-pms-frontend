import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      // Super admin gets own dashboard
      if (user.role === 'super_admin') { navigate('/super-admin'); }
      else { navigate('/dashboard'); }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-semibold text-gray-900 mb-1"><span className="text-brand-600">H</span>otel PMS</div>
          <p className="text-sm text-gray-400">Property Management System</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@hotel.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <div className="font-medium text-gray-500 mb-1">Demo logins:</div>
            <div>🏢 Super Admin: superadmin@hotelpms.io / SuperAdmin@999</div>
            <div>👤 Hotel Admin: admin@hotel.com / Admin@1234</div>
            <div>🔑 Receptionist: frontdesk@hotel.com / Staff@1234</div>
            <div>🧹 Housekeeping: housekeeping@hotel.com / Staff@1234</div>
          </div>
        </div>
      </div>
    </div>
  );
}
