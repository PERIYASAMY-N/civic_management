import { useEffect, useState } from 'react';
import api, { resolveApiAssetUrl } from '../api';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, X, Building2, MapPin, Image as ImageIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { hasRole } from '../utils/userAccess';

const getIssueAddress = (issue) => (
  issue?.address
  || issue?.location?.address
  || (Number.isFinite(issue?.lat) && Number.isFinite(issue?.lng)
    ? `Lat ${issue.lat.toFixed(5)}, Lng ${issue.lng.toFixed(5)}`
    : 'Location unavailable')
);

const getIssueCoordinates = (issue) => {
  const lat = Number.isFinite(issue?.lat) ? issue.lat : issue?.location?.lat;
  const lng = Number.isFinite(issue?.lng) ? issue.lng : issue?.location?.lng;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return [lat, lng];
};

const getMarkerStatusTone = (status) => {
  if (status === 'completed') return 'completed';
  if (['verified', 'waiting_for_head', 'waiting_for_verification'].includes(status)) return 'review';
  if (['in_progress', 'assigned_to_dept', 'assigned_to_worker', 'rework_required'].includes(status)) return 'in-progress';
  return 'pending';
};

const markerIconCache = new Map();

const getMarkerIcon = (status) => {
  const tone = getMarkerStatusTone(status);

  if (!markerIconCache.has(tone)) {
    markerIconCache.set(
      tone,
      L.divIcon({
        className: 'issue-marker-shell',
        html: `<span class="issue-marker-dot ${tone}"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14]
      })
    );
  }

  return markerIconCache.get(tone);
};

const getStatusLabel = (status) => {
  const labels = {
    assigned_to_dept: 'Assigned To Department',
    assigned_to_worker: 'Assigned To Worker',
    in_progress: 'In Progress',
    waiting_for_head: 'Waiting For Head',
    waiting_for_verification: 'Waiting For Verification',
    verified: 'Verified',
    rework_required: 'Rework Required',
    completed: 'Closed'
  };

  return labels[status] || String(status || 'pending').replace(/_/g, ' ');
};

const getImageSrc = (issue) => (issue?.image ? resolveApiAssetUrl(issue.image) : '');

const AllIssues = ({ user }) => {
  const [view, setView] = useState('list');
  const [issues, setIssues] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    void fetchIssues();
    if (hasRole(user?.role, 'admin')) {
      void fetchDepartments();
    }
  }, [user]);

  const fetchIssues = async () => {
    try {
      const res = await api.get('/complaints');
      setIssues(res.data);
    } catch (err) {
      console.error('Error fetching issues', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/admin/departments');
      setDepartments(res.data);
    } catch {
      console.error('Error fetching departments');
    }
  };

  const handleAssign = async (issueId, deptId) => {
    if (!deptId) return alert('Please select a department');
    setAssigning(true);
    try {
      await api.post(`/complaints/assign-dept/${issueId}`, { department_id: deptId });
      alert('Issue assigned to department');
      await fetchIssues();
      setSelectedIssue(null);
    } catch {
      alert('Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading issues...</div>;

  const isAdmin = hasRole(user?.role, 'admin');

  return (
    <div className="fade-in issues-page-shell" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
      <div className="feed-header glass">
        <div className="search-bar">
          <Search size={20} />
          <input placeholder="Search complaints..." />
        </div>
        <div className="view-toggle">
          <button className={`btn ${view === 'list' ? 'btn-primary' : ''}`} onClick={() => setView('list')}>List</button>
          <button className={`btn ${view === 'map' ? 'btn-primary' : ''}`} onClick={() => setView('map')}>Map</button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="issues-list" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          {issues.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No issues found.</p>
          ) : (
            issues.map((issue) => {
              const imageSrc = getImageSrc(issue);

              return (
                <div
                  key={issue._id}
                  className={`issue-item glass ${selectedIssue?._id === issue._id ? 'selected' : ''}`}
                  onClick={() => (isAdmin ? setSelectedIssue(issue) : null)}
                  style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  {!isAdmin ? <Link to={`/issues/${issue._id}`} className="issue-link-overlay" /> : null}
                  <div className="status-indicator" data-status={issue.status}></div>

                  <div className="issue-thumbnail-wrap">
                    {imageSrc ? (
                      <button
                        type="button"
                        className="issue-image-button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPreviewImage({ src: imageSrc, title: issue.title });
                        }}
                      >
                        <img src={imageSrc} alt={issue.title} className="issue-thumbnail" />
                      </button>
                    ) : (
                      <div className="issue-thumbnail-placeholder">
                        <ImageIcon size={22} />
                        <span>No image</span>
                      </div>
                    )}
                  </div>

                  <div className="issue-main">
                    <div className="issue-top">
                      <h3>{issue.title}</h3>
                      <span className={`priority-tag ${issue.priority}`}>{issue.priority}</span>
                    </div>
                    <p className="issue-description">{issue.description || 'No description provided.'}</p>
                    <div className="issue-meta">
                      <span>{issue.department_id?.name || 'Unassigned'}</span> • <span>{getIssueAddress(issue)}</span> • <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="issue-status">
                    <span className={`status-badge ${issue.status}`}>{getStatusLabel(issue.status)}</span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="glass map-view fade-in map-wrapper">
          <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {issues
              .map((issue) => ({ issue, coordinates: getIssueCoordinates(issue) }))
              .filter((entry) => entry.coordinates)
              .map(({ issue, coordinates }) => (
                <Marker
                  key={issue._id}
                  position={coordinates}
                  icon={getMarkerIcon(issue.status)}
                  eventHandlers={{ click: () => (isAdmin ? setSelectedIssue(issue) : null) }}
                >
                  <Popup>
                    <div className="map-popup-card">
                      {getImageSrc(issue) ? (
                        <img src={getImageSrc(issue)} alt={issue.title} className="map-popup-image" />
                      ) : (
                        <div className="map-popup-placeholder">
                          <ImageIcon size={18} />
                          <span>No image</span>
                        </div>
                      )}
                      <h4>{issue.title}</h4>
                      <span className={`status-badge ${issue.status}`}>{getStatusLabel(issue.status)}</span>
                      <p className="map-popup-address">{getIssueAddress(issue)}</p>
                      {isAdmin ? (
                        <button className="btn btn-primary map-popup-action" onClick={() => setSelectedIssue(issue)}>
                          Manage Allocation
                        </button>
                      ) : (
                        <Link to={`/issues/${issue._id}`} className="btn btn-primary map-popup-action">
                          View Details
                        </Link>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          <div className="map-legend glass">
            <strong>Legend</strong>
            <span><i className="legend-dot pending"></i> Pending</span>
            <span><i className="legend-dot in-progress"></i> In Progress</span>
            <span><i className="legend-dot review"></i> Under Review</span>
            <span><i className="legend-dot completed"></i> Completed</span>
          </div>
        </div>
      )}

      {previewImage ? (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-card glass" onClick={(event) => event.stopPropagation()}>
            <div className="image-preview-header">
              <strong>{previewImage.title}</strong>
              <button type="button" className="close-btn" onClick={() => setPreviewImage(null)}>
                <X size={20} />
              </button>
            </div>
            <img src={previewImage.src} alt={previewImage.title} className="image-preview-full" />
          </div>
        </div>
      ) : null}

      {isAdmin && selectedIssue ? (
        <div className="side-panel glass fade-in">
          <div className="panel-header">
            <h3>Issue Review</h3>
            <button className="close-btn" onClick={() => setSelectedIssue(null)}><X size={20} /></button>
          </div>
          <div className="panel-content">
            <div className="detail-section">
              <label>Title</label>
              <p style={{ fontWeight: 600 }}>{selectedIssue.title}</p>
            </div>
            <div className="detail-section">
              <label>Description</label>
              <p>{selectedIssue.description || 'No description provided.'}</p>
            </div>
            <div className="detail-section" style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label>Priority</label>
                <span className={`priority-tag ${selectedIssue.priority}`}>{selectedIssue.priority}</span>
              </div>
              <div style={{ flex: 1 }}>
                <label>Current Status</label>
                <span className={`status-badge ${selectedIssue.status}`}>{getStatusLabel(selectedIssue.status)}</span>
              </div>
            </div>
            <div className="detail-section">
              <label>Location</label>
              <p style={{ fontSize: '0.9rem' }}><MapPin size={14} /> {getIssueAddress(selectedIssue)}</p>
            </div>

            <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            <div className="assignment-section">
              <h4 style={{ marginBottom: '1rem' }}>Department Allocation</h4>
              <div className="input-group">
                <label>Select Target Department</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <select
                    className="glass"
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    defaultValue={selectedIssue.department_id?._id || ''}
                    id="deptSelect"
                  >
                    <option value="" disabled>Choose Department...</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={assigning}
                    onClick={() => handleAssign(selectedIssue._id, document.getElementById('deptSelect').value)}
                  >
                    {assigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
                {selectedIssue.department_id ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={14} /> Currently managed by: {selectedIssue.department_id.name}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .issue-link-overlay { position: absolute; inset: 0; z-index: 1; }
        .issue-item.selected { border-color: var(--primary); background: rgba(79, 70, 229, 0.05); }

        .side-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 450px;
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          z-index: 1001;
          box-shadow: -10px 0 30px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border);
        }

        .panel-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
        .panel-content { padding: 2rem; overflow-y: auto; flex: 1; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--text-main); }
        .detail-section { margin-bottom: 2rem; }
        .detail-section label { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem; }

        .feed-header { display: flex; gap: 1.5rem; padding: 1rem 1.5rem; margin-bottom: 2rem; border-radius: var(--radius); }
        .search-bar { flex: 1; display: flex; align-items: center; gap: 1rem; padding: 0 1rem; background: var(--bg-main); border-radius: var(--radius); }
        .search-bar input { border: none; box-shadow: none; background: transparent; padding: 0.75rem 0; width: 100%; color: var(--text-main); }

        .issue-item {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr) auto;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1rem;
          border-radius: var(--radius);
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }

        .issue-item:hover { transform: translateX(5px); box-shadow: var(--shadow-hover); border-color: var(--border); }

        .issue-thumbnail-wrap {
          position: relative;
          z-index: 2;
        }

        .issue-image-button {
          border: none;
          background: transparent;
          padding: 0;
          cursor: zoom-in;
          width: 96px;
          height: 96px;
        }

        .issue-thumbnail,
        .issue-thumbnail-placeholder {
          width: 96px;
          height: 96px;
          border-radius: 18px;
          object-fit: cover;
          border: 1px solid var(--border);
          background: var(--bg-main);
        }

        .issue-thumbnail-placeholder {
          display: grid;
          place-items: center;
          color: var(--text-muted);
          text-align: center;
          padding: 0.5rem;
          font-size: 0.78rem;
        }

        .status-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .status-indicator[data-status="pending"] { background: #dc2626; }
        .status-indicator[data-status="assigned_to_dept"] { background: #facc15; }
        .status-indicator[data-status="assigned_to_worker"] { background: #facc15; }
        .status-indicator[data-status="in_progress"] { background: #facc15; }
        .status-indicator[data-status="waiting_for_head"] { background: #0ea5e9; }
        .status-indicator[data-status="waiting_for_verification"] { background: #0ea5e9; }
        .status-indicator[data-status="verified"] { background: #10b981; }
        .status-indicator[data-status="rework_required"] { background: #fb7185; }
        .status-indicator[data-status="completed"] { background: #16a34a; }

        .issue-main { min-width: 0; }
        .issue-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
        .issue-description {
          color: var(--text-main);
          margin-bottom: 0.45rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .issue-meta { font-size: 0.875rem; color: var(--text-muted); }

        .priority-tag { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; }
        .priority-tag.high { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .priority-tag.medium { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

        .issue-status { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); }
        .status-badge { padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
        .status-badge.pending { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .status-badge.assigned_to_dept { background: rgba(250, 204, 21, 0.18); color: #a16207; }
        .status-badge.assigned_to_worker { background: rgba(250, 204, 21, 0.18); color: #a16207; }
        .status-badge.in_progress { background: rgba(250, 204, 21, 0.18); color: #a16207; }
        .status-badge.waiting_for_head { background: rgba(14, 165, 233, 0.14); color: #0369a1; }
        .status-badge.waiting_for_verification { background: rgba(14, 165, 233, 0.14); color: #0369a1; }
        .status-badge.verified { background: rgba(16, 185, 129, 0.14); color: #047857; }
        .status-badge.rework_required { background: rgba(244, 63, 94, 0.12); color: #be123c; }
        .status-badge.completed { background: rgba(22, 163, 74, 0.1); color: #16a34a; }

        .map-wrapper {
          height: 600px;
          overflow: hidden;
          border-radius: var(--radius);
          position: relative;
        }

        .map-legend {
          position: absolute;
          right: 1rem;
          bottom: 1rem;
          z-index: 500;
          padding: 0.9rem 1rem;
          border-radius: 16px;
          display: grid;
          gap: 0.45rem;
          min-width: 180px;
        }

        .map-legend span {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          color: var(--text-main);
          font-size: 0.9rem;
        }

        .legend-dot,
        .issue-marker-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: inline-block;
          border: 3px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
        }

        .legend-dot.pending,
        .issue-marker-dot.pending {
          background: #dc2626;
        }

        .legend-dot.in-progress,
        .issue-marker-dot.in-progress {
          background: #facc15;
        }

        .legend-dot.review,
        .issue-marker-dot.review {
          background: #0ea5e9;
        }

        .legend-dot.completed,
        .issue-marker-dot.completed {
          background: #16a34a;
        }

        .issue-marker-shell {
          background: transparent;
          border: none;
        }

        .map-popup-card {
          width: 190px;
          display: grid;
          gap: 0.6rem;
        }

        .map-popup-card h4 {
          margin: 0;
        }

        .map-popup-image,
        .map-popup-placeholder {
          width: 100%;
          height: 92px;
          border-radius: 14px;
          object-fit: cover;
          border: 1px solid var(--border);
          background: var(--bg-main);
        }

        .map-popup-placeholder {
          display: grid;
          place-items: center;
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .map-popup-address {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .map-popup-action {
          justify-content: center;
          text-align: center;
        }

        .image-preview-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .image-preview-card {
          width: min(760px, 100%);
          max-height: 88vh;
          padding: 1rem;
          border-radius: 24px;
          display: grid;
          gap: 1rem;
        }

        .image-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .image-preview-full {
          width: 100%;
          max-height: calc(88vh - 80px);
          object-fit: contain;
          border-radius: 18px;
          background: #0f172a;
        }

        @media (max-width: 900px) {
          .issue-item {
            grid-template-columns: 96px 1fr;
          }

          .issue-status {
            grid-column: 2;
            justify-content: flex-start;
          }
        }

        @media (max-width: 720px) {
          .feed-header,
          .issue-item {
            grid-template-columns: 1fr;
          }

          .feed-header {
            display: grid;
          }

          .issue-thumbnail-wrap,
          .issue-status {
            justify-self: start;
          }

          .map-legend {
            left: 1rem;
            right: 1rem;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default AllIssues;
