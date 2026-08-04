import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapPin, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../api';

const TrackComplaint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [complaintId, setComplaintId] = useState(searchParams.get('id') || '');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(!!searchParams.get('id'));
  const [error, setError] = useState('');

  const fetchComplaint = async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/complaints/${id}`);
      setComplaint(res.data);
    } catch (err) {
      setError('Complaint not found or you do not have permission to view it.');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('id')) {
      fetchComplaint(searchParams.get('id'));
    }
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (complaintId.trim()) {
      navigate(`/public/user/track?id=${complaintId.trim()}`);
    }
  };

  const timelineSteps = [
    { key: 'pending', label: 'Complaint Submitted', icon: AlertCircle },
    { key: 'assigned_to_dept', label: 'Department Assigned', icon: Clock },
    { key: 'assigned_to_worker', label: 'Worker Assigned', icon: Clock },
    { key: 'in_progress', label: 'Work Started', icon: Clock },
    { key: 'waiting_for_head', label: 'After Work Uploaded', icon: Clock },
    { key: 'verified', label: 'Department Verified', icon: CheckCircle },
    { key: 'completed', label: 'Completed', icon: CheckCircle }
  ];

  const getTimelineHistory = () => {
    if (!complaint || !complaint.timeline) return [];
    // Map timeline items to steps
    return complaint.timeline.map((event, index) => {
      const step = timelineSteps.find(s => s.key === event.status) || { label: event.status.replace(/_/g, ' '), icon: Clock };
      return {
        ...event,
        label: step.label,
        icon: step.icon,
        isLast: index === complaint.timeline.length - 1
      };
    });
  };

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin className="text-primary" /> Track Complaint
        </h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
            <input 
              type="text" 
              placeholder="Enter Complaint ID" 
              value={complaintId}
              onChange={(e) => setComplaintId(e.target.value)}
              style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!complaintId.trim()}>
            Track
          </button>
        </form>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading tracking details...</div>}
      
      {error && (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', borderRadius: 'var(--radius)' }}>
          {error}
        </div>
      )}

      {complaint && !loading && (
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{complaint.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <strong>ID:</strong> {complaint._id} <br/>
              <strong>Category:</strong> {complaint.category || 'Other'} <br/>
              <strong>Department:</strong> {complaint.department_id?.name || 'Unassigned'}
            </p>
          </div>

          <div className="tracking-timeline">
            {getTimelineHistory().map((event, index) => {
              const Icon = event.icon;
              const date = new Date(event.timestamp || event.updatedAt || new Date()); // use whatever time field exists
              
              return (
                <div key={index} className="timeline-item" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                  {!event.isLast && <div className="timeline-line" style={{ position: 'absolute', left: '15px', top: '35px', bottom: '-15px', width: '2px', background: 'var(--primary)', opacity: 0.3 }}></div>}
                  
                  <div className="timeline-icon" style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 1
                  }}>
                    <Icon size={16} />
                  </div>
                  
                  <div className="timeline-content" style={{ flex: 1, paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{event.label}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {event.comments}
                    </p>
                    {event.updated_by && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        By: {event.updated_by.name} ({event.updated_by.role?.replace(/_/g, ' ')})
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackComplaint;
