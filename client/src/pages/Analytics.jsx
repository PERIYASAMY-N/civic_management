import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { TrendingUp, Activity, CheckCircle, Timer, CalendarDays, Trophy, AlertTriangle, Building2, Users } from 'lucide-react';
import socket from '../realtime/socket';
import { hasRole } from '../utils/userAccess';

const COLORS = {
  pending: '#f97316',   // Orange
  in_progress: '#a855f7', // Purple
  completed: '#10b981',   // Green
  closed: '#64748b',      // Gray
  total: '#3b82f6',       // Blue
  accent: '#4f46e5'       // Indigo
};

const formatResolutionTime = (hours) => {
  const numericHours = Number(hours || 0);
  if (!numericHours) return '0h';
  if (numericHours < 24) return `${numericHours}h`;
  return `${Number((numericHours / 24).toFixed(1))}d`;
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="summary-card glass" style={{ borderTop: `4px solid ${color}` }}>
    <Icon size={22} color={color} />
    <label>{label}</label>
    <strong>{value}</strong>
  </div>
);

const EmptyState = ({ message = "No analytics data available", sub = "There are no issues matching this criteria yet." }) => (
  <div className="empty-state-card glass">
    <Activity size={48} color={COLORS.closed} />
    <h2>{message}</h2>
    <p>{sub}</p>
  </div>
);

const DepartmentDashboard = ({ data }) => {
  const isEmpty = data.totalIssues === 0;

  if (isEmpty) return <EmptyState />;

  const pieData = [
    { name: 'Pending', value: data.pending, color: COLORS.pending },
    { name: 'In Progress', value: data.inProgress, color: COLORS.in_progress },
    { name: 'Completed', value: data.completed, color: COLORS.completed },
    { name: 'Closed', value: data.closed, color: COLORS.closed }
  ].filter(d => d.value > 0);

  return (
    <>
      <div className="summary-grid">
        <StatCard icon={Activity} label="Total Issues" value={data.totalIssues} color={COLORS.total} />
        <StatCard icon={AlertTriangle} label="Pending" value={data.pending} color={COLORS.pending} />
        <StatCard icon={Timer} label="In Progress" value={data.inProgress} color={COLORS.in_progress} />
        <StatCard icon={CheckCircle} label="Completed" value={data.completed} color={COLORS.completed} />
        <StatCard icon={CheckCircle} label="Closed" value={data.closed} color={COLORS.closed} />
        
        <StatCard icon={Trophy} label="Completion Rate" value={`${data.completionRate}%`} color={COLORS.accent} />
        <StatCard icon={Timer} label="Avg Resolution Time" value={formatResolutionTime(data.averageResolutionHours)} color={COLORS.accent} />
        
        <StatCard icon={CalendarDays} label="Assigned This Month" value={data.issuesAssignedThisMonth} color={COLORS.total} />
        <StatCard icon={CalendarDays} label="Completed This Month" value={data.issuesCompletedThisMonth} color={COLORS.completed} />
      </div>

      <div className="charts-grid">
        <div className="chart-wrapper glass">
          <h3>Status Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" cy="50%" 
                  innerRadius={70} outerRadius={100} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-wrapper glass">
          <h3>Worker Performance Summary</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.workerPerformance} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Legend />
                <Bar dataKey="assigned" name="Tasks Assigned" fill={COLORS.total} radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Tasks Completed" fill={COLORS.completed} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-wrapper glass">
          <h3>Monthly Issue Trend (Last 12 Months)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyIssueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Line type="monotone" name="Issues" dataKey="count" stroke={COLORS.total} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-wrapper glass">
          <h3>Monthly Completion Trend (Last 12 Months)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyCompletionTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Line type="monotone" name="Completions" dataKey="count" stroke={COLORS.completed} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};

const AdminDashboard = ({ data }) => {
  const { globalStats } = data;
  const isEmpty = globalStats.totalIssues === 0;

  if (isEmpty) return <EmptyState />;

  const pieData = [
    { name: 'Pending', value: globalStats.pending, color: COLORS.pending },
    { name: 'In Progress', value: globalStats.inProgress, color: COLORS.in_progress },
    { name: 'Completed', value: globalStats.completed, color: COLORS.completed },
    { name: 'Closed', value: globalStats.closed, color: COLORS.closed }
  ].filter(d => d.value > 0);

  return (
    <>
      <div className="summary-grid admin">
        <StatCard icon={Activity} label="Total City Issues" value={globalStats.totalIssues} color={COLORS.total} />
        <StatCard icon={AlertTriangle} label="Total Pending" value={globalStats.pending} color={COLORS.pending} />
        <StatCard icon={Timer} label="Total In Progress" value={globalStats.inProgress} color={COLORS.in_progress} />
        <StatCard icon={CheckCircle} label="Total Completed" value={globalStats.completed} color={COLORS.completed} />
        <StatCard icon={CheckCircle} label="Total Closed" value={globalStats.closed} color={COLORS.closed} />
        <StatCard icon={Trophy} label="Overall Completion %" value={`${globalStats.completionRate}%`} color={COLORS.accent} />
      </div>

      <div className="spotlight-grid">
        <div className="spotlight-card glass">
          <Trophy size={20} color={COLORS.completed} />
          <label>Top Performing Department</label>
          <strong>{data.topPerformingDepartment ? data.topPerformingDepartment.department : 'No data'}</strong>
          <span>{data.topPerformingDepartment ? `${data.topPerformingDepartment.completionRate}% completion` : ''}</span>
        </div>
        <div className="spotlight-card glass">
          <AlertTriangle size={20} color={COLORS.pending} />
          <label>Lowest Performing Department</label>
          <strong>{data.lowestPerformingDepartment ? data.lowestPerformingDepartment.department : 'No data'}</strong>
          <span>{data.lowestPerformingDepartment ? `${data.lowestPerformingDepartment.completionRate}% completion` : ''}</span>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-wrapper glass">
          <h3>Global Status Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" cy="50%" 
                  innerRadius={70} outerRadius={100} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-wrapper glass">
          <h3>Department Completion Ranking</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departmentRankings} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="department" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip formatter={(value) => [`${value}%`, 'Completion']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Bar dataKey="completionRate" fill={COLORS.completed} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="charts-grid one-column">
        <div className="chart-wrapper glass">
          <h3>Monthly City-wide Trend</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyCityTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                <Line type="monotone" name="Issues Reported" dataKey="count" stroke={COLORS.total} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="table-wrapper glass">
        <h3>Department Performance</h3>
        <div className="department-table-scroll">
          <table className="department-summary-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total Issues</th>
                <th>Pending</th>
                <th>In Progress</th>
                <th>Completed</th>
                <th>Closed</th>
                <th>Completion %</th>
              </tr>
            </thead>
            <tbody>
              {data.departmentRankings.map((dept) => (
                <tr key={dept.department}>
                  <td>{dept.department}</td>
                  <td>{dept.totalIssues}</td>
                  <td><span style={{ color: COLORS.pending, fontWeight: 'bold' }}>{dept.pending}</span></td>
                  <td><span style={{ color: COLORS.in_progress, fontWeight: 'bold' }}>{dept.inProgress}</span></td>
                  <td><span style={{ color: COLORS.completed, fontWeight: 'bold' }}>{dept.completed}</span></td>
                  <td><span style={{ color: COLORS.closed, fontWeight: 'bold' }}>{dept.closed}</span></td>
                  <td><span style={{ color: COLORS.accent, fontWeight: 'bold' }}>{dept.completionRate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const Analytics = () => {
  const userStr = localStorage.getItem('user');
  let user = null;
  try { user = JSON.parse(userStr); } catch (e) {}

  const isAdmin = hasRole(user?.role, 'admin');
  const isHead = hasRole(user?.role, 'head');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetchAnalytics = useCallback(async () => {
    try {
      let res;
      if (isAdmin) {
        res = await api.get('/admin/global-analytics');
      } else if (isHead) {
        res = await api.get('/admin/department-analytics');
      }
      
      if (res && res.data && res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching analytics', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isHead]);

  useEffect(() => {
    if (isAdmin || isHead) {
      refetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [refetchAnalytics, isAdmin, isHead]);

  useEffect(() => {
    socket.on('taskUpdated', refetchAnalytics);
    return () => socket.off('taskUpdated', refetchAnalytics);
  }, [refetchAnalytics]);

  if (!isAdmin && !isHead) {
      return (
         <div className="fade-in analytics-container">
            <EmptyState message="Unauthorized" sub="You don't have access to this dashboard." />
         </div>
      );
  }

  if (loading) return <div style={{ padding: '2rem' }}>Gathering insights...</div>;

  return (
    <div className="fade-in analytics-container">
      <div className="analytics-header glass">
        <TrendingUp size={24} color="var(--primary)" />
        <h2>{isAdmin ? 'Admin Analytics Dashboard' : 'Department Analytics Dashboard'}</h2>
      </div>
      
      {(!data) ? (
        <EmptyState />
      ) : (
        isAdmin ? <AdminDashboard data={data} /> : <DepartmentDashboard data={data} />
      )}

      <DashboardStyles />
    </div>
  );
};

const DashboardStyles = () => (
  <style>{`
    .analytics-container { padding-bottom: 2rem; }
    .analytics-header { padding: 1.5rem 2rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; border-radius: var(--radius); }
    
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
    .summary-grid.admin { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    
    .summary-card { padding: 1.5rem; border-radius: var(--radius); display: grid; gap: 0.5rem; border: 1px solid var(--border); background: var(--bg-card); transition: transform 0.2s; }
    .summary-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .summary-card label { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 700; margin-top: 0.5rem; }
    .summary-card strong { color: var(--text-main); font-size: 2.2rem; line-height: 1; }
    
    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .charts-grid.one-column { grid-template-columns: 1fr; }
    .chart-wrapper { padding: 2rem; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); display: flex; flex-direction: column; }
    .chart-wrapper h3 { margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-main); }
    .chart-container { height: 320px; width: 100%; flex-grow: 1; }
    
    .spotlight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .spotlight-card { padding: 1.5rem; border-radius: var(--radius); display: grid; gap: 0.5rem; border: 1px solid var(--border); background: var(--bg-card); }
    .spotlight-card label { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 700; }
    .spotlight-card strong { font-size: 1.5rem; color: var(--text-main); }
    .spotlight-card span { color: var(--text-muted); font-weight: 600; font-size: 0.9rem; }
    
    .empty-state-card { padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-card); gap: 1rem; }
    .empty-state-card h2 { color: var(--text-main); margin: 0; }
    .empty-state-card p { color: var(--text-muted); margin: 0; }

    .table-wrapper { padding: 2rem; border-radius: var(--radius); margin-bottom: 2rem; background: var(--bg-card); border: 1px solid var(--border); }
    .table-wrapper h3 { margin-bottom: 1.5rem; font-size: 1.1rem; }
    .department-table-scroll { overflow-x: auto; }
    .department-summary-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 760px; }
    .department-summary-table th,
    .department-summary-table td { padding: 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    .department-summary-table th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 600; }
    .department-summary-table td { font-weight: 500; color: var(--text-main); }
    .department-summary-table tr:hover td { background-color: var(--bg-main); }

    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
    }
  `}</style>
);

export default Analytics;
