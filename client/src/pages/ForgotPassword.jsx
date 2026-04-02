import { useState } from 'react';
import api from '../api';
import { Mail, ArrowLeft, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      setTimeout(() => navigate('/reset-password', { state: { email } }), 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass fade-in">
        <Link to="/login" className="back-link"><ArrowLeft size={16} /> Back to Login</Link>
        <h2>Forgot Password?</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Enter your email address and we'll send you an OTP to reset your password.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <Loader className="spin" size={20} /> : 'Send Reset Link'}
          </button>
        </form>
        {message && <p className="success-message" style={{ marginTop: '1rem', color: 'var(--success)' }}>{message}</p>}
      </div>
    </div>
  );
};

export default ForgotPassword;
