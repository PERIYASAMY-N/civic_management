import { useEffect, useState } from 'react';
import api, { resolveApiAssetUrl } from '../api';
import {
  Building,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
  Shield,
  Users
} from 'lucide-react';
import { getRoleLabel, hasRole } from '../utils/userAccess';

const getProofImage = (issue, stage) => (
  stage === 'before'
    ? issue?.beforeImage || issue?.work_proof?.before_image || ''
    : issue?.afterImage || issue?.work_proof?.after_image || ''
);

const AdminOperations = () => {
  const [activeTab, setActiveTab] = useState('approvals');
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [unassignedIssues, setUnassignedIssues] = useState([]);
  const [verifiedIssues, setVerifiedIssues] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', department_id: '', head_id: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, departmentsRes, complaintsRes] = await Promise.all([
        api.get('/auth/pending-staff'),
        api.get('/admin/departments'),
        api.get('/complaints')
      ]);

      const complaints = Array.isArray(complaintsRes.data) ? complaintsRes.data : [];
      setPendingUsers(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setDepartments(Array.isArray(departmentsRes.data) ? departmentsRes.data : []);
      setUnassignedIssues(complaints.filter((issue) => !issue.department_id));
      setVerifiedIssues(complaints.filter((issue) => issue.status === 'verified'));
    } catch (err) {
      console.error('Error fetching admin operations data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
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
    if (!deptId) return;

    try {
      await api.post(`/complaints/assign-dept/${issueId}`, { department_id: deptId });
      await fetchData();
    } catch {
      alert('Assignment failed');
    }
  };

  const handleCloseIssue = async (issueId) => {
    try {
      await api.post(`/complaints/close/${issueId}`);
      alert('Issue closed successfully.');
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Unable to close this issue');
    }
  };

  const handleCreateDept = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/departments', newDept);
      setShowDeptModal(false);
      setNewDept({ name: '', department_id: '', head_id: '' });
      await fetchData();
    } catch {
      alert('Department creation failed');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading admin tools...</div>;
  }

  const pendingDepartmentHeads = pendingUsers.filter((user) => hasRole(user.role, 'head'));
  const pendingVolunteers = pendingUsers.filter((user) => hasRole(user.role, 'volunteer'));

  return (
    <div className="fade-in admin-operations">
      <div className="operations-nav glass">
        <button className={activeTab === 'approvals' ? 'active' : ''} onClick={() => setActiveTab('approvals')}>
          <Users size={18} /> Approvals
        </button>
        <button className={activeTab === 'allocation' ? 'active' : ''} onClick={() => setActiveTab('allocation')}>
          <Shield size={18} /> Allocation
        </button>
        <button className={activeTab === 'closure' ? 'active' : ''} onClick={() => setActiveTab('closure')}>
          <CheckCircle2 size={18} /> Verified Issues
        </button>
        <button className={activeTab === 'departments' ? 'active' : ''} onClick={() => setActiveTab('departments')}>
          <Building size={18} /> Departments
        </button>
      </div>

      {activeTab === 'approvals' ? (
        <div className="glass operations-panel">
          <div className="panel-header">
            <h2>Staff Approvals</h2>
            <p>Approve department heads and volunteers without a separate dashboard homepage.</p>
          </div>

          <ApprovalGroup
            title="Pending Department Heads"
            users={pendingDepartmentHeads}
            onAction={handleUserAction}
          />

          <ApprovalGroup
            title="Pending Volunteers"
            users={pendingVolunteers}
            onAction={handleUserAction}
          />
        </div>
      ) : null}

      {activeTab === 'allocation' ? (
        <div className="glass operations-panel">
          <div className="panel-header">
            <h2>Unassigned Issues</h2>
            <p>Route new reports to the right department.</p>
          </div>

          <div className="allocation-grid">
            {unassignedIssues.length === 0 ? (
              <div className="empty-card">All issues are currently assigned.</div>
            ) : (
              unassignedIssues.map((issue) => (
                <div key={issue._id} className="allocation-card glass">
                  <div>
                    <h3>{issue.title}</h3>
                    <p>{issue.location?.address || 'No location provided'}</p>
                  </div>
                  <select
                    className="dept-select-modern"
                    defaultValue=""
                    onChange={(event) => handleAssignDept(issue._id, event.target.value)}
                  >
                    <option value="" disabled>Select Department...</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'closure' ? (
        <div className="glass operations-panel">
          <div className="panel-header">
            <h2>Verified Issues</h2>
            <p>Department Head verified the work. Review it here and close the issue.</p>
          </div>

          <div className="verified-grid">
            {verifiedIssues.length === 0 ? (
              <div className="empty-card">No verified issues are waiting for final closure.</div>
            ) : (
              verifiedIssues.map((issue) => (
                <article key={issue._id} className="verified-card glass">
                  <div className="verified-card-top">
                    <div>
                      <h3>{issue.title}</h3>
                      <p>{issue.description}</p>
                      <p>{issue.location?.address || issue.address || 'Location unavailable'}</p>
                    </div>
                    <span className={`status-badge ${issue.status}`}>Verified</span>
                  </div>

                  <div className="proof-grid">
                    <ProofCard label="Before Image" src={getProofImage(issue, 'before')} alt={`${issue.title} before`} />
                    <ProofCard label="After Image" src={getProofImage(issue, 'after')} alt={`${issue.title} after`} />
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => void handleCloseIssue(issue._id)}
                  >
                    Mark Closed
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'departments' ? (
        <div className="glass operations-panel">
          <div className="panel-header split">
            <div>
              <h2>Department Registry</h2>
              <p>Manage departments and keep operational codes organized.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowDeptModal(true)}>
              <Plus size={18} /> New Department
            </button>
          </div>

          <div className="departments-grid-modern">
            {departments.map((department) => (
              <div key={department._id} className="dept-profile-card glass">
                <Shield className="dept-icon-shield" />
                <h3>{department.name}</h3>
                <p><strong>ID:</strong> {department.department_id}</p>
                <p><strong>Head:</strong> {department.head_id?.name || 'Vacant'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showDeptModal ? (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Create Department</h3>
            <form onSubmit={handleCreateDept}>
              <div className="input-group">
                <label>Department Name</label>
                <input
                  value={newDept.name}
                  onChange={(event) => setNewDept({ ...newDept, name: event.target.value })}
                  required
                />
              </div>
              <div className="input-group">
                <label>Department Code</label>
                <input
                  value={newDept.department_id}
                  onChange={(event) => setNewDept({ ...newDept, department_id: event.target.value })}
                  required
                />
              </div>
              <div className="btn-group">
                <button type="button" className="btn" onClick={() => setShowDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Department</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style>{`
        .operations-nav {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .operations-nav button {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          background: transparent;
          color: var(--text-muted);
          font-weight: 600;
        }

        .operations-nav button.active {
          background: rgba(79, 70, 229, 0.12);
          color: var(--primary);
        }

        .operations-panel {
          padding: 2rem;
          border-radius: 20px;
        }

        .panel-header {
          margin-bottom: 1.75rem;
        }

        .panel-header.split {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .panel-header p,
        .approval-card p,
        .allocation-card p,
        .dept-profile-card p,
        .verified-card p,
        .empty-card {
          color: var(--text-muted);
        }

        .approval-group + .approval-group {
          margin-top: 2rem;
        }

        .approval-group h3 {
          margin-bottom: 1rem;
        }

        .approval-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          border-radius: 16px;
          border: 1px solid var(--border);
          margin-bottom: 1rem;
        }

        .allocation-grid,
        .departments-grid-modern,
        .verified-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .allocation-card,
        .dept-profile-card,
        .verified-card,
        .empty-card {
          padding: 1.25rem;
          border-radius: 16px;
        }

        .verified-card {
          display: grid;
          gap: 1rem;
          border: 1px solid var(--border);
        }

        .verified-card-top {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .proof-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .proof-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 0.75rem;
          background: var(--bg-main);
        }

        .proof-card strong {
          display: block;
          margin-bottom: 0.6rem;
          font-size: 0.9rem;
        }

        .proof-card img,
        .proof-placeholder {
          width: 100%;
          height: 160px;
          object-fit: cover;
          border-radius: 12px;
        }

        .proof-placeholder {
          display: grid;
          place-items: center;
          color: var(--text-muted);
          border: 1px dashed var(--border);
          background: rgba(148, 163, 184, 0.08);
          text-align: center;
          padding: 1rem;
        }

        .empty-card {
          background: var(--bg-main);
          border: 1px dashed var(--border);
        }

        .dept-profile-card {
          text-align: center;
        }

        .dept-profile-card p {
          margin-top: 0.35rem;
        }

        .dept-icon-shield {
          color: var(--primary);
          margin: 0 auto 1rem;
        }

        .btn-row,
        .btn-group {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .btn-group {
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        @media (max-width: 720px) {
          .operations-nav,
          .approval-card,
          .panel-header.split,
          .btn-group,
          .btn-row,
          .verified-card-top,
          .proof-grid {
            flex-direction: column;
          }

          .proof-grid {
            display: grid;
            grid-template-columns: 1fr;
          }

          .btn-row > *,
          .btn-group > * {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const ApprovalGroup = ({ title, users, onAction }) => (
  <section className="approval-group">
    <h3>{title}</h3>
    {users.length === 0 ? (
      <div className="empty-card">No pending approvals in this section.</div>
    ) : (
      users.map((user) => (
        <div key={user._id} className="approval-card">
          <div>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
            <p>{getRoleLabel(user.role)} • {user.department_id?.name || 'Unassigned'}</p>
          </div>
          <div className="btn-row">
            <button className="btn btn-success" style={{ background: 'var(--success)', color: '#fff' }} onClick={() => onAction(user._id, 'approve')}>
              Approve
            </button>
            <button className="btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => onAction(user._id, 'reject')}>
              Reject
            </button>
          </div>
        </div>
      ))
    )}
  </section>
);

const ProofCard = ({ label, src, alt }) => (
  <div className="proof-card">
    <strong>{label}</strong>
    {src ? (
      <img src={resolveApiAssetUrl(src)} alt={alt} />
    ) : (
      <div className="proof-placeholder">
        <ImageIcon size={18} />
        <p>No image available</p>
      </div>
    )}
  </div>
);

export default AdminOperations;
