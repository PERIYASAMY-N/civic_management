import { AlertCircle, Clock, CheckCircle, Users } from 'lucide-react';

const DashboardHome = () => {
  const stats = [
    { label: 'Pending Issues', value: '12', icon: AlertCircle, color: 'var(--danger)' },
    { label: 'In Progress', value: '5', icon: Clock, color: 'var(--warning)' },
    { label: 'Completed', value: '48', icon: CheckCircle, color: 'var(--success)' },
    { label: 'Volunteers', value: '120', icon: Users, color: 'var(--primary)' },
  ];

  return (
    <div className="fade-in">
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card glass">
            <div className="stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>
              <stat.icon />
            </div>
            <div className="stat-info">
              <h4>{stat.label}</h4>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="recent-activity glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
        <h3>Recent Productivity</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Activity charts and heatmaps will appear here.</p>
        <div style={{ height: '200px', background: 'var(--bg-main)', marginTop: '2rem', borderRadius: 'var(--radius)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Chart Placeholder
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
