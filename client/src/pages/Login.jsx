import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import './Auth.css';
import { normalizeRole, normalizeUser } from '../utils/userAccess';

const getPostLoginRoute = (role) => {
  switch (normalizeRole(role)) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'DEPT_HEAD':
      return '/department/dashboard';
    case 'WORKER':
      return '/worker/dashboard';
    case 'VOLUNTEER':
      return '/volunteer/dashboard';
    case 'PUBLIC':
    default:
      return '/public/dashboard';
  }
};

const Login = ({ setUser }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', formData);
      const user = normalizeUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      navigate(getPostLoginRoute(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      <motion.div 
        className="auth-image-panel"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-image-content">
          <h1>Civic<span>Hub</span></h1>
          <p>The modern OS for smart communities. Join us in building a better city together.</p>
        </div>
      </motion.div>
      <motion.div 
        className="auth-form-panel"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-card glass">
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to your account</p>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input 
                type="email" 
                name="email" 
                placeholder="admin@civic.com" 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          <p className="auth-footer">Don't have an account? <Link to="/register">Register</Link></p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
