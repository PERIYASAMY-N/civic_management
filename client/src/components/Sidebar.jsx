import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  FileText,
  Globe2,
  LogOut,
  MapPin,
  Settings,
  Users,
  X
} from 'lucide-react';

import { useNotification } from '../context/NotificationContext';
import { hasRole } from '../utils/userAccess';

const Sidebar = ({ user, onLogout, isOpen = false, onClose = () => {} }) => {
  const { unreadCount } = useNotification();
  const location = useLocation();
  const role = user.role;

  const menuItems = [
    { name: 'Public Dashboard', icon: Globe2, path: '/public-dashboard', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'All Issues', icon: MapPin, path: '/issues', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'Report Issue', icon: FileText, path: '/report', roles: ['public'] },
    { name: 'Assigned Tasks', icon: Users, path: '/assigned-tasks', roles: ['head'] },
    { name: 'Task Page', icon: CheckCircle2, path: '/tasks', roles: ['worker'] },
    { name: 'Volunteer Center', icon: Users, path: '/volunteer', roles: ['volunteer'] },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin', 'head'] },
    { name: 'Approvals', icon: Users, path: '/approvals', roles: ['admin'] },
    { name: 'Notifications', icon: Bell, path: '/notifications', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] }
  ];

  return (
    <aside className={`sidebar glass ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h1>Civic<span>Hub</span></h1>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation">
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.filter((item) => hasRole(role, item.roles)).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={onClose}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
            {item.name === 'Notifications' && unreadCount > 0 ? (
              <span className="badge-count">{unreadCount}</span>
            ) : null}
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
