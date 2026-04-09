import { useState, useEffect } from 'react';
import api from '../api';
import { UserPlus, Clock, AlertCircle } from 'lucide-react';
import { hasRole } from '../utils/userAccess';

const DeptHeadDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assignment, setAssignment] = useState({ worker_id: '', volunteer_id: '', comments: '' });

  const fetchData = async () => {
    try {
      const [issuesRes, staffRes, pendingRes] = await Promise.all([
        api.get('/complaints/dept-issues'),
        api.get('/auth/staff'),
        api.get('/auth/pending-staff')
      ]);
      setIssues(issuesRes.data);
      setWorkers(staffRes.data.filter(s => hasRole(s.role, 'worker')));
      setVolunteers(staffRes.data.filter(s => hasRole(s.role, 'volunteer')));
      setPendingWorkers(pendingRes.data.filter(s => hasRole(s.role, 'worker')));
    } catch {
      console.error('Error fetching dashboard data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/complaints/assign/${selectedIssue._id}`, assignment);
      alert('Task assigned!');
      fetchData();
      setSelectedIssue(null);
    } catch {
      alert('Assignment failed');
    }
  };

  const handleWorkerAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      alert(`Worker ${action}ed successfully`);
      fetchData();
    } catch {
      alert('Action failed');
    }
  };

  return (
    <div className="fade-in">
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="main-content" style={{ display: 'grid', gap: '2rem' }}>
          {/* Pending Workers Section */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <UserPlus size={24} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>Pending Workers Approval</h3>
            </div>
            {pendingWorkers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No new worker registration requests.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Emp ID</th>
                      <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWorkers.map(w => (
                      <tr key={w._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{w.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{w.email}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{w.employee_id}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-success" style={{ padding: '0.4rem' }} onClick={() => handleWorkerAction(w._id, 'approve')}>Approve</button>
                            <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleWorkerAction(w._id, 'reject')}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unassigned Issues Section */}
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Assigned Issues to Department</h3>
            <div className="issues-list">
              {issues.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No issues pending assignment.</p>
              ) : (
                issues.map(issue => (
                  <div key={issue._id} className="issue-card glass shadow-sm" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>{issue.title}</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {issue.location?.address} • <span className={`status-badge ${issue.status}`}>{issue.status}</span>
                      </p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setSelectedIssue(issue)}>
                      <UserPlus size={18} />
                      Assign Worker
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', position: 'sticky', top: '100px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Department Overview</h3>
            <div className="stat-mini">
              <span>Approved Workers</span>
              <strong style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{workers.length}</strong>
            </div>
            <div className="stat-mini">
              <span>Pending Approvals</span>
              <strong style={{ color: 'var(--warning)', fontSize: '1.2rem' }}>{pendingWorkers.length}</strong>
            </div>
            <div className="stat-mini">
              <span>Unassigned Issues</span>
              <strong style={{ color: 'var(--danger)', fontSize: '1.2rem' }}>{issues.length}</strong>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Clock size={20} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Assignment Tip</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Workers must be approved before they can be assigned to issues.
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedIssue && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Assigning: {selectedIssue.title}</h3>
            <form onSubmit={handleAssign}>
              <div className="input-group">
                <label>Select Worker</label>
                <select onChange={(e) => setAssignment({...assignment, worker_id: e.target.value})} required>
                  <option value="">Select Worker...</option>
                  {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Select Volunteer (Optional)</label>
                <select onChange={(e) => setAssignment({...assignment, volunteer_id: e.target.value})}>
                  <option value="">Select Volunteer...</option>
                  {volunteers.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Instructions</label>
                <textarea onChange={(e) => setAssignment({...assignment, comments: e.target.value})} />
              </div>
              <div className="btn-group">
                <button type="button" className="btn" onClick={() => setSelectedIssue(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .stat-mini { display: flex; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid var(--border); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { width: 100%; max-width: 500px; padding: 3rem; border-radius: 20px; }
      `}</style>
    </div>
  );
};

export default DeptHeadDashboard;
