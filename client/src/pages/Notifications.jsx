import { useNotification } from '../context/NotificationContext';
import { Bell, Check, Clock, CheckCircle2, Briefcase, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const getNotificationIcon = (notification) => {
  const normalizedType = String(notification.type || '').toUpperCase();
  if (normalizedType === 'SUCCESS') {
    return <CheckCircle2 size={20} color="#16a34a" />;
  }
  if (normalizedType === 'ASSIGNMENT') {
    return <Briefcase size={20} color="#0ea5e9" />;
  }
  return <Activity size={20} color="var(--primary)" />;
};

const getNotificationTitle = (notification) => (
  notification.title
  || (String(notification.type || '').toUpperCase() === 'SUCCESS' ? 'Issue resolved' : 'Issue update')
);

const Notifications = () => {
  const { persistentNotifications, unreadCount, markAsRead } = useNotification();

  return (
    <div className="fade-in">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <span className="glass notifications-count">
          {unreadCount} New
        </span>
      </div>

      <div className="notifications-list flex flex-col gap-4">
        {persistentNotifications.length === 0 ? (
          <div className="glass notifications-empty">
            <Bell size={48} style={{ margin: '0 auto', color: 'var(--text-muted)', opacity: 0.5 }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>You're all caught up!</p>
          </div>
        ) : (
          persistentNotifications.map((notification) => (
            <div key={notification._id} className="notification-card glass">
              <div className="notification-main">
                <div className="icon-circle">
                  {getNotificationIcon(notification)}
                </div>
                <div>
                  <strong>{getNotificationTitle(notification)}</strong>
                  <p>{notification.message}</p>
                  <div className="notification-meta">
                    <span><Clock size={14} /> {new Date(notification.createdAt).toLocaleString()}</span>
                    {notification.complaint_id ? (
                      <Link to={`/issues/${notification.complaint_id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        View Related Issue
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => markAsRead(notification._id)}
                title="Mark as read"
                style={{ padding: '0.5rem' }}
              >
                <Check size={20} color="var(--success)" />
              </button>
            </div>
          ))
        )}
      </div>

      <style>{`
        .notifications-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          gap: 1rem;
        }

        .notifications-count {
          padding: 0.4rem 1rem;
          border-radius: 20px;
          font-size: 0.8rem;
        }

        .notifications-empty {
          padding: 3rem;
          text-align: center;
        }

        .notification-card {
          border-left: 4px solid var(--primary);
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .notification-main {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .icon-circle {
          padding: 0.65rem;
          border-radius: 50%;
          background: rgba(79, 70, 229, 0.1);
        }

        .notification-main strong {
          display: block;
          margin-bottom: 0.3rem;
        }

        .notification-main p {
          font-weight: 500;
        }

        .notification-meta {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          flex-wrap: wrap;
        }

        .notification-meta span {
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }

        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-4 { gap: 1rem; }

        @media (max-width: 720px) {
          .notifications-header,
          .notification-card {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Notifications;
