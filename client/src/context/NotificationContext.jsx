import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { X, Bell } from 'lucide-react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [toastNotifications, setToastNotifications] = useState([]);
  const [persistentNotifications, setPersistentNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await api.get('/notifications');
        setPersistentNotifications(res.data);
      } catch {
        console.error('Failed to fetch notifications');
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToastNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setPersistentNotifications(prev => prev.filter(n => n._id !== id));
    } catch {
      console.error('Error marking as read');
    }
  };

  return (
    <NotificationContext.Provider value={{ addToast, persistentNotifications, markAsRead }}>
      {children}
      <div className="notification-container">
        {toastNotifications.map(n => (
          <div key={n.id} className={`notification glass ${n.type} fade-in`}>
            <Bell size={18} />
            <span>{n.message}</span>
            <button onClick={() => setToastNotifications(prev => prev.filter(notif => notif.id !== n.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        .notification-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; display: flex; flex-direction: column; gap: 1rem; }
        .notification { padding: 1rem 1.5rem; border-radius: 12px; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow); min-width: 300px; background: var(--bg-card); border: 1px solid var(--border); }
        .notification.info { border-left: 4px solid var(--primary); }
        .notification.success { border-left: 4px solid var(--success); }
        .notification.error { border-left: 4px solid var(--danger); }
        .notification span { flex: 1; font-size: 0.875rem; font-weight: 500; }
        .notification button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
      `}</style>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => useContext(NotificationContext);
