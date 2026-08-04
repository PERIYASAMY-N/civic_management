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
  X,
  LayoutDashboard,
  ClipboardList,
  Download,
  User,
  Search
} from 'lucide-react';

import { useNotification } from '../context/NotificationContext';
import { hasRole } from '../utils/userAccess';

const Sidebar = ({ user, onLogout, isOpen = false, onClose = () => {} }) => {
  const { unreadCount } = useNotification();
  const location = useLocation();
  const role = user.role;

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/public/user/dashboard', roles: ['public'] },
    { name: 'Report Issue', icon: FileText, path: '/public/user/report', roles: ['public'] },
    { name: 'My Complaints', icon: ClipboardList, path: '/public/user/complaints', roles: ['public'] },
    { name: 'Track Complaint', icon: MapPin, path: '/public/user/track', roles: ['public'] },
    
    { name: 'All Issues', icon: MapPin, path: '/issues', roles: ['admin', 'head', 'worker', 'volunteer'] },
    { name: 'Assigned Tasks', icon: Users, path: '/department/dashboard', roles: ['head'] },
    { name: 'Task Page', icon: CheckCircle2, path: '/worker/dashboard', roles: ['worker'] },
    { name: 'Volunteer Center', icon: Users, path: '/volunteer/dashboard', roles: ['volunteer'] },
    
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin', 'head'] },
    { name: 'My Analytics', icon: BarChart3, path: '/public/user/analytics', roles: ['public'] },
    
    { name: 'Approvals', icon: Users, path: '/admin/dashboard', roles: ['admin'] },
    
    { name: 'Notifications', icon: Bell, path: '/notifications', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    
    { name: 'Downloads', icon: Download, path: '/public/user/downloads', roles: ['public'] },
    
    { name: 'Public Dashboard', icon: Globe2, path: '/public-dashboard', roles: ['public', 'admin', 'head', 'worker', 'volunteer'] },
    
    { name: 'Profile', icon: User, path: '/settings#profile', roles: ['public'] },
    { name: 'Settings', icon: Settings, path: '/settings#security', roles: ['public'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['admin', 'head', 'worker', 'volunteer'] }
  ];

  const isActive = (itemPath) => {
    if (itemPath.includes('#')) {
      const currentHash = location.hash || '#profile';
      return location.pathname + currentHash === itemPath;
    }
    return location.pathname === itemPath;
  };

  return (
    <aside className={`sidebar glass ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h1>Civic<span>Hub</span></h1>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation">
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.filter((item) => hasRole(role, item.roles)).map((item, idx) => (
          <Link
            key={item.path + idx}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
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
