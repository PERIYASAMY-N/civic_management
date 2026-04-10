import { useState, useEffect } from 'react';
import api from '../api';
import { useParams } from 'react-router-dom';
import { MapPin, User, Calendar } from 'lucide-react';
import { resolveApiAssetUrl } from '../api';

const getIssueAddress = (issue) => (
  issue?.address
  || issue?.location?.address
  || (Number.isFinite(issue?.lat) && Number.isFinite(issue?.lng)
    ? `Lat ${issue.lat.toFixed(5)}, Lng ${issue.lng.toFixed(5)}`
    : 'Location unavailable')
);

const getStatusLabel = (status) => {
  const labels = {
    assigned_to_dept: 'Assigned To Department',
    assigned_to_worker: 'Assigned To Worker',
    in_progress: 'In Progress',
    waiting_for_verification: 'Waiting For Verification',
    verified: 'Verified',
    rework_required: 'Rework Required',
    completed: 'Closed'
  };

  return labels[status] || String(status || 'pending').replace(/_/g, ' ');
};

const getProofImage = (issue, stage) => (
  stage === 'before'
    ? issue?.beforeImage || issue?.work_proof?.before_image || ''
    : issue?.afterImage || issue?.work_proof?.after_image || ''
);

const ComplaintDetails = () => {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssue = async () => {
      try {
        const res = await api.get(`/complaints/${id}`);
        setIssue(res.data);
      } catch (err) {
        console.error('Error fetching issue details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIssue();
  }, [id]);

  if (loading) return <div>Loading issue details...</div>;
  if (!issue) return <div>Issue not found.</div>;

  return (
    <div className="fade-in detail-view">
      <div className="detail-header glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className={`status-badge ${issue.status}`}>{getStatusLabel(issue.status)}</span>
            <h2 style={{ fontSize: '2.5rem', margin: '1rem 0' }}>{issue.title}</h2>
            <div className="meta-row">
              <span className="meta-item"><MapPin size={18} /> {getIssueAddress(issue)}</span>
              <span className="meta-item"><Calendar size={18} /> {new Date(issue.createdAt || issue.created_at).toLocaleDateString()}</span>
              <span className="meta-item"><User size={18} /> Reported by {issue.created_by.name}</span>
            </div>
          </div>
          <div className={`priority-indicator ${issue.priority}`}>
            {issue.priority} Priority
          </div>
        </div>
      </div>

      <div className="detail-content" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div className="main-info">
          <div className="glass section" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3>Description</h3>
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>{issue.description}</p>
          </div>

          <div className="glass section" style={{ padding: '2rem' }}>
            <h3>Resolution Timeline</h3>
            <div className="timeline" style={{ marginTop: '2rem' }}>
              {issue.timeline.map((event, i) => (
                <div key={i} className="timeline-event">
                  <div className="marker"></div>
                  <div className="event-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="event-status">{getStatusLabel(event.status)}</span>
                      <span className="event-time">{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <p>{event.comments}</p>
                    <span className="event-author">By: {event.updated_by?.name || 'System'} ({event.updated_by?.role || 'Admin'})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-info">
          <div className="glass section" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3>Reported Issue Photo</h3>
            {issue.image ? (
              <div style={{ marginTop: '1rem' }}>
                <img src={resolveApiAssetUrl(issue.image)} alt="Reported issue" style={{ width: '100%', borderRadius: '12px' }} />
                <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span><MapPin size={14} /> {issue.image_context?.address || getIssueAddress(issue)}</span>
                  <span><Calendar size={14} /> {issue.image_context?.captured_at ? new Date(issue.image_context.captured_at).toLocaleString() : new Date(issue.createdAt || issue.created_at).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div style={{ height: '150px', background: 'var(--bg-main)', borderRadius: '12px', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', marginTop: '0.5rem' }}>
                No citizen photo submitted.
              </div>
            )}
          </div>

          <div className="glass section" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3>Proof of Work</h3>
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Before</h4>
              {getProofImage(issue, 'before') ? (
                <img src={resolveApiAssetUrl(getProofImage(issue, 'before'))} alt="Before" style={{ width: '100%', borderRadius: '12px', marginTop: '0.5rem' }} />
              ) : (
                <div style={{ height: '150px', background: 'var(--bg-main)', borderRadius: '12px', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', marginTop: '0.5rem' }}>
                  No before image submitted.
                </div>
              )}
              
              <h4 style={{ marginTop: '2rem' }}>After</h4>
              {getProofImage(issue, 'after') ? (
                <img src={resolveApiAssetUrl(getProofImage(issue, 'after'))} alt="After" style={{ width: '100%', borderRadius: '12px', marginTop: '0.5rem' }} />
              ) : (
                <div style={{ height: '150px', background: 'var(--bg-main)', borderRadius: '12px', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', marginTop: '0.5rem' }}>
                  Awaiting completion...
                </div>
              )}
            </div>
          </div>

          <div className="glass section" style={{ padding: '2rem' }}>
            <h3>Verification</h3>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <p><strong style={{ color: 'var(--text-main)' }}>Review Status:</strong> {getStatusLabel(issue.status)}</p>
              <p><strong style={{ color: 'var(--text-main)' }}>Department Head Decision:</strong> {issue.verification?.status || 'pending'}</p>
              <p><strong style={{ color: 'var(--text-main)' }}>Notes:</strong> {issue.verification?.comments || 'No verification notes yet.'}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .detail-header { padding: 3rem; border-radius: var(--radius); }
        .meta-row { display: flex; gap: 2rem; color: var(--text-muted); }
        .meta-item { display: flex; align-items: center; gap: 0.5rem; }
        .priority-indicator { padding: 0.5rem 1.5rem; border-radius: 99px; font-weight: 700; text-transform: uppercase; }
        .priority-indicator.high { background: var(--danger); color: white; }
        
        .timeline { position: relative; padding-left: 2rem; }
        .timeline::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--border); }
        .timeline-event { position: relative; margin-bottom: 2rem; }
        .marker { position: absolute; left: -2.4rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--primary); border: 3px solid white; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
        .event-info { background: var(--bg-main); padding: 1.25rem; border-radius: 12px; }
        .event-status { font-weight: 700; text-transform: uppercase; font-size: 0.75rem; color: var(--primary); }
        .event-time { font-size: 0.75rem; color: var(--text-muted); }
        .event-author { font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
};

export default ComplaintDetails;
