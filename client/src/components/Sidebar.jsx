import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MapPin, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Bell,
  BarChart3,
  CheckCircle2
} from 'lucide-react';

import { useNotification } from '../context/NotificationContext';

const Sidebar = ({ user, onLogout }) => {
  const { persistentNotifications } = useNotification();
  const location = useLocation();
  const role = user.role;

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'All Issues', icon: MapPin, path: '/dashboard/all-issues', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'Report Issue', icon: FileText, path: '/dashboard/report', roles: ['public'] },
    { name: 'Dept Management', icon: Users, path: '/dashboard/head', roles: ['head'] },
    { name: 'Assigned Tasks', icon: CheckCircle2, path: '/dashboard/tasks', roles: ['worker'] },
    { name: 'Volunteer Center', icon: Users, path: '/dashboard/volunteer', roles: ['volunteer'] },
    { name: 'Analytics', icon: BarChart3, path: '/dashboard/analytics', roles: ['admin', 'head'] },
    { name: 'Approvals', icon: Users, path: '/dashboard/approvals', roles: ['admin'] },
    { name: 'Notifications', icon: Bell, path: '/dashboard/notifications', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'Settings', icon: Settings, path: '/dashboard/settings', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
  ];

  return (
    <aside className="sidebar glass">
      <div className="sidebar-logo">
        <h1>Civic<span>Hub</span></h1>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
            {item.name === 'Notifications' && persistentNotifications.length > 0 && (
              <span className="badge-count">{persistentNotifications.length}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={onLogout} className="nav-item logout">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
      <style>{`
        .badge-count { background: var(--danger); color: white; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 10px; margin-left: auto; }
      `}</style>
    </aside>
  );
};

export default Sidebar;
