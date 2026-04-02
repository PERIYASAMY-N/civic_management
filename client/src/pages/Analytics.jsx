import { useState, useEffect } from 'react';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

const Analytics = () => {
  const [data, setData] = useState({ statusStats: [], departmentStats: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/complaints/stats');
        setData(res.data);
      } catch (err) {
        console.error('Error fetching stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#f43f5e'];

  if (loading) return <div style={{ padding: '2rem' }}>Loading analytics...</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {data.statusStats.map((stat, i) => (
          <div key={i} className="glass" style={{ padding: '1.5rem' }}>
            <h4 style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{stat._id} Issues</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 700 }}>{stat.count}</span>
              <Activity size={20} color={COLORS[i % COLORS.length]} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem', height: '400px' }}>
          <h3>Issues by Department</h3>
          <div style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departmentStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip contentStyle={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass" style={{ padding: '2rem', height: '400px' }}>
          <h3>Resolution Status</h3>
          <div style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="_id"
                >
                  {data.statusStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
