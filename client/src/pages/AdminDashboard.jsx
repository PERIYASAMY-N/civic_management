import { useState, useEffect } from 'react';
import api from '../api';
import { 
  Users, Building, CheckCircle, XCircle, Plus, Shield, 
  AlertCircle, Clock, TrendingUp, ArrowRight, Bell, 
  LayoutDashboard, UserPlus, BarChart3, PieChart as PieChartIcon, 
  ArrowUpRight, ArrowDownRight, MapPin
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { getRoleLabel, hasRole } from '../utils/userAccess';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [deptStats, setDeptStats] = useState([]);
  const [recentIssues, setRecentIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [unassignedIssues, setUnassignedIssues] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', department_id: '', head_id: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, deptRes, complaintsRes, notifRes, pendingRes, allDeptsRes] = await Promise.all([
        api.get('/admin/dashboard-stats'),
        api.get('/admin/department-stats'),
        api.get('/complaints'),
        api.get('/notifications'),
        api.get('/auth/pending-staff'),
        api.get('/admin/departments')
      ]);

      setDashboardStats(statsRes.data);
      setDeptStats(deptRes.data);
      setRecentIssues(complaintsRes.data.slice(0, 5));
      setNotifications(notifRes.data.slice(0, 5));
      setPendingUsers(pendingRes.data);
      setUnassignedIssues(complaintsRes.data.filter(i => !i.department_id));
      setDepartments(allDeptsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUserAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      await fetchData();
    } catch {
      alert('Action failed');
    }
  };

  const handleAssignDept = async (issueId, deptId) => {
    try {
      await api.post(`/complaints/assign-dept/${issueId}`, { department_id: deptId });
      fetchData();
    } catch {
      alert('Assignment failed');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/departments', newDept);
      setShowDeptModal(false);
      fetchData();
    } catch {
      alert('Creation failed');
    }
  };

  if (loading) return <div className="loading-screen">Loading Command Center...</div>;

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6'];
  const STATUS_COLORS = {
    pending: '#dc2626',
    in_progress: '#f59e0b',
    completed: '#10b981'
  };

  const pieData = dashboardStats ? [
    { name: 'Pending', value: dashboardStats.pending },
    { name: 'In Progress', value: dashboardStats.in_progress },
    { name: 'Completed', value: dashboardStats.completed }
  ] : [];
  const pendingDepartmentHeads = pendingUsers.filter((user) => hasRole(user.role, 'head'));
  const pendingVolunteers = pendingUsers.filter((user) => hasRole(user.role, 'volunteer'));

  return (
    <div className="admin-dashboard fade-in">
      {/* Tab Navigation */}
      <div className="dashboard-nav glass">
        <div className="nav-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Staff Approvals {pendingUsers.length > 0 && <span className="notif-dot"></span>}
          </button>
          <button className={activeTab === 'issues' ? 'active' : ''} onClick={() => setActiveTab('issues')}>
            <Shield size={18} /> Allocation {unassignedIssues.length > 0 && <span className="notif-dot"></span>}
          </button>
          <button className={activeTab === 'depts' ? 'active' : ''} onClick={() => setActiveTab('depts')}>
            <Building size={18} /> Departments
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* 1. Stats Cards */}
            <div className="admin-stats-grid">
              <div className="stat-card glass border-red">
                <div className="stat-header">
                  <div className="icon-box bg-red-low"><AlertCircle color="#dc2626" /></div>
                  <span className="trend positive"><ArrowUpRight size={14} /> 12%</span>
                </div>
                <div className="stat-body">
                  <h3>Pending Issues</h3>
                  <div className="value">{dashboardStats?.pending || 0}</div>
                </div>
              </div>
              <div className="stat-card glass border-yellow">
                <div className="stat-header">
                  <div className="icon-box bg-yellow-low"><Clock color="#f59e0b" /></div>
                  <span className="trend positive"><ArrowUpRight size={14} /> 8%</span>
                </div>
                <div className="stat-body">
                  <h3>In Progress</h3>
                  <div className="value">{dashboardStats?.in_progress || 0}</div>
                </div>
              </div>
              <div className="stat-card glass border-green">
                <div className="stat-header">
                  <div className="icon-box bg-green-low"><CheckCircle color="#10b981" /></div>
                  <span className="trend positive"><ArrowUpRight size={14} /> 24%</span>
                </div>
                <div className="stat-body">
                  <h3>Completed</h3>
                  <div className="value">{dashboardStats?.completed || 0}</div>
                </div>
              </div>
              <div className="stat-card glass border-purple">
                <div className="stat-header">
                  <div className="icon-box bg-purple-low"><Users color="#8b5cf6" /></div>
                  <span className="trend neutral">Stable</span>
                </div>
                <div className="stat-body">
                  <h3>Volunteers</h3>
                  <div className="value">{dashboardStats?.volunteers || 0}</div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="dashboard-main-grid">
              {/* Left Column: Dept Overview & Charts */}
              <div className="dashboard-left">
                {/* 2. Department Overview Grid */}
                <section className="section-container">
                  <div className="section-header">
                    <h2>Departmental Performance</h2>
                    <button className="btn btn-text" onClick={() => setActiveTab('depts')}>View All <ArrowRight size={14} /></button>
                  </div>
                  <div className="dept-overview-grid">
                    {deptStats.map((dept, idx) => (
                      <div key={idx} className="dept-mini-card glass" style={{ borderLeft: `4px solid ${COLORS[idx % COLORS.length]}` }}>
                        <div className="dept-card-header">
                          <h4>{dept.department}</h4>
                          <span className="worker-count"><Users size={12} /> {dept.totalWorkers}</span>
                        </div>
                        <div className="dept-card-stats">
                          <div className="mini-stat">
                            <label>Issues</label>
                            <span>{dept.totalIssues}</span>
                          </div>
                          <div className="mini-stat">
                            <label>In Progress</label>
                            <span className="text-yellow">{dept.inProgress}</span>
                          </div>
                          <div className="mini-stat">
                            <label>Completed</label>
                            <span className="text-green">{dept.completed}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 3. Analytics Section */}
                <section className="section-container analytics-section">
                  <div className="charts-grid-dashboard">
                    <div className="chart-card glass">
                      <h3>Resolution Progress</h3>
                      <div className="chart-container-mini">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={deptStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="department" axisLine={false} tickLine={false} fontSize={10} />
                            <YAxis axisLine={false} tickLine={false} fontSize={10} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                            <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="chart-card glass">
                      <h3>System-wide Status</h3>
                      <div className="chart-container-mini">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={Object.values(STATUS_COLORS)[index % 3]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                          <div className="legend-item"><span className="dot bg-red"></span> Pending</div>
                          <div className="legend-item"><span className="dot bg-yellow"></span> In Progress</div>
                          <div className="legend-item"><span className="dot bg-green"></span> Completed</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: Quick Actions, Recent Issues, Notifications */}
              <div className="dashboard-right">
                {/* 4. Quick Actions */}
                <section className="section-container">
                  <h3>Quick Commands</h3>
                  <div className="quick-actions-grid">
                    <button className="action-btn glass" onClick={() => setActiveTab('issues')}>
                      <div className="action-icon bg-blue-low"><Plus color="#3b82f6" /></div>
                      <span>Assign Issue</span>
                    </button>
                    <button className="action-btn glass" onClick={() => setActiveTab('users')}>
                      <div className="action-icon bg-purple-low"><UserPlus color="#8b5cf6" /></div>
                      <span>Approvals</span>
                    </button>
                    <button className="action-btn glass" onClick={() => fetchData()}>
                      <div className="action-icon bg-green-low"><TrendingUp color="#10b981" /></div>
                      <span>Refresh</span>
                    </button>
                  </div>
                </section>

                {/* 5. Recent Issues List */}
                <section className="section-container">
                  <div className="section-header">
                    <h3>Recent Issues</h3>
                    <button className="btn btn-text" onClick={() => setActiveTab('issues')}>View All</button>
                  </div>
                  <div className="recent-list">
                    {recentIssues.length === 0 ? <p className="empty-text">No recent issues.</p> : recentIssues.map(issue => (
                      <div key={issue._id} className="recent-item entry-animate">
                        <div className="item-info">
                          <h4>{issue.title}</h4>
                          <div className="item-meta">
                            <span>{issue.department_id?.name || 'Unassigned'}</span> • <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className={`status-pill ${issue.status}`}>{issue.status.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 6. Notifications Feed */}
                <section className="section-container">
                  <h3>System Feed</h3>
                  <div className="notifications-feed">
                    {notifications.length === 0 ? <p className="empty-text">Nothing to report.</p> : notifications.map(notif => (
                      <div key={notif._id} className="notif-item">
                        <div className="notif-icon"><Bell size={14} /></div>
                        <div className="notif-body">
                          <p>{notif.message}</p>
                          <span className="notif-time">{new Date(notif.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Existing Functional Tabs (Keep styling consistent with Dashboard) */}
        {activeTab === 'users' && (
          <div className="glass legacy-tab-content fade-in">
            <div className="panel-header">
              <h3>Staff Approval Requests</h3>
              <p>Verify high-level staff credentials and department leadership</p>
            </div>

            {/* Department Heads Section */}
            <div className="approval-section" style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                 <Shield size={20} color="#3b82f6" />
                 <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#3b82f6' }}>Pending Department Heads</h4>
              </div>
              <div className="users-list-modern">
                {pendingDepartmentHeads.length === 0 ? (
                  <p className="empty-mini">No pending head applications.</p>
                ) : (
                  pendingDepartmentHeads.map(user => (
                    <div key={user._id} className="user-approval-card glass border-blue-soft">
                      <div className="user-primary">
                        <div className="user-avatar-placeholder" style={{ background: '#3b82f6' }}>{user.name[0]}</div>
                        <div>
                          <h4>{user.name}</h4>
                          <p>{user.email}</p>
                        </div>
                      </div>
                      <div className="user-details">
                         <label>Role</label>
                         <span style={{ color: '#3b82f6' }}>{getRoleLabel(user.role)}</span>
                      </div>
                      <div className="user-details">
                         <label>Department</label>
                         <span style={{ color: '#3b82f6' }}>{user.department_id?.name || 'Unassigned'}</span>
                      </div>
                      <div className="action-buttons">
                        <button className="btn btn-success" onClick={() => handleUserAction(user._id, 'approve')}>Approve</button>
                        <button className="btn btn-danger" onClick={() => handleUserAction(user._id, 'reject')}>Reject</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Volunteers Section */}
            <div className="approval-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                 <Users size={20} color="#8b5cf6" />
                 <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#8b5cf6' }}>Pending Volunteers</h4>
              </div>
              <div className="users-list-modern">
                {pendingVolunteers.length === 0 ? (
                  <p className="empty-mini">No pending volunteer applications.</p>
                ) : (
                  pendingVolunteers.map(user => (
                    <div key={user._id} className="user-approval-card glass border-purple-soft">
                      <div className="user-primary">
                        <div className="user-avatar-placeholder" style={{ background: '#8b5cf6' }}>{user.name[0]}</div>
                        <div>
                          <h4>{user.name}</h4>
                          <p>{user.email}</p>
                        </div>
                      </div>
                      <div className="user-details">
                         <label>Role</label>
                         <span style={{ color: '#8b5cf6' }}>{getRoleLabel(user.role)}</span>
                      </div>
                      <div className="user-details">
                         <label>Department</label>
                         <span style={{ color: '#8b5cf6' }}>{user.department_id?.name || 'Unassigned'}</span>
                      </div>
                      <div className="action-buttons">
                        <button className="btn btn-success" onClick={() => handleUserAction(user._id, 'approve')}>Approve</button>
                        <button className="btn btn-danger" onClick={() => handleUserAction(user._id, 'reject')}>Reject</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="glass legacy-tab-content fade-in">
             <div className="panel-header">
                <h3>Unallocated Complaints</h3>
                <p>Direct citizen reports to appropriate departments</p>
             </div>
             <div className="allocation-grid">
                {unassignedIssues.length === 0 ? <p className="empty-state">All systems optimal. No unassigned issues.</p> : (
                  unassignedIssues.map(issue => (
                    <div key={issue._id} className="allocation-card glass">
                       <div className="issue-info-prime">
                          <h4>{issue.title}</h4>
                          <p><MapPin size={12}/> {issue.location?.address || 'Anonymous Location'}</p>
                       </div>
                       <select 
                         className="dept-select-modern"
                         onChange={(e) => handleAssignDept(issue._id, e.target.value)}
                         defaultValue=""
                       >
                         <option value="" disabled>Route to Department...</option>
                         {departments.map(dept => (
                           <option key={dept._id} value={dept._id}>{dept.name}</option>
                         ))}
                       </select>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'depts' && (
          <div className="glass legacy-tab-content fade-in">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3>Department Registry</h3>
                <p>Configure and manage civic sectors</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowDeptModal(true)}><Plus size={18} /> New Department</button>
            </div>
            <div className="departments-grid-modern">
               {departments.map(dept => (
                 <div key={dept._id} className="dept-profile-card glass">
                    <Shield className="dept-icon-shield" />
                    <h4>{dept.name}</h4>
                    <div className="dept-meta-info">
                       <p><strong>ID:</strong> {dept.department_id}</p>
                       <p><strong>Head:</strong> {dept.head_id?.name || 'Vacant'}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Register Department</h3>
            <form onSubmit={handleCreateDept}>
              <div className="input-group">
                <label>System Display Name</label>
                <input type="text" placeholder="e.g. Sanitation Authority" onChange={e => setNewDept({...newDept, name: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Operational Code</label>
                <input type="text" placeholder="e.g. SANI-01" onChange={e => setNewDept({...newDept, department_id: e.target.value})} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-text" onClick={() => setShowDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Registry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .admin-dashboard { padding-bottom: 3rem; }
        .dashboard-nav { padding: 0.75rem 2rem; margin-bottom: 2rem; border-radius: var(--radius); }
        .nav-tabs { display: flex; gap: 1rem; }
        .nav-tabs button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          background: none;
          border: none;
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.2s;
          position: relative;
        }
        .nav-tabs button:hover { color: var(--primary); background: var(--bg-main); }
        .nav-tabs button.active { color: var(--primary); background: var(--primary-low); }
        .notif-dot { position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; background: var(--danger); border-radius: 50%; border: 2px solid var(--bg-card); }

        /* Stats Cards */
        .admin-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
        .stat-card { padding: 1.5rem; border-radius: 20px; transition: transform 0.2s; border-top-width: 4px; }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .icon-box { pading: 0.75rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; }
        .value { font-size: 2.25rem; font-weight: 800; color: var(--text-main); margin-top: 0.5rem; }
        .trend { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 6px; display: flex; align-items: center; gap: 2px; }
        .trend.positive { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .trend.neutral { background: var(--bg-main); color: var(--text-muted); }

        .dashboard-main-grid { display: grid; grid-template-columns: 1fr 380px; gap: 2.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .section-header h2, .section-header h3 { margin: 0; font-size: 1.25rem; }

        /* Dept Overview */
        .dept-overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
        .dept-mini-card { padding: 1.25rem; border-radius: 16px; transition: all 0.2s; }
        .dept-mini-card:hover { background: var(--bg-main); }
        .dept-card-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .dept-card-header h4 { margin: 0; font-size: 0.95rem; }
        .worker-count { font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; background: var(--bg-main); padding: 2px 6px; border-radius: 4px; }
        .dept-card-stats { display: flex; gap: 1rem; }
        .mini-stat { flex: 1; }
        .mini-stat label { display: block; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px; }
        .mini-stat span { font-weight: 700; font-size: 0.9rem; }

        /* Charts */
        .charts-grid-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .chart-card { padding: 1.5rem; border-radius: 20px; }
        .chart-card h3 { font-size: 1rem; margin-bottom: 1.5rem; color: var(--text-muted); }
        .pie-legend { display: flex; justify-content: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--text-muted); }
        .dot { width: 8px; height: 8px; border-radius: 50%; }

        /* Right Column Components */
        .quick-actions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
        .action-btn { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 1.25rem; border-radius: 16px; border: none; cursor: pointer; transition: all 0.2s; }
        .action-btn:hover { background: var(--bg-main); transform: scale(1.02); }
        .action-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .action-btn span { font-size: 0.75rem; font-weight: 600; color: var(--text-main); }

        .recent-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .recent-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid var(--border); }
        .item-info h4 { margin: 0; font-size: 0.9rem; }
        .item-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
        .status-pill { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 0.3rem 0.6rem; border-radius: 6px; }
        .status-pill.pending { color: #dc2626; background: rgba(220, 38, 38, 0.1); }
        .status-pill.in_progress { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .status-pill.completed { color: #10b981; background: rgba(16, 185, 129, 0.1); }

        .notifications-feed { display: flex; flex-direction: column; gap: 1rem; }
        .notif-item { display: flex; gap: 1rem; align-items: flex-start; }
        .notif-icon { min-width: 28px; height: 28px; border-radius: 50%; background: var(--primary-low); color: var(--primary); display: flex; align-items: center; justify-content: center; }
        .notif-body p { margin: 0; font-size: 0.85rem; color: var(--text-main); line-height: 1.4; }
        .notif-time { font-size: 0.7rem; color: var(--text-muted); }

        /* Legacy Content Styling */
        .legacy-tab-content { padding: 2.5rem; border-radius: 20px; }
        .panel-header { margin-bottom: 2rem; }
        .panel-header h3 { font-size: 1.5rem; margin: 0; }
        .panel-header p { color: var(--text-muted); margin-top: 0.5rem; }

        .user-approval-card { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-radius: 16px; margin-bottom: 1rem; }
        .user-primary { display: flex; gap: 1.25rem; align-items: center; }
        .user-avatar-placeholder { width: 48px; height: 48px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; }
        .user-details label { display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
        .user-details span { font-weight: 600; color: var(--primary); }

        .allocation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .allocation-card { padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 1.5rem; }
        .issue-info-prime h4 { margin: 0; font-size: 1.1rem; }
        .issue-info-prime p { font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 8px; }
        .dept-select-modern { padding: 0.75rem; border-radius: 10px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); }

        .departments-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .dept-profile-card { padding: 2rem; border-radius: 20px; text-align: center; }
        .dept-icon-shield { width: 48px; height: 48px; color: var(--primary); margin: 0 auto 1.5rem; }
        .dept-meta-info { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); font-size: 0.9rem; text-align: left; }
        
        .loading-screen { padding: 4rem; text-align: center; font-size: 1.25rem; font-weight: 600; color: var(--primary); }
        .empty-state { padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic; }

        .border-red { border-top-color: #dc2626; }
        .border-yellow { border-top-color: #f59e0b; }
        .border-green { border-top-color: #10b981; }
        .border-purple { border-top-color: #8b5cf6; }
        .bg-red-low { background: rgba(220, 38, 38, 0.1); }
        .bg-yellow-low { background: rgba(245, 158, 11, 0.1); }
        .bg-green-low { background: rgba(16, 185, 129, 0.1); }
        .bg-purple-low { background: rgba(139, 92, 246, 0.1); }
        .bg-blue-low { background: rgba(59, 130, 246, 0.1); }
        .text-yellow { color: #f59e0b; }
        .text-green { color: #10b981; }
        .border-blue-soft { border: 1px solid rgba(59, 130, 246, 0.2); border-left: 4px solid #3b82f6; }
        .border-purple-soft { border: 1px solid rgba(139, 92, 246, 0.2); border-left: 4px solid #8b5cf6; }
        .empty-mini { padding: 2rem; text-align: center; color: var(--text-muted); background: var(--bg-main); border-radius: 12px; border: 1px dashed var(--border); font-size: 0.85rem; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
