import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import { X, Bell } from 'lucide-react';
import socket from '../realtime/socket';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [toastNotifications, setToastNotifications] = useState([]);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const previousIdsRef = useRef(new Set());
  const readIdsRef = useRef(new Set());
  const hasFetchedOnceRef = useRef(false);
  const tokenRef = useRef(localStorage.getItem('token') || '');

  const addToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToastNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToastNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, 5000);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPersistentNotifications([]);
      previousIdsRef.current = new Set();
      readIdsRef.current = new Set();
      hasFetchedOnceRef.current = false;
      if (tokenRef.current) {
        tokenRef.current = '';
        socket.reconnect();
      }
      return;
    }

    if (tokenRef.current !== token) {
      tokenRef.current = token;
      previousIdsRef.current = new Set();
      readIdsRef.current = new Set();
      hasFetchedOnceRef.current = false;
      socket.reconnect();
    }

    try {
      const res = await api.get('/notifications');
      const notifications = (Array.isArray(res.data) ? res.data : [])
        .filter((notification) => !notification.read && !readIdsRef.current.has(notification._id));
      const incomingIds = new Set(notifications.map((notification) => notification._id));

      if (hasFetchedOnceRef.current) {
        notifications
          .filter((notification) => !previousIdsRef.current.has(notification._id))
          .slice(0, 3)
          .forEach((notification) => {
            addToast(notification.message, String(notification.type || 'info').toLowerCase());
          });
      }

      previousIdsRef.current = incomingIds;
      hasFetchedOnceRef.current = true;
      setPersistentNotifications(notifications);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  }, [addToast]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    const interval = setInterval(() => {
      void refreshNotifications();
    }, 10000);

    return () => {
      window.clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const handleSocketNotification = (incoming) => {
      if (!incoming?._id || incoming.read || readIdsRef.current.has(incoming._id)) {
        return;
      }

      setPersistentNotifications((notifications) => {
        const exists = notifications.some(
          (notification) => notification._id === incoming._id
        );

        if (exists) {
          return notifications;
        }

        previousIdsRef.current.add(incoming._id);
        addToast(incoming.message, String(incoming.type || 'info').toLowerCase());
        return [incoming, ...notifications];
      });
    };

    socket.on('notificationCreated', handleSocketNotification);
    return () => socket.off('notificationCreated', handleSocketNotification);
  }, [addToast]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      readIdsRef.current.add(id);
      setPersistentNotifications((prev) => prev.filter((notification) => notification._id !== id));
      previousIdsRef.current.delete(id);
    } catch (error) {
      console.error('Error marking notification as read', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        addToast,
        persistentNotifications,
        unreadCount: persistentNotifications.filter((notification) => !notification.read).length,
        markAsRead,
        refreshNotifications
      }}
    >
      {children}
      <div className="notification-container">
        {toastNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification glass ${String(notification.type || 'info').toLowerCase()} fade-in`}
          >
            <Bell size={18} />
            <span>{notification.message}</span>
            <button onClick={() => setToastNotifications((prev) => prev.filter((item) => item.id !== notification.id))}>
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
        .notification.assignment { border-left: 4px solid #0ea5e9; }
        .notification.error { border-left: 4px solid var(--danger); }
        .notification span { flex: 1; font-size: 0.875rem; font-weight: 500; }
        .notification button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
      `}</style>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => useContext(NotificationContext);
