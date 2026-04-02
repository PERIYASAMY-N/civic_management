import { useState, useEffect } from 'react';
import api from '../api';
import { UserPlus, Clock, AlertCircle } from 'lucide-react';

const DeptHeadDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assignment, setAssignment] = useState({ worker_id: '', volunteer_id: '', comments: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [issuesRes, staffRes] = await Promise.all([
          api.get('/complaints/dept-issues'),
          api.get('/auth/staff')
        ]);
        setIssues(issuesRes.data);
        setWorkers(staffRes.data.filter(s => s.role === 'worker'));
        setVolunteers(staffRes.data.filter(s => s.role === 'volunteer'));
      } catch {
        console.error('Error fetching dashboard data');
      }
    };
    fetchData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/complaints/assign/${selectedIssue._id}`, assignment);
      alert('Task assigned!');
      // Refresh issues
      setIssues(issues.filter(i => i._id !== selectedIssue._id));
      setSelectedIssue(null);
    } catch {
      alert('Assignment failed');
    }
  };

  return (
    <div className="fade-in">
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3>Unassigned Departmental Issues</h3>
          <div className="issues-list" style={{ marginTop: '1.5rem' }}>
            {issues.map(issue => (
              <div key={issue._id} className="issue-card glass" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>{issue.title}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{issue.location.address} • Priority: {issue.priority}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setSelectedIssue(issue)}>
                  <UserPlus size={18} />
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3>Department Stats</h3>
          <div style={{ marginTop: '1.5rem' }}>
            <div className="stat-mini">
              <span>Active Workers</span>
              <strong>{workers.length}</strong>
            </div>
            <div className="stat-mini">
              <span>Pending Tasks</span>
              <strong>{issues.length}</strong>
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
