import { useState } from 'react';
import api from '../api';
import { ShieldCheck, Lock, Loader } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState({ email: state?.email || '', otp: '', newPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', data);
      alert('Password reset successfully! Please login.');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass fade-in">
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>OTP from Email</label>
            <div className="input-with-icon">
              <ShieldCheck size={18} />
              <input type="text" onChange={e => setData({...data, otp: e.target.value})} required />
            </div>
          </div>
          <div className="input-group">
            <label>New Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input type="password" onChange={e => setData({...data, newPassword: e.target.value})} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <Loader className="spin" size={20} /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
