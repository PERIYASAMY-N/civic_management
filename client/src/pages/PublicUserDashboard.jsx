import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, ClipboardList, MapPin, Globe2, Bell, Download, User, 
  Clock, CheckCircle, AlertCircle, ArrowRight, Activity
} from 'lucide-react';
import api from '../api';
import '../components/Dashboard.css';

const PublicUserDashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, complaintsRes] = await Promise.all([
          api.get('/complaints/my/stats'),
          api.get('/complaints/my')
        ]);
        
        setStats(statsRes.data.data);
        setRecentComplaints(complaintsRes.data.data.slice(0, 3)); // Get top 3 recent
      } catch (err) {
        console.error('Failed to fetch user dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  const actions = [
    { name: 'Report Issue', path: '/public/user/report', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    { name: 'My Complaints', path: '/public/user/complaints', icon: ClipboardList, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { name: 'Track Complaint', path: '/public/user/track', icon: MapPin, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { name: 'Notifications', path: '/notifications', icon: Bell, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    { name: 'Downloads', path: '/public/user/downloads', icon: Download, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    { name: 'Profile', path: '/settings#profile', icon: User, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    { name: 'Public Dashboard', path: '/public/dashboard', icon: Globe2, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' }
  ];

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome & Profile Summary */}
      <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome back, {user?.name}! 👋</h1>
          <p style={{ color: 'var(--text-muted)' }}>Here is an overview of your reported issues and recent activities.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ display: 'block', fontSize: '1.1rem' }}>{user?.email}</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Citizen Profile</span>
          </div>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Quick Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Complaints</h3>
            <ClipboardList color="#3b82f6" size={20} />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats?.total || 0}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending</h3>
            <AlertCircle color="#f59e0b" size={20} />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats?.pending || 0}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>In Progress</h3>
            <Activity color="#6366f1" size={20} />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats?.inProgress || 0}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed</h3>
            <CheckCircle color="#10b981" size={20} />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats?.completed || 0}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Quick Actions */}
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {actions.map((action) => (
              <Link 
                key={action.name} 
                to={action.path}
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                  gap: '0.75rem', padding: '1.25rem 1rem', borderRadius: '12px',
                  background: 'var(--bg-main)', border: '1px solid var(--border)', transition: 'all 0.2s',
                  textAlign: 'center', textDecoration: 'none'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ padding: '0.75rem', borderRadius: '50%', background: action.bg }}>
                  <action.icon size={24} color={action.color} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>{action.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Complaints */}
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Recent Complaints</h3>
            <Link to="/public/user/complaints" style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {recentComplaints.length > 0 ? recentComplaints.map(complaint => (
              <div key={complaint._id} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{complaint.title}</strong>
                  <span style={{ 
                    fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '99px', textTransform: 'uppercase', fontWeight: 700,
                    background: complaint.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: complaint.status === 'completed' ? '#10b981' : '#f59e0b'
                  }}>
                    {complaint.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {new Date(complaint.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{complaint.department_id?.name || 'Unassigned'}</span>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', margin: 'auto' }}>
                <ClipboardList size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                <p>You haven't reported any issues yet.</p>
                <Link to="/public/user/report" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex', textDecoration: 'none' }}>
                  Report an Issue
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PublicUserDashboard;
