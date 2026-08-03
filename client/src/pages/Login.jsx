import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import './Auth.css';
import { normalizeRole, normalizeUser } from '../utils/userAccess';
import { MapPin, Building2, BarChart3, BellRing } from 'lucide-react';

const Counter = ({ end, label }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end]);

  return (
    <div style={{ padding: '0.75rem', borderRadius: '12px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0', color: 'white' }}>{count.toLocaleString()}+</h3>
      <p style={{ fontSize: '0.75rem', margin: '0', color: '#cbd5e1' }}>{label}</p>
    </div>
  );
};


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
  const location = useLocation();
  const [error, setError] = useState(location.state?.message || '');
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
        {/* Floating Particles (CSS handled in inline/Auth.css but we can just use simple absolute divs) */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2]
              }}
              transition={{
                duration: 3 + i,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                position: 'absolute',
                top: `${20 + i * 15}%`,
                left: `${10 + (i * 25) % 80}%`,
                width: '4px',
                height: '4px',
                background: 'white',
                borderRadius: '50%',
                boxShadow: '0 0 10px white'
              }}
            />
          ))}
        </div>

        <div className="auth-image-content" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '2rem', zIndex: 10 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <h1 style={{ marginBottom: '0.5rem' }}>Civic<span>Hub</span></h1>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: 'white' }}>Smart Civic Issue Management System</h2>
            <p style={{ fontSize: '1rem' }}>Report civic issues, monitor progress in real time, and help build a cleaner, safer, and smarter city.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
          >
            {[
              { icon: <MapPin size={20} />, text: 'GPS Issue Reporting' },
              { icon: <Building2 size={20} />, text: 'Department Workflow' },
              { icon: <BarChart3 size={20} />, text: 'Live Analytics' },
              { icon: <BellRing size={20} />, text: 'Real-time Notifications' }
            ].map((feature, idx) => (
              <motion.div key={idx} 
                whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(255,255,255,0.2)' }}
                style={{ 
                  padding: '1rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'default'
                }}
              >
                {feature.icon}
                <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}
          >
            <Counter end={1250} label="Total Issues" />
            <Counter end={890} label="Resolved Issues" />
            <Counter end={15} label="Departments" />
            <Counter end={5400} label="Registered Citizens" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}
          >
            <motion.button 
              onClick={() => navigate('/public-dashboard')}
              whileHover={{ 
                scale: 1.05, 
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                borderColor: 'rgba(56, 189, 248, 1)'
              }}
              style={{
                width: '260px',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                fontWeight: '600',
                fontSize: '1rem',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease, border-color 0.3s ease'
              }}
            >
              🌍 View Public Dashboard
            </motion.button>
          </motion.div>
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
