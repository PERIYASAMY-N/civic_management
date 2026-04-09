import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Moon, Search, Settings, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import './Dashboard.css';
import { getRoleLabel } from '../utils/userAccess';
import { resolveApiAssetUrl } from '../api';
import { useNotification } from '../context/NotificationContext';

const MainLayout = ({ user, setUser, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotification();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark((current) => !current);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const profileImageSrc = user?.profile_image ? resolveApiAssetUrl(user.profile_image) : '';

  return (
    <div className="dashboard-container">
      <Sidebar user={user} onLogout={handleLogout} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen ? <button type="button" className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu" /> : null}
      <main className="dashboard-content">
        <header className="glass global-header navbar">
          <div className="header-left">
            <button
              type="button"
              className="nav-icon-button nav-menu-toggle"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="search-wrapper">
              <Search size={18} />
              <input type="text" placeholder="Search complaints..." />
            </div>
          </div>
          <div className="header-right">
            <button type="button" className="nav-icon-button notification-center" onClick={() => navigate('/notifications')}>
              <Bell size={20} />
              {unreadCount > 0 ? <span className="badge-count">{unreadCount}</span> : null}
            </button>
            <button type="button" className="user-profile user-profile-button" onClick={() => navigate('/settings')}>
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <span className="user-role">{getRoleLabel(user?.role)}</span>
              </div>
              <div className="user-avatar">
                {profileImageSrc ? (
                  <img src={profileImageSrc} alt={`${user?.name || 'User'} profile`} className="user-avatar-image" />
                ) : (
                  <span>{user?.name?.[0] || 'U'}</span>
                )}
              </div>
            </button>
            <button type="button" className="nav-icon-button theme-toggle" onClick={toggleDarkMode} aria-label="Toggle theme">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button type="button" className="nav-icon-button settings-shortcut" onClick={() => navigate('/settings')} aria-label="Open settings">
              <Settings size={20} />
            </button>
          </div>
        </header>
        <div className="content-area">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
