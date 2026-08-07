import { useCallback, useEffect, useState } from 'react';
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
import socket from '../realtime/socket';
import { useNotification } from '../context/NotificationContext';

const getApiErrorMessage = (error, fallback) => (
  error.response?.data?.message
  || error.response?.data?.error
  || error.message
  || fallback
);

const normalizeStatus = (status) => String(status || '').toLowerCase();

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
  const { addToast } = useNotification();

  const fetchData = useCallback(async () => {
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
      addToast(getApiErrorMessage(error, 'Unable to load department assignment data'), 'error');
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [fetchData]);

  useEffect(() => {
    socket.on('taskUpdated', fetchData);
    return () => socket.off('taskUpdated', fetchData);
  }, [fetchData]);

  const handleAssign = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/complaints/${selectedIssue._id}/assign-worker`, assignment);
      addToast('Task assigned successfully.', 'success');
      setSelectedIssue(null);
      setAssignment({ worker_id: '', volunteer_id: '', comments: '' });
      await fetchData();
    } catch (error) {
      addToast(getApiErrorMessage(error, 'Assignment failed'), 'error');
    }
  };

  const handleWorkerAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      await fetchData();
    } catch (error) {
      addToast(getApiErrorMessage(error, 'Action failed'), 'error');
    }
  };

  const handleVerification = async (issueId, action) => {
    try {
      await api.patch(`/complaints/${issueId}/department-review`, {
        action,
        comments: reviewNotes[issueId] || ''
      });
      addToast(action === 'approve' ? 'Issue verified.' : 'Issue sent back for rework.', 'success');
      setReviewNotes((current) => ({
        ...current,
        [issueId]: ''
      }));
      await fetchData();
    } catch (error) {
      addToast(getApiErrorMessage(error, 'Verification action failed'), 'error');
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
                  <div key={issue._id} className="assignment-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0 }}>{issue.title}</h3>
                      <span className="priority-badge" style={{
                        backgroundColor: issue.priority === 'high' ? '#fee2e2' : issue.priority === 'medium' ? '#ffedd5' : '#dcfce7',
                        color: issue.priority === 'high' ? '#dc2626' : issue.priority === 'medium' ? '#ea580c' : '#16a34a',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {issue.priority || 'medium'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{issue.description}</p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {issue.location?.address || 'No location'}</span>
                      <span><strong>Category:</strong> {issue.category || 'Other'}</span>
                      <span><strong>Status:</strong> {issue.status.replace(/_/g, ' ')}</span>
                    </div>
                    {issue.image && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <img src={resolveApiAssetUrl(issue.image)} alt="Issue" style={{ height: '100px', width: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                      </div>
                    )}
                    <button className="btn btn-primary" onClick={() => setSelectedIssue(issue)} style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
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
                        <span className={`status-badge ${normalizeStatus(issue.status)}`}>Waiting For Head</span>
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
        <div className="modal-overlay" style={{ overflowY: 'auto', padding: '2rem 0' }}>
          <div className="modal glass fade-in" style={{ width: '90%', maxWidth: '800px', margin: 'auto' }}>
            <h3>Assign: {selectedIssue.title}</h3>
            
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
              <span><strong>Category:</strong> {selectedIssue.category || 'Other'}</span>
              <span><strong>Priority:</strong> {selectedIssue.priority || 'medium'}</span>
              <span><strong>Location:</strong> {selectedIssue.location?.address || 'Unknown'}</span>
              <span><strong>Department:</strong> {selectedIssue.department_id?.name || 'Assigned Department'}</span>
            </div>

            <form onSubmit={handleAssign}>
              <div className="input-group">
                <label>Select Worker</label>
                <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  {[...workers].sort((a, b) => (a.workload || 0) - (b.workload || 0)).map((worker, index, sortedWorkers) => {
                      const recommendedWorker = sortedWorkers.find(w => w.status !== 'offline') || sortedWorkers[0];
                      const isRecommended = worker._id === recommendedWorker?._id;
                      return (
                        <label key={worker._id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', border: isRecommended ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', background: assignment.worker_id === worker._id ? 'rgba(79, 70, 229, 0.1)' : isRecommended ? 'rgba(79, 70, 229, 0.03)' : 'transparent' }}>
                          <input 
                            type="radio" 
                            name="worker" 
                            value={worker._id} 
                            checked={assignment.worker_id === worker._id}
                            onChange={(e) => setAssignment({ ...assignment, worker_id: e.target.value })}
                            required
                            style={{ margin: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {worker.name}
                                {isRecommended && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>★ Recommended</span>}
                              </strong>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: worker.status === 'offline' ? '#e2e8f0' : worker.workload > 2 ? '#ffedd5' : '#dcfce7', color: worker.status === 'offline' ? '#64748b' : worker.workload > 2 ? '#ea580c' : '#16a34a' }}>
                            {worker.status === 'offline' ? 'Offline' : worker.workload > 2 ? 'Busy' : 'Available'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                          <span>Workload: {worker.workload || 0} active</span>
                          <span>Completed: {worker.completedTasks || 0}</span>
                          <span>Rating: {worker.rating || '4.5'} ⭐</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
                {workers.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No workers found in this department.</p>}
              </div>
              </div>
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label>Select Volunteer (Optional)</label>
                <select
                  value={assignment.volunteer_id}
                  onChange={(event) => setAssignment({ ...assignment, volunteer_id: event.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                >
                  <option value="">Select Volunteer...</option>
                  {volunteers.map((volunteer) => (
                    <option key={volunteer._id} value={volunteer._id}>{volunteer.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label>Instructions</label>
                <textarea
                  value={assignment.comments}
                  onChange={(event) => setAssignment({ ...assignment, comments: event.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', minHeight: '80px' }}
                  placeholder="Detailed instructions for the worker..."
                />
              </div>

              {assignment.worker_id && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Assignment Summary</h4>
                  <p style={{ fontSize: '0.9rem', margin: '0.25rem 0' }}><strong>Worker:</strong> {workers.find(w => w._id === assignment.worker_id)?.name}</p>
                  <p style={{ fontSize: '0.9rem', margin: '0.25rem 0' }}><strong>Volunteer:</strong> {assignment.volunteer_id ? volunteers.find(v => v._id === assignment.volunteer_id)?.name : 'None'}</p>
                  <p style={{ fontSize: '0.9rem', margin: '0.25rem 0' }}><strong>Est. Completion:</strong> {selectedIssue.priority === 'high' ? '24 Hours' : selectedIssue.priority === 'medium' ? '72 Hours' : '1 Week'}</p>
                </div>
              )}

              <div className="btn-row" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => { setSelectedIssue(null); setAssignment({ worker_id: '', volunteer_id: '', comments: '' }); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!assignment.worker_id}>Confirm Assignment</button>
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
