import { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  Activity, CheckCircle, Clock, AlertCircle, TrendingUp, Award, BarChart3
} from 'lucide-react';
import api from '../api';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b'];

const MyAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/complaints/my/stats');
        setStats(res.data.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading your analytics...</div>;
  }

  // Format Data for Charts
  const categoryData = Object.keys(stats?.categoryCounts || {}).map(key => ({
    name: key,
    value: stats.categoryCounts[key]
  })).sort((a, b) => b.value - a.value);

  const monthlyData = Object.keys(stats?.monthlyCounts || {}).sort().map(key => ({
    month: key,
    complaints: stats.monthlyCounts[key]
  }));

  const statusData = [
    { name: 'Pending', value: stats?.pending || 0, color: '#f59e0b' },
    { name: 'In Progress', value: stats?.inProgress || 0, color: '#0ea5e9' },
    { name: 'Completed', value: stats?.completed || 0, color: '#10b981' }
  ].filter(s => s.value > 0);

  const contributionScore = ((stats?.completed || 0) * 10) + ((stats?.pending || 0) * 2) + ((stats?.inProgress || 0) * 5);

  const StatCard = ({ title, value, icon: Icon, color, bg }) => (
    <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>{title}</h3>
        <div style={{ padding: '0.5rem', borderRadius: '8px', background: bg }}>
          <Icon color={color} size={20} />
        </div>
      </div>
      <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{value}</p>
    </div>
  );

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <BarChart3 size={28} className="text-primary" />
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Personal Analytics</h2>
          <p style={{ color: 'var(--text-muted)' }}>Visualize your contribution to improving the city.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <StatCard title="Total Complaints" value={stats?.total || 0} icon={Activity} color="#3b82f6" bg="rgba(59, 130, 246, 0.1)" />
        <StatCard title="Resolution Rate" value={`${stats?.resolutionRate || 0}%`} icon={TrendingUp} color="#10b981" bg="rgba(16, 185, 129, 0.1)" />
        <StatCard title="Avg Resolution Time" value={`${stats?.averageResolutionTimeHours || 0}h`} icon={Clock} color="#8b5cf6" bg="rgba(139, 92, 246, 0.1)" />
        <StatCard title="Contribution Score" value={contributionScore} icon={Award} color="#f59e0b" bg="rgba(245, 158, 11, 0.1)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Pending</h4>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats?.pending || 0}</span>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>In Progress</h4>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>{stats?.inProgress || 0}</span>
        </div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Completed</h4>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats?.completed || 0}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Monthly Trend Chart */}
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Monthly Complaints</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <Line type="monotone" dataKey="complaints" stroke="var(--primary)" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Category Distribution</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" width={100} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Status Distribution</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MyAnalytics;
