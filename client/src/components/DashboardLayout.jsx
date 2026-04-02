import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import DashboardHome from '../pages/DashboardHome';
import AllIssues from '../pages/AllIssues';
import ReportIssue from '../pages/ReportIssue';
import Analytics from '../pages/Analytics';
import WorkerTasks from '../pages/WorkerTasks';
import DeptHeadDashboard from '../pages/DeptHeadDashboard';
import VolunteerDashboard from '../pages/VolunteerDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import Settings from '../pages/Settings';
import Notifications from '../pages/Notifications';
import ComplaintDetails from '../pages/ComplaintDetails';
import './Dashboard.css';

const DashboardLayout = ({ user, setUser }) => {
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="dashboard-content">
        <header className="glass">
          <div className="header-left">
            <h2>Welcome, {user.name}</h2>
            <span className="role-badge">{user.role}</span>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="btn" onClick={toggleDarkMode} style={{ padding: '0.5rem' }}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="user-avatar">{user.name[0]}</div>
          </div>
        </header>
        <div className="content-area">
          <Routes>
            <Route path="/" element={<DashboardHome user={user} />} />
            <Route path="/all-issues" element={<AllIssues />} />
            <Route path="/report" element={<ReportIssue user={user} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/tasks" element={<WorkerTasks />} />
            <Route path="/head" element={<DeptHeadDashboard user={user} />} />
            <Route path="/volunteer" element={<VolunteerDashboard user={user} />} />
            <Route path="/approvals" element={<AdminDashboard />} />
            <Route path="/settings" element={<Settings user={user} />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/complaint/:id" element={<ComplaintDetails />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
