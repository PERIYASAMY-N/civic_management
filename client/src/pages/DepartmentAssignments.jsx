import { useEffect, useState } from 'react';
import api from '../api';
import { Clock, MapPin, UserPlus } from 'lucide-react';
import { hasRole } from '../utils/userAccess';

const DepartmentAssignments = () => {
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
      setWorkers(staffRes.data.filter((member) => hasRole(member.role, 'worker')));
      setVolunteers(staffRes.data.filter((member) => hasRole(member.role, 'volunteer')));
      setPendingWorkers(pendingRes.data.filter((member) => hasRole(member.role, 'worker')));
    } catch {
      console.error('Error fetching department assignment data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/complaints/assign/${selectedIssue._id}`, assignment);
      alert('Task assigned successfully.');
      setSelectedIssue(null);
      setAssignment({ worker_id: '', volunteer_id: '', comments: '' });
      fetchData();
    } catch {
      alert('Assignment failed');
    }
  };

  const handleWorkerAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      fetchData();
    } catch {
      alert('Action failed');
    }
  };

  return (
    <div className="fade-in">
      <div className="department-work-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <UserPlus size={24} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0 }}>Pending Worker Approvals</h2>
                <p style={{ color: 'var(--text-muted)' }}>Approve workers before assigning them to field tasks.</p>
              </div>
            </div>

            {pendingWorkers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No pending worker registration requests.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Employee ID</th>
                      <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWorkers.map((worker) => (
                      <tr key={worker._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{worker.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{worker.email}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{worker.employee_id || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-success" style={{ padding: '0.4rem', background: 'var(--success)', color: '#fff' }} onClick={() => handleWorkerAction(worker._id, 'approve')}>
                              Approve
                            </button>
                            <button className="btn" style={{ padding: '0.4rem', background: 'var(--danger)', color: '#fff' }} onClick={() => handleWorkerAction(worker._id, 'reject')}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Department Assigned Issues</h2>
            {issues.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No issues are waiting for assignment right now.</p>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue._id}
                  className="glass"
                  style={{
                    padding: '1.25rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>{issue.title}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {issue.location?.address || 'No location'}
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

        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Department Snapshot</h3>
          <MiniStat label="Approved Workers" value={workers.length} color="var(--primary)" />
          <MiniStat label="Pending Approvals" value={pendingWorkers.length} color="var(--warning)" />
          <MiniStat label="Issues Awaiting Assignment" value={issues.length} color="var(--danger)" />

          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Clock size={20} color="var(--primary)" />
              <span style={{ fontWeight: 600 }}>Assignment Tip</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Approved workers become immediately assignable here, so this page now doubles as your main department queue.
            </p>
          </div>
        </div>
      </div>

      {selectedIssue && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Assign: {selectedIssue.title}</h3>
            <form onSubmit={handleAssign}>
              <div className="input-group">
                <label>Select Worker</label>
                <select value={assignment.worker_id} onChange={(event) => setAssignment({ ...assignment, worker_id: event.target.value })} required>
                  <option value="">Select Worker...</option>
                  {workers.map((worker) => (
                    <option key={worker._id} value={worker._id}>{worker.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Select Volunteer (Optional)</label>
                <select value={assignment.volunteer_id} onChange={(event) => setAssignment({ ...assignment, volunteer_id: event.target.value })}>
                  <option value="">Select Volunteer...</option>
                  {volunteers.map((volunteer) => (
                    <option key={volunteer._id} value={volunteer._id}>{volunteer.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Instructions</label>
                <textarea value={assignment.comments} onChange={(event) => setAssignment({ ...assignment, comments: event.target.value })} />
              </div>
              <div className="btn-group" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={() => setSelectedIssue(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
    <span>{label}</span>
    <strong style={{ color, fontSize: '1.2rem' }}>{value}</strong>
  </div>
);

export default DepartmentAssignments;
