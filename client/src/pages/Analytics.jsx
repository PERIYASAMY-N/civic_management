import { useState, useEffect } from 'react';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity, Users, CheckCircle } from 'lucide-react';

const Analytics = () => {
  const [deptData, setDeptData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/department-stats');
        setDeptData(res.data);
      } catch (err) {
        console.error('Error fetching department stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const COLORS = {
    pending: '#dc2626',   // Red
    in_progress: '#f59e0b', // Yellow
    completed: '#10b981',   // Green
    accent: '#4f46e5'       // Indigo
  };

  if (loading) return <div style={{ padding: '2rem' }}>Gathering departmental insights...</div>;

  // Calculate Overall Status Distribution for Pie Chart
  const globalStats = deptData.reduce((acc, dept) => {
    acc.assigned += dept.assigned;
    acc.inProgress += dept.inProgress;
    acc.completed += dept.completed;
    acc.incomplete += dept.incomplete;
    return acc;
  }, { assigned: 0, inProgress: 0, completed: 0, incomplete: 0 });

  const pieData = [
    { name: 'Incomplete', value: globalStats.incomplete, color: COLORS.pending },
    { name: 'In Progress', value: globalStats.inProgress, color: COLORS.in_progress },
    { name: 'Completed', value: globalStats.completed, color: COLORS.completed },
  ];

  return (
    <div className="fade-in analytics-container">
      <div className="analytics-header glass">
        <TrendingUp size={24} color="var(--primary)" />
        <h2>Operational Analytics</h2>
      </div>

      {/* Department Grid */}
      <div className="dept-grid">
        {deptData.map((dept, index) => (
          <div key={index} className="dept-card glass">
            <div className="card-top">
              <h3>{dept.department}</h3>
              <div className="worker-count">
                <Users size={16} />
                <span>{dept.totalWorkers} Workers</span>
              </div>
            </div>
            
            <div className="main-stat">
              <label>Total Issues</label>
              <strong>{dept.totalIssues}</strong>
            </div>

            <div className="stat-row">
              <div className="mini-stat">
                <label>Assigned</label>
                <span style={{ color: COLORS.in_progress }}>{dept.assigned}</span>
              </div>
              <div className="mini-stat">
                <label>In Progress</label>
                <span style={{ color: COLORS.in_progress }}>{dept.inProgress}</span>
              </div>
            </div>

            <div className="stat-row">
              <div className="mini-stat">
                <label>Completed</label>
                <span style={{ color: COLORS.completed }}>{dept.completed}</span>
              </div>
              <div className="mini-stat">
                <label>Incomplete</label>
                <span style={{ color: COLORS.pending }}>{dept.incomplete}</span>
              </div>
            </div>

            <div className="proof-banner">
              <CheckCircle size={14} />
              <span>Resolved with Proof: {dept.proofSubmitted}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-wrapper glass">
          <h3>Completion Performance by Department</h3>
          <div style={{ height: '350px', width: '100%', marginTop: '1.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="department" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }} 
                />
                <Bar dataKey="completed" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-wrapper glass">
          <h3>Global Status Distribution</h3>
          <div style={{ height: '350px', width: '100%', marginTop: '1.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {pieData.map(item => (
              <div key={item.name} className="legend-item">
                <div className="dot" style={{ backgroundColor: item.color }}></div>
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .analytics-container { padding-bottom: 2rem; }
        .analytics-header { padding: 1.5rem 2rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; border-radius: var(--radius); }
        .dept-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .dept-card { padding: 1.5rem; border-radius: var(--radius); background: var(--bg-card); transition: transform 0.2s; border: 1px solid var(--border); }
        .dept-card:hover { transform: translateY(-5px); border-color: var(--primary); }
        
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .card-top h3 { margin: 0; color: var(--primary); font-size: 1.1rem; }
        .worker-count { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); padding: 0.25rem 0.6rem; background: var(--bg-main); border-radius: 6px; }
        
        .main-stat { margin-bottom: 1.5rem; }
        .main-stat label { display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 0.25rem; }
        .main-stat strong { font-size: 1.75rem; color: var(--text-main); }
        
        .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .mini-stat { background: var(--bg-main); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); }
        .mini-stat label { display: block; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 0.25rem; }
        .mini-stat span { font-weight: 700; font-size: 1rem; }
        
        .proof-banner { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.05); color: #10b981; border-radius: 8px; font-size: 0.85rem; font-weight: 600; }
        
        .charts-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; }
        .chart-wrapper { padding: 2rem; border-radius: var(--radius); height: 500px; display: flex; flex-direction: column; }
        
        .chart-legend { display: flex; justify-content: center; gap: 2rem; margin-top: 1rem; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted); }
        .legend-item .dot { width: 10px; height: 10px; border-radius: 50%; }
      `}</style>
    </div>
  );
};

export default Analytics;
