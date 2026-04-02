import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import './Auth.css';

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-otp', { email, otp });
      alert('Verification successful! Please log in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <h2>Verify OTP</h2>
        <p className="subtitle">Enter the 6-digit code sent to {email}</p>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="000000" 
            maxLength="6"
            value={otp}
            onChange={(e) => setOtp(e.target.value)} 
            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
            required 
          />
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
};

export default OTPVerification;
