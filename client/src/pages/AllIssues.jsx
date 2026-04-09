import { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, X, Building2, User, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { hasRole } from '../utils/userAccess';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const AllIssues = ({ user }) => {
  const [view, setView] = useState('list'); // 'list' or 'map'
  const [issues, setIssues] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchIssues();
    if (hasRole(user?.role, 'admin')) {
      fetchDepartments();
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
      fetchIssues();
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
    <div className="fade-in" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
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
            issues.map(issue => (
              <div 
                key={issue._id} 
                className={`issue-item glass ${selectedIssue?._id === issue._id ? 'selected' : ''}`} 
                onClick={() => isAdmin ? setSelectedIssue(issue) : null}
                style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              >
                {!isAdmin && <Link to={`/dashboard/complaint/${issue._id}`} className="issue-link-overlay" />}
                <div className="status-indicator" data-status={issue.status}></div>
                <div className="issue-main">
                  <div className="issue-top">
                    <h3>{issue.title}</h3>
                    <span className={`priority-tag ${issue.priority}`}>{issue.priority}</span>
                  </div>
                  <div className="issue-meta">
                    <span>{issue.department_id?.name || 'Unassigned'}</span> • <span>{issue.location.address}</span> • <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="issue-status">
                  <span className={`status-badge ${issue.status}`}>{issue.status.replace(/_/g, ' ')}</span>
                  <ChevronRight size={18} />
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="glass map-view fade-in" style={{ height: '600px', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
          <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {issues.filter(i => i.location?.lat).map(issue => (
              <Marker 
                key={issue._id} 
                position={[issue.location.lat, issue.location.lng]} 
                eventHandlers={{ click: () => isAdmin ? setSelectedIssue(issue) : null }}
              >
                <Popup>
                  <div style={{ padding: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{issue.title}</h4>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.8rem' }}>{issue.status.replace(/_/g, ' ')}</p>
                    {isAdmin ? (
                       <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }} onClick={() => setSelectedIssue(issue)}>Manage Allocation</button>
                    ) : (
                      <Link to={`/dashboard/complaint/${issue._id}`} className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>View Details</Link>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Side Panel for Admin */}
      {isAdmin && selectedIssue && (
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
                  <span className={`status-badge ${selectedIssue.status}`}>{selectedIssue.status.replace(/_/g, ' ')}</span>
               </div>
            </div>
            <div className="detail-section">
               <label>Location</label>
               <p style={{ fontSize: '0.9rem' }}><MapPin size={14} /> {selectedIssue.location.address}</p>
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
                    {departments.map(dept => (
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
                {selectedIssue.department_id && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={14} /> Currently managed by: {selectedIssue.department_id.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .issue-link-overlay { position: absolute; inset: 0; z-index: 1; }
        .issue-content { height: 100%; display: flex; flex-direction: column; }
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
        
        .issue-item { display: flex; align-items: center; padding: 1.5rem 2rem; margin-bottom: 1rem; border-radius: var(--radius); transition: all 0.2s; position: relative; overflow: hidden; border: 1px solid transparent; }
        .issue-item:hover { transform: translateX(5px); box-shadow: var(--shadow-hover); border-color: var(--border); }
        
        .status-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .status-indicator[data-status="pending"] { background: #dc2626; }
        .status-indicator[data-status="assigned_to_dept"] { background: #f59e0b; }
        .status-indicator[data-status="assigned_to_worker"] { background: #d97706; }
        .status-indicator[data-status="in_progress"] { background: #1089b9; }
        .status-indicator[data-status="completed"] { background: #16a34a; }

        .issue-main { flex: 1; padding: 0 1.5rem; }
        .issue-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.25rem; }
        .issue-meta { font-size: 0.875rem; color: var(--text-muted); }
        
        .priority-tag { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; }
        .priority-tag.high { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .priority-tag.medium { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .issue-status { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); }
        .status-badge { padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
        .status-badge.pending { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .status-badge.assigned_to_dept { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .status-badge.assigned_to_worker { background: rgba(217, 119, 6, 0.1); color: #b45309; }
        .status-badge.in_progress { background: rgba(16, 137, 185, 0.1); color: #1089b9; }
        .status-badge.completed { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
      `}</style>
    </div>
  );
};

export default AllIssues;
