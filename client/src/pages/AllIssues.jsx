import { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const AllIssues = () => {
  const [view, setView] = useState('list'); // 'list' or 'map'
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await api.get('/complaints');
        setIssues(res.data);
      } catch (err) {
        console.error('Error fetching transparency feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, []);

  if (loading) return <div style={{ padding: '2rem' }}>Loading transparency feed...</div>;

  return (
    <div className="fade-in">
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
        <div className="issues-list">
          {issues.map(issue => (
            <Link to={`/dashboard/complaint/${issue._id}`} key={issue._id} className="issue-item glass">
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
                <span className={`status-badge ${issue.status}`}>{issue.status.replace('_', ' ')}</span>
                <ChevronRight />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass map-view fade-in" style={{ height: '600px', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
          <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {issues.filter(i => i.location?.lat).map(issue => (
              <Marker key={issue._id} position={[issue.location.lat, issue.location.lng]}>
                <Popup>
                  <div style={{ padding: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{issue.title}</h4>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.8rem' }}>{issue.status}</p>
                    <Link to={`/dashboard/complaint/${issue._id}`} className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>View Details</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <style>{`
        .feed-header {
          display: flex;
          gap: 1.5rem;
          padding: 1rem 1.5rem;
          margin-bottom: 2rem;
          border-radius: var(--radius);
        }
        .search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 1rem;
          background: var(--bg-main);
          border-radius: var(--radius);
        }
        .search-bar input { border: none; box-shadow: none; background: transparent; padding: 0.75rem 0; }
        
        .issue-item {
          display: flex;
          align-items: center;
          padding: 1.5rem 2rem;
          margin-bottom: 1rem;
          border-radius: var(--radius);
          transition: all 0.2s;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .issue-item:hover { transform: translateX(5px); box-shadow: var(--shadow-hover); }
        
        .status-indicator {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 6px;
        }
        .status-indicator[data-status="pending"] { background: var(--danger); }
        .status-indicator[data-status="in_progress"] { background: var(--warning); }
        .status-indicator[data-status="completed"] { background: var(--success); }

        .issue-main { flex: 1; padding: 0 1.5rem; }
        .issue-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.25rem; }
        .issue-meta { font-size: 0.875rem; color: var(--text-muted); }
        
        .priority-tag {
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: 700;
          padding: 0.1rem 0.5rem;
          border-radius: 4px;
        }
        .priority-tag.high { background: rgba(244, 63, 94, 0.1); color: var(--danger); }
        .priority-tag.medium { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        
        .issue-status { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); }
        .status-badge {
          padding: 0.4rem 1rem;
          border-radius: 99px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
        }
        .status-badge.pending { background: rgba(244, 63, 94, 0.1); color: var(--danger); }
        .status-badge.in_progress { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .status-badge.completed { background: rgba(16, 185, 129, 0.1); color: var(--success); }
      `}</style>
    </div>
  );
};

export default AllIssues;
