import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Moon, Sun, Search, Bell } from 'lucide-react';
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
import { getRoleLabel } from '../utils/userAccess';

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
        <header className="glass global-header">
          <div className="header-left">
            <div className="search-wrapper">
              <Search size={18} />
              <input type="text" placeholder="Search complaints..." />
            </div>
          </div>
          <div className="header-right">
            <div className="notification-center">
              <Bell size={20} />
              <span className="badge-count">3</span>
            </div>
            <div className="user-profile">
               <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-role">{getRoleLabel(user.role)}</span>
               </div>
               <div className="user-avatar">{user.name[0]}</div>
            </div>
            <button className="theme-toggle" onClick={toggleDarkMode}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <div className="content-area">
          <Routes>
            <Route path="/" element={<DashboardHome user={user} />} />
            <Route path="/all-issues" element={<AllIssues user={user} />} />
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
