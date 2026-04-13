import { useEffect, useState } from 'react';
import api, { resolveApiAssetUrl } from '../api';
import {
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  UserPlus,
  XCircle
} from 'lucide-react';
import { hasRole } from '../utils/userAccess';

const getProofImage = (issue, stage) => (
  stage === 'before'
    ? issue?.beforeImage || issue?.work_proof?.before_image || ''
    : stage === 'bill'
      ? issue?.billImage || issue?.work_proof?.bill_image || ''
      : issue?.afterImage || issue?.work_proof?.after_image || ''
);

const getProofGeo = (issue, stage) => {
  if (stage === 'before') {
    return {
      address: issue?.beforeAddress || '',
      time: issue?.beforeTime || ''
    };
  }

  if (stage === 'bill') {
    return {
      address: issue?.billAddress || '',
      time: issue?.billTime || ''
    };
  }

  return {
    address: issue?.afterAddress || '',
    time: issue?.afterTime || ''
  };
};

const DepartmentAssignments = () => {
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assignment, setAssignment] = useState({ worker_id: '', volunteer_id: '', comments: '' });
  const [reviewNotes, setReviewNotes] = useState({});

  const fetchData = async () => {
    try {
      const [issuesRes, staffRes, pendingRes, verificationRes] = await Promise.all([
        api.get('/complaints/dept-issues'),
        api.get('/auth/staff'),
        api.get('/auth/pending-staff'),
        api.get('/complaints/verification-queue')
      ]);

      setIssues(Array.isArray(issuesRes.data) ? issuesRes.data : []);
      setWorkers((Array.isArray(staffRes.data) ? staffRes.data : []).filter((member) => hasRole(member.role, 'worker')));
      setVolunteers((Array.isArray(staffRes.data) ? staffRes.data : []).filter((member) => hasRole(member.role, 'volunteer')));
      setPendingWorkers((Array.isArray(pendingRes.data) ? pendingRes.data : []).filter((member) => hasRole(member.role, 'worker')));
      setVerificationQueue(Array.isArray(verificationRes.data) ? verificationRes.data : []);
    } catch (error) {
      console.error('Error fetching department assignment data', error);
    }
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  const handleAssign = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/complaints/assign/${selectedIssue._id}`, assignment);
      alert('Task assigned successfully.');
      setSelectedIssue(null);
      setAssignment({ worker_id: '', volunteer_id: '', comments: '' });
      await fetchData();
    } catch {
      alert('Assignment failed');
    }
  };

  const handleWorkerAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      await fetchData();
    } catch {
      alert('Action failed');
    }
  };

  const handleVerification = async (issueId, action) => {
    try {
      await api.post(`/complaints/verify/${issueId}`, {
        action,
        comments: reviewNotes[issueId] || ''
      });
      alert(action === 'approve' ? 'Issue verified.' : 'Issue sent back for rework.');
      setReviewNotes((current) => ({
        ...current,
        [issueId]: ''
      }));
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Verification action failed');
    }
  };

  return (
    <div className="fade-in department-assignments-page">
      <div className="department-work-grid">
        <div className="department-main-column">
          <section className="glass department-panel">
            <div className="section-heading">
              <div>
                <h2>Pending Worker Approvals</h2>
                <p>Approve workers before assigning them to field tasks.</p>
              </div>
              <Clock size={22} color="var(--primary)" />
            </div>

            {pendingWorkers.length === 0 ? (
              <div className="empty-card">No pending worker registration requests.</div>
            ) : (
              <div className="worker-approval-list">
                {pendingWorkers.map((worker) => (
                  <div key={worker._id} className="approval-card">
                    <div>
                      <strong>{worker.name}</strong>
                      <p>{worker.email}</p>
                      <p>{worker.employee_id || 'Employee ID not provided'}</p>
                    </div>
                    <div className="btn-row">
                      <button
                        className="btn btn-success"
                        style={{ background: 'var(--success)', color: '#fff' }}
                        onClick={() => void handleWorkerAction(worker._id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn"
                        style={{ background: 'var(--danger)', color: '#fff' }}
                        onClick={() => void handleWorkerAction(worker._id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass department-panel">
            <div className="section-heading">
              <div>
                <h2>Department Assigned Issues</h2>
                <p>Route department issues to a worker and optional volunteer.</p>
              </div>
              <UserPlus size={22} color="var(--primary)" />
            </div>

            {issues.length === 0 ? (
              <div className="empty-card">No issues are waiting for assignment right now.</div>
            ) : (
              <div className="assignment-list">
                {issues.map((issue) => (
                  <div key={issue._id} className="assignment-card">
                    <div>
                      <h3>{issue.title}</h3>
                      <p>{issue.description}</p>
                      <div className="meta-line">
                        <MapPin size={14} />
                        <span>{issue.location?.address || 'No location'}</span>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setSelectedIssue(issue)}>
                      <UserPlus size={18} />
                      Assign Worker
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass department-panel">
            <div className="section-heading">
              <div>
                <h2>Verification Queue</h2>
                <p>Review before and after proof for issues waiting for verification.</p>
              </div>
              <CheckCircle2 size={22} color="var(--success)" />
            </div>

            {verificationQueue.length === 0 ? (
              <div className="empty-card">No issues are currently waiting for verification.</div>
            ) : (
              <div className="verification-grid">
                {verificationQueue.map((issue) => {
                  const beforeImage = getProofImage(issue, 'before');
                  const afterImage = getProofImage(issue, 'after');

                  return (
                    <article key={issue._id} className="verification-card">
                      <div className="verification-card-top">
                        <div>
                          <h3>{issue.title}</h3>
                          <p>{issue.description}</p>
                          <p>{issue.workDescription || issue.work_proof?.description || 'No work description provided.'}</p>
                          <p>{issue.assigned_worker_id?.name || 'Worker not assigned yet'}</p>
                        </div>
                        <span className={`status-badge ${issue.status}`}>Waiting Verification</span>
                      </div>

                      <div className="meta-line">
                        <MapPin size={14} />
                        <span>{issue.location?.address || issue.address || 'Location unavailable'}</span>
                      </div>

                      <div className="proof-grid">
                        <ProofCard label="Before Image" src={beforeImage} alt={`${issue.title} before work`} meta={getProofGeo(issue, 'before')} />
                        <ProofCard label="After Image" src={afterImage} alt={`${issue.title} after work`} meta={getProofGeo(issue, 'after')} />
                        <ProofCard label="Bill Image" src={getProofImage(issue, 'bill')} alt={`${issue.title} bill proof`} meta={getProofGeo(issue, 'bill')} />
                      </div>

                      <div className="verification-note">
                        <label htmlFor={`review-${issue._id}`}>Verification Notes</label>
                        <textarea
                          id={`review-${issue._id}`}
                          placeholder="Add review notes or rejection reason"
                          value={reviewNotes[issue._id] || ''}
                          onChange={(event) => setReviewNotes((current) => ({
                            ...current,
                            [issue._id]: event.target.value
                          }))}
                        />
                      </div>

                      <div className="btn-row">
                        <button
                          className="btn btn-success"
                          style={{ background: 'var(--success)', color: '#fff' }}
                          onClick={() => void handleVerification(issue._id, 'approve')}
                        >
                          <CheckCircle2 size={18} />
                          Approve
                        </button>
                        <button
                          className="btn"
                          style={{ background: 'var(--danger)', color: '#fff' }}
                          onClick={() => void handleVerification(issue._id, 'reject')}
                        >
                          <XCircle size={18} />
                          Reject
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="glass department-sidebar">
          <h3>Department Snapshot</h3>
          <MiniStat label="Approved Workers" value={workers.length} color="var(--primary)" />
          <MiniStat label="Pending Approvals" value={pendingWorkers.length} color="var(--warning)" />
          <MiniStat label="Issues Awaiting Assignment" value={issues.length} color="var(--danger)" />
          <MiniStat label="Waiting Verification" value={verificationQueue.length} color="var(--success)" />

          <div className="sidebar-tip">
            <div className="meta-line" style={{ marginBottom: '0.6rem' }}>
              <Clock size={18} color="var(--primary)" />
              <strong>Workflow Tip</strong>
            </div>
            <p>
              Workers now submit before and after proof. Your queue is the approval gate before admin closure.
            </p>
          </div>
        </aside>
      </div>

      {selectedIssue ? (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Assign: {selectedIssue.title}</h3>
            <form onSubmit={handleAssign}>
              <div className="input-group">
                <label>Select Worker</label>
                <select
                  value={assignment.worker_id}
                  onChange={(event) => setAssignment({ ...assignment, worker_id: event.target.value })}
                  required
                >
                  <option value="">Select Worker...</option>
                  {workers.map((worker) => (
                    <option key={worker._id} value={worker._id}>{worker.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Select Volunteer (Optional)</label>
                <select
                  value={assignment.volunteer_id}
                  onChange={(event) => setAssignment({ ...assignment, volunteer_id: event.target.value })}
                >
                  <option value="">Select Volunteer...</option>
                  {volunteers.map((volunteer) => (
                    <option key={volunteer._id} value={volunteer._id}>{volunteer.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Instructions</label>
                <textarea
                  value={assignment.comments}
                  onChange={(event) => setAssignment({ ...assignment, comments: event.target.value })}
                />
              </div>
              <div className="btn-row" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={() => setSelectedIssue(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style>{`
        .department-work-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.2fr) minmax(280px, 0.9fr);
          gap: 1.5rem;
        }

        .department-main-column {
          display: grid;
          gap: 1.5rem;
        }

        .department-panel,
        .department-sidebar {
          padding: 1.5rem;
          border-radius: var(--radius);
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .section-heading p,
        .approval-card p,
        .assignment-card p,
        .sidebar-tip p,
        .empty-card {
          color: var(--text-muted);
        }

        .worker-approval-list,
        .assignment-list,
        .verification-grid {
          display: grid;
          gap: 1rem;
        }

        .approval-card,
        .assignment-card,
        .verification-card,
        .empty-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.1rem;
          background: var(--bg-main);
        }

        .approval-card,
        .assignment-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .assignment-card h3,
        .verification-card h3 {
          margin-bottom: 0.35rem;
        }

        .verification-card-top {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .proof-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
          margin: 1rem 0;
        }

        .proof-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 0.75rem;
          background: var(--bg-card);
        }

        .proof-card strong {
          display: block;
          margin-bottom: 0.6rem;
          font-size: 0.9rem;
        }

        .proof-meta {
          display: grid;
          gap: 0.35rem;
          margin-top: 0.7rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(148, 163, 184, 0.06);
        }

        .proof-card img,
        .proof-placeholder {
          width: 100%;
          height: 160px;
          border-radius: 12px;
          object-fit: cover;
        }

        .proof-placeholder {
          display: grid;
          place-items: center;
          border: 1px dashed var(--border);
          color: var(--text-muted);
          background: rgba(148, 163, 184, 0.08);
          text-align: center;
          padding: 1rem;
        }

        .verification-note label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .verification-note textarea {
          min-height: 96px;
          resize: vertical;
        }

        .meta-line {
          display: flex;
          gap: 0.45rem;
          align-items: center;
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .btn-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .department-sidebar {
          height: fit-content;
        }

        .sidebar-tip {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-main);
        }

        @media (max-width: 1080px) {
          .department-work-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .approval-card,
          .assignment-card,
          .verification-card-top,
          .btn-row,
          .proof-grid {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .proof-grid {
            display: grid;
          }

          .btn-row > * {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const ProofCard = ({ label, src, alt, meta }) => (
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
    {meta?.address || meta?.time ? (
      <div className="proof-meta">
        {meta.address ? (
          <div className="meta-line">
            <MapPin size={14} />
            <span>{meta.address}</span>
          </div>
        ) : null}
        {meta.time ? (
          <div className="meta-line">
            <Clock size={14} />
            <span>{new Intl.DateTimeFormat('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(meta.time))}</span>
          </div>
        ) : null}
      </div>
    ) : null}
  </div>
);

const MiniStat = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
    <span>{label}</span>
    <strong style={{ color, fontSize: '1.2rem' }}>{value}</strong>
  </div>
);

export default DepartmentAssignments;
