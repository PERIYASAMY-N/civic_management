import { useNotification } from '../context/NotificationContext';
import { Bell, Check, Trash2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const Notifications = () => {
  const { persistentNotifications, markAsRead } = useNotification();

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Notifications</h2>
        <span className="glass" style={{ padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem' }}>
          {persistentNotifications.length} New
        </span>
      </div>

      <div className="notifications-list flex flex-col gap-4">
        {persistentNotifications.length === 0 ? (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <Bell size={48} style={{ margin: '0 auto', color: 'var(--text-muted)', opacity: 0.5 }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>You're all caught up!</p>
          </div>
        ) : (
          persistentNotifications.map(notif => (
            <div key={notif._id} className="notification-card glass" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div className={`icon-circle ${notif.type}`} style={{ padding: '0.5rem', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)' }}>
                  <Bell size={20} color="var(--primary)" />
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>{notif.message}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={14} /> {new Date(notif.createdAt).toLocaleString()}</span>
                    {notif.complaint_id && (
                      <Link to={`/dashboard/complaint/${notif.complaint_id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>View Related Issue</Link>
                    )}
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={() => markAsRead(notif._id)}
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
        .notification-card { border-left: 4px solid var(--primary); }
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-4 { gap: 1rem; }
      `}</style>
    </div>
  );
};

export default Notifications;
