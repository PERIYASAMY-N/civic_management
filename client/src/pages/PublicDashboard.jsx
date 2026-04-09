import { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Trophy,
  Users,
  Wrench
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../api';

const PERFORMANCE_COLORS = {
  high: '#16a34a',
  medium: '#f59e0b',
  low: '#ef4444'
};

const getPerformanceBand = (value) => {
  if (value >= 80) return 'high';
  if (value >= 60) return 'medium';
  return 'low';
};

const getPerformanceColor = (value) => PERFORMANCE_COLORS[getPerformanceBand(value)];

const PublicDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [topWorkers, setTopWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const [overviewRes, departmentsRes, usersRes, workersRes] = await Promise.all([
          api.get('/public/overview'),
          api.get('/public/department-performance'),
          api.get('/public/top-users'),
          api.get('/public/top-workers')
        ]);

        setOverview(overviewRes.data);
        setDepartments(departmentsRes.data);
        setTopUsers(usersRes.data);
        setTopWorkers(workersRes.data);
      } catch (err) {
        console.error('Failed to load public dashboard', err);
        setError('Unable to load public dashboard insights right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const topDepartment = departments[0] || null;
  const leadWorker = topWorkers[0] || null;
  const chartData = departments.slice(0, 8);

  if (loading) {
    return (
      <div className="public-dashboard-shell">
        <div className="public-dashboard-loading">
          <LoaderCircle size={26} className="loading-spin" />
          <span>Loading transparency metrics...</span>
        </div>
        <DashboardStyles />
      </div>
    );
  }

  return (
    <div className="public-dashboard-shell">
      <section className="public-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Public Dashboard</span>
          <h1>Transparent civic performance, visible to everyone.</h1>
          <p>
            Track issue resolution, compare department results, and spotlight the people
            helping the city move faster.
          </p>
        </div>
        <div className="hero-badges">
          <div className="hero-badge">
            <Trophy size={18} />
            <div>
              <strong>Top Department</strong>
              <span>{topDepartment ? topDepartment.department : 'No departments yet'}</span>
            </div>
          </div>
          <div className="hero-badge">
            <Award size={18} />
            <div>
              <strong>Top Worker</strong>
              <span>{leadWorker ? leadWorker.name : 'No completed work yet'}</span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="public-error-card">
          <ShieldCheck size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <section className="overview-grid">
            <MetricCard
              icon={Activity}
              label="Total Issues Reported"
              value={overview?.totalIssues ?? 0}
              accent="#0f766e"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Total Issues Resolved"
              value={overview?.totalResolved ?? 0}
              accent="#16a34a"
            />
            <MetricCard
              icon={BarChart3}
              label="Overall Performance"
              value={`${overview?.performance ?? 0}%`}
              accent={getPerformanceColor(overview?.performance ?? 0)}
            />
          </section>

          <section className="public-section two-column">
            <div className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Rankings</span>
                  <h2>Department Performance</h2>
                </div>
                {topDepartment ? (
                  <span className="spotlight-chip">
                    <Trophy size={14} />
                    Top Performing Department
                  </span>
                ) : null}
              </div>

              <div className="rank-list">
                {departments.length ? (
                  departments.map((department, index) => (
                    <div
                      key={department.department}
                      className={`rank-card ${index === 0 ? 'rank-card-top' : ''}`}
                    >
                      <div className="rank-order">{index + 1}</div>
                      <div className="rank-content">
                        <div className="rank-title-row">
                          <div>
                            <strong>{department.department}</strong>
                            <span>{department.completed} completed of {department.totalIssues} issues</span>
                          </div>
                          <span
                            className="performance-pill"
                            style={{ color: getPerformanceColor(department.completionRate) }}
                          >
                            {department.completionRate}%
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${department.completionRate}%`,
                              background: getPerformanceColor(department.completionRate)
                            }}
                          />
                        </div>
                        <div className="rank-stats">
                          <span>{department.totalWorkers} workers</span>
                          <span>{department.pending} pending</span>
                          <span>{department.inProgress} in progress</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="No departments available"
                    description="Department metrics will appear here once departments are configured."
                  />
                )}
              </div>
            </div>

            <div className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Chart</span>
                  <h2>Completion Rate by Department</h2>
                </div>
              </div>

              {chartData.length ? (
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 16, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d6dee8" />
                      <XAxis
                        dataKey="department"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#52606d', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        tick={{ fill: '#52606d', fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(20, 83, 45, 0.06)' }}
                        formatter={(value) => [`${value}%`, 'Completion Rate']}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #d7e4df',
                          background: '#ffffff'
                        }}
                      />
                      <Bar dataKey="completionRate" radius={[10, 10, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.department}
                            fill={getPerformanceColor(entry.completionRate)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No chart data yet"
                  description="Completion trends will render once departments start receiving issues."
                />
              )}
            </div>
          </section>

          <section className="public-section two-column">
            <div className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Community</span>
                  <h2>Top Contributors</h2>
                </div>
              </div>

              <div className="leaderboard-list">
                {topUsers.length ? (
                  topUsers.map((user, index) => (
                    <div key={user.id || user.name} className="leaderboard-row">
                      <div className="leaderboard-identity">
                        <span className="leaderboard-rank">#{index + 1}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <span>Public reporter</span>
                        </div>
                      </div>
                      <div className="leaderboard-metric">
                        <strong>{user.totalIssuesReported}</strong>
                        <span>issues reported</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No public contributors yet"
                    description="Top contributors will appear once residents start reporting issues."
                  />
                )}
              </div>
            </div>

            <div className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Workforce</span>
                  <h2>Top Workers</h2>
                </div>
              </div>

              <div className="leaderboard-list">
                {topWorkers.length ? (
                  topWorkers.map((worker, index) => (
                    <div key={worker.id || worker.name} className="leaderboard-row">
                      <div className="leaderboard-identity">
                        <span className="leaderboard-rank">#{index + 1}</span>
                        <div>
                          <strong>{worker.name}</strong>
                          <span>{worker.department}</span>
                        </div>
                      </div>
                      <div className="leaderboard-metric">
                        <strong>{worker.tasksCompleted}</strong>
                        <span>tasks completed</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Wrench}
                    title="No worker completions yet"
                    description="Worker rankings will populate when assigned tasks are completed."
                  />
                )}
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Department Details</span>
                <h2>Operational Snapshot</h2>
              </div>
            </div>

            <div className="department-grid">
              {departments.length ? (
                departments.map((department) => (
                  <div key={department.department} className="department-card">
                    <div className="department-card-top">
                      <div>
                        <h3>{department.department}</h3>
                        <p>{department.totalWorkers} active workers</p>
                      </div>
                      <span
                        className="performance-pill soft"
                        style={{
                          color: getPerformanceColor(department.completionRate),
                          background: `${getPerformanceColor(department.completionRate)}14`
                        }}
                      >
                        {department.completionRate}% rate
                      </span>
                    </div>

                    <div className="department-stat-grid">
                      <DepartmentStat label="Total Issues" value={department.totalIssues} />
                      <DepartmentStat label="Completed" value={department.completed} tone="high" />
                      <DepartmentStat label="In Progress" value={department.inProgress} tone="medium" />
                      <DepartmentStat label="Pending" value={department.pending} tone="low" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="panel-card">
                  <EmptyState
                    icon={Building2}
                    title="No department details yet"
                    description="Department cards will appear after departments are created."
                  />
                </div>
              )}
            </div>
          </section>
        </>
      )}
      <DashboardStyles />
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, accent }) => (
  <div className="metric-card">
    <div className="metric-icon" style={{ background: `${accent}18`, color: accent }}>
      <Icon size={22} />
    </div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const DepartmentStat = ({ label, value, tone }) => (
  <div className={`department-stat ${tone || ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="empty-state">
    <Icon size={26} />
    <strong>{title}</strong>
    <span>{description}</span>
  </div>
);

const DashboardStyles = () => (
  <style>{`
    .public-dashboard-shell {
      min-height: 100vh;
      padding: 2rem;
      background:
        radial-gradient(circle at top left, rgba(20, 184, 166, 0.12), transparent 24rem),
        radial-gradient(circle at top right, rgba(22, 163, 74, 0.12), transparent 22rem),
        linear-gradient(180deg, #f4fbf8 0%, #edf5f1 100%);
      color: #163127;
    }

    .public-hero,
    .panel-card,
    .metric-card,
    .department-card,
    .public-error-card,
    .public-dashboard-loading {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #d7e4df;
      box-shadow: 0 18px 40px rgba(22, 49, 39, 0.08);
    }

    .public-hero {
      max-width: 1280px;
      margin: 0 auto 1.5rem;
      border-radius: 28px;
      padding: 2rem;
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
      gap: 1.5rem;
      align-items: center;
    }

    .hero-copy h1 {
      font-size: clamp(2.4rem, 6vw, 4.6rem);
      line-height: 0.98;
      letter-spacing: -0.05em;
      margin: 0.5rem 0 1rem;
      max-width: 12ch;
    }

    .hero-copy p {
      max-width: 56ch;
      color: #476156;
      font-size: 1.02rem;
    }

    .hero-kicker,
    .section-kicker {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #0f766e;
    }

    .hero-badges {
      display: grid;
      gap: 1rem;
    }

    .hero-badge {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(240, 253, 244, 0.96), rgba(236, 253, 245, 0.82));
      border: 1px solid #cce8d8;
      color: #14532d;
    }

    .hero-badge strong,
    .hero-badge span {
      display: block;
    }

    .hero-badge span {
      color: #476156;
      margin-top: 0.15rem;
    }

    .overview-grid,
    .public-section {
      max-width: 1280px;
      margin: 0 auto 1.5rem;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .metric-card {
      border-radius: 22px;
      padding: 1.25rem;
      display: grid;
      gap: 0.75rem;
    }

    .metric-card span {
      color: #527164;
      font-size: 0.95rem;
    }

    .metric-card strong {
      font-size: clamp(1.9rem, 4vw, 2.6rem);
      letter-spacing: -0.04em;
    }

    .metric-icon {
      width: 3rem;
      height: 3rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
    }

    .two-column {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 1.25rem;
    }

    .panel-card {
      border-radius: 24px;
      padding: 1.5rem;
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }

    .section-heading h2 {
      font-size: 1.5rem;
      margin-top: 0.35rem;
      color: #173329;
    }

    .spotlight-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 0.85rem;
      border-radius: 999px;
      background: #effcf5;
      color: #166534;
      font-size: 0.84rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .rank-list,
    .leaderboard-list {
      display: grid;
      gap: 0.85rem;
    }

    .rank-card,
    .leaderboard-row {
      border-radius: 18px;
      border: 1px solid #dbe7e1;
      background: #fbfffd;
    }

    .rank-card {
      display: grid;
      grid-template-columns: 3.2rem minmax(0, 1fr);
      gap: 0.9rem;
      padding: 1rem;
      align-items: start;
    }

    .rank-card-top {
      border-color: #8bca9f;
      background: linear-gradient(135deg, rgba(240, 253, 244, 0.96), rgba(255, 255, 255, 0.96));
    }

    .rank-order {
      width: 3rem;
      height: 3rem;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1.15rem;
      color: #14532d;
      background: #e8f7ee;
    }

    .rank-title-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .rank-title-row strong,
    .leaderboard-identity strong,
    .department-card h3 {
      display: block;
      color: #173329;
    }

    .rank-title-row span,
    .rank-stats span,
    .leaderboard-identity span,
    .leaderboard-metric span,
    .department-card p,
    .empty-state span {
      color: #587265;
      font-size: 0.92rem;
    }

    .performance-pill {
      font-weight: 800;
      font-size: 1rem;
      white-space: nowrap;
    }

    .performance-pill.soft {
      font-size: 0.9rem;
      padding: 0.5rem 0.7rem;
      border-radius: 999px;
    }

    .progress-track {
      width: 100%;
      height: 0.72rem;
      border-radius: 999px;
      background: #e7efea;
      overflow: hidden;
      margin: 0.85rem 0 0.8rem;
    }

    .progress-fill {
      height: 100%;
      border-radius: inherit;
    }

    .rank-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }

    .chart-frame {
      height: 360px;
    }

    .leaderboard-row {
      padding: 1rem 1.05rem;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }

    .leaderboard-identity,
    .leaderboard-metric {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .leaderboard-metric {
      flex-direction: column;
      align-items: flex-end;
      gap: 0.15rem;
    }

    .leaderboard-metric strong {
      font-size: 1.45rem;
      line-height: 1;
      color: #173329;
    }

    .leaderboard-rank {
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 50%;
      background: #e8f4ef;
      color: #0f766e;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .department-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }

    .department-card {
      border-radius: 22px;
      padding: 1.25rem;
    }

    .department-card-top {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .department-stat-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .department-stat {
      padding: 0.85rem;
      border-radius: 16px;
      background: #f7fbf9;
      border: 1px solid #dde9e3;
    }

    .department-stat.high strong {
      color: #15803d;
    }

    .department-stat.medium strong {
      color: #d97706;
    }

    .department-stat.low strong {
      color: #dc2626;
    }

    .department-stat span {
      display: block;
      color: #587265;
      font-size: 0.86rem;
      margin-bottom: 0.25rem;
    }

    .department-stat strong {
      font-size: 1.35rem;
      color: #173329;
    }

    .empty-state {
      min-height: 12rem;
      display: grid;
      place-items: center;
      text-align: center;
      gap: 0.45rem;
      color: #0f766e;
      padding: 1rem;
    }

    .public-error-card,
    .public-dashboard-loading {
      max-width: 1280px;
      margin: 0 auto;
      border-radius: 24px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      color: #173329;
    }

    .loading-spin {
      animation: public-dashboard-spin 1s linear infinite;
    }

    @keyframes public-dashboard-spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1024px) {
      .public-dashboard-shell {
        padding: 1.1rem;
      }

      .public-hero,
      .overview-grid,
      .two-column {
        grid-template-columns: 1fr;
      }

      .hero-copy h1 {
        max-width: none;
      }

      .chart-frame {
        height: 300px;
      }
    }

    @media (max-width: 720px) {
      .public-hero,
      .panel-card,
      .metric-card,
      .department-card {
        border-radius: 20px;
      }

      .leaderboard-row,
      .department-card-top,
      .rank-title-row,
      .section-heading {
        flex-direction: column;
        align-items: flex-start;
      }

      .leaderboard-metric {
        align-items: flex-start;
      }

      .department-stat-grid {
        grid-template-columns: 1fr;
      }

      .rank-card {
        grid-template-columns: 1fr;
      }
    }
  `}</style>
);

export default PublicDashboard;
