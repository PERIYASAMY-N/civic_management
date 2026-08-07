import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, X, Image as ImageIcon, MapPin, Filter, Download } from 'lucide-react';
import api, { resolveApiAssetUrl } from '../api';

const normalizeIssueStatus = (status) => String(status || 'NEW').toUpperCase();

const getStatusClassName = (status) => {
  const norm = normalizeIssueStatus(status);
  if (['COMPLETED', 'CLOSED'].includes(norm)) return 'completed';
  if (['NEW', 'ADMIN_APPROVED', 'DEPARTMENT_ASSIGNED', 'ASSIGNED'].includes(norm)) return 'pending';
  return 'in_progress';
};

const getStatusLabel = (status) => {
  const normalizedStatus = normalizeIssueStatus(status);
  const labels = {
    NEW: 'Pending',
    ADMIN_APPROVED: 'Pending',
    DEPARTMENT_ASSIGNED: 'Assigned',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    WAITING_DEPARTMENT_APPROVAL: 'In Progress',
    WAITING_ADMIN_APPROVAL: 'In Progress',
    REWORK_REQUIRED: 'In Progress',
    COMPLETED: 'Completed',
    CLOSED: 'Completed'
  };
  return labels[normalizedStatus] || 'Pending';
};

const getImageSrc = (issue) => (issue?.image ? resolveApiAssetUrl(issue.image) : '');

const MyComplaints = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, pending, in_progress, completed
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await api.get('/complaints/my');
      setIssues(res.data.data || []);
    } catch (err) {
      console.error('Error fetching my issues', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (issue.description && issue.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter ? issue.category === categoryFilter : true;
    
    const statusClass = getStatusClassName(issue.status);
    const matchesTab = activeTab === 'all' || statusClass === activeTab;
    
    return matchesSearch && matchesCategory && matchesTab;
  });

  const categories = [...new Set(issues.map(i => i.category || 'Other'))];

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading your complaints...</div>;

  return (
    <div className="fade-in issues-page-shell" style={{ position: 'relative', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div className="feed-header glass" style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ minWidth: '300px' }}>
            <Search size={20} />
            <input 
              placeholder="Search your complaints..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Filter size={18} color="var(--text-muted)" />
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          {['all', 'pending', 'in_progress', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-main)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                textTransform: 'capitalize'
              }}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="issues-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
        {filteredIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>No complaints found matching your criteria.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const imageSrc = getImageSrc(issue);

            return (
              <div key={issue._id} className="issue-item glass" style={{ cursor: 'default' }}>
                <Link to={`/public/user/track?id=${issue._id}`} className="issue-link-overlay" />
                <div className="status-indicator" data-status={getStatusClassName(issue.status)}></div>

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
                    <h3 style={{ fontSize: '1.1rem' }}>{issue.title}</h3>
                    <span className={`priority-tag ${issue.priority}`}>{issue.priority}</span>
                  </div>
                  <p className="issue-description" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{issue.description || 'No description provided.'}</p>
                  <div className="issue-meta" style={{ fontSize: '0.8rem', display: 'flex', gap: '1rem', color: 'var(--text-muted)' }}>
                    <span>{issue.category || 'Other'}</span>
                    <span>{issue.department_id?.name || 'Unassigned'}</span>
                    <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="issue-status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span className={`status-badge ${getStatusClassName(issue.status)}`}>{getStatusLabel(issue.status)}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', position: 'relative', zIndex: 10 }}>
                    <Link to={`/public/user/track?id=${issue._id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                      Track
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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

      <style>{`
        .issue-link-overlay { position: absolute; inset: 0; z-index: 1; }
        
        .issue-item {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr) auto;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
          margin-bottom: 1rem;
          border-radius: var(--radius);
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }

        .issue-item:hover { transform: translateX(5px); box-shadow: var(--shadow-hover); border-color: var(--border); }

        .issue-thumbnail-wrap { position: relative; z-index: 2; }
        .issue-image-button { border: none; background: transparent; padding: 0; cursor: zoom-in; width: 96px; height: 96px; }
        .issue-thumbnail, .issue-thumbnail-placeholder { width: 96px; height: 96px; border-radius: 18px; object-fit: cover; border: 1px solid var(--border); background: var(--bg-main); }
        .issue-thumbnail-placeholder { display: grid; place-items: center; color: var(--text-muted); text-align: center; padding: 0.5rem; font-size: 0.78rem; }

        .status-indicator { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .status-indicator[data-status="pending"] { background: #facc15; }
        .status-indicator[data-status="in_progress"] { background: #0ea5e9; }
        .status-indicator[data-status="completed"] { background: #16a34a; }

        .issue-main { min-width: 0; }
        .issue-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
        
        .priority-tag { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; }
        .priority-tag.high { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .priority-tag.medium { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .priority-tag.low { background: rgba(16, 185, 129, 0.1); color: #10b981; }

        .status-badge { padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; }
        .status-badge.pending { background: rgba(250, 204, 21, 0.18); color: #a16207; }
        .status-badge.in_progress { background: rgba(14, 165, 233, 0.14); color: #0369a1; }
        .status-badge.completed { background: rgba(22, 163, 74, 0.1); color: #16a34a; }

        .image-preview-modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
        .image-preview-card { width: min(760px, 100%); max-height: 88vh; padding: 1rem; border-radius: 24px; display: grid; gap: 1rem; }
        .image-preview-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--text-main); }
        .image-preview-full { width: 100%; max-height: calc(88vh - 80px); object-fit: contain; border-radius: 18px; background: #0f172a; }
      `}</style>
    </div>
  );
};

export default MyComplaints;
