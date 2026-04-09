import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import './Auth.css';
import { hasRole } from '../utils/userAccess';

const ApprovalPending = ({ user, setUser }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const getRoleMessage = () => {
    if (hasRole(user?.role, 'worker')) {
      return 'Your worker account is currently pending approval from your Department Head.';
    }

    if (hasRole(user?.role, 'volunteer')) {
      return 'Your volunteer application is being reviewed by the System Administrator.';
    }

    if (hasRole(user?.role, 'head')) {
      return 'Your Department Head account is pending administrative verification.';
    }

    return 'Your account is currently pending approval.';
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
        <Clock size={64} color="var(--warning)" style={{ marginBottom: '1.5rem', margin: '0 auto' }} />
        <h2 style={{ marginBottom: '1rem' }}>Approval Pending</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
          {getRoleMessage()}
        </p>
        <div className="glass" style={{ padding: '1rem', marginBottom: '2rem', fontSize: '0.9rem', border: '1px dashed var(--warning)' }}>
          <p>Please check back later. Once approved, you will have full access to your dashboard.</p>
        </div>
        <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
          <LogOut size={18} /> Logout & Exit
        </button>
      </div>
    </div>
  );
};

export default ApprovalPending;
