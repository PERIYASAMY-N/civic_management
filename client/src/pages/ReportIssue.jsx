import { useState } from 'react';
import api from '../api';
import { Camera, MapPin, Send, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReportIssue = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'Garbage'
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const categories = ['Road Damage', 'Garbage', 'Water Leakage', 'Street Light', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Simulation of location and image for demonstration
      const reportData = {
        ...formData,
        location: { lat: 12.9716, lng: 77.5946, address: 'Indiranagar, Bengaluru' },
        image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1'
      };

      await api.post('/complaints', reportData);
      alert('Issue reported successfully! Transparency feed updated.');
      navigate('/dashboard/all-issues');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to report issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px' }}>
      <div className="glass" style={{ padding: '3rem', borderRadius: 'var(--radius)' }}>
        <h2 style={{ marginBottom: '2rem' }}>Report New Issue</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Issue Title</label>
            <input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Large pothole on Main St" 
              required
            />
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea 
              rows="4" 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the issue in detail..."
              required
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
            ></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div className="input-group">
              <label>Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Priority</label>
              <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="upload-box glass">
              <Camera />
              <span>Photo Attached (Auto)</span>
            </div>
            <div className="upload-box glass">
              <MapPin />
              <span>Location Detected</span>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? <Loader className="spin" size={20} /> : <><Send size={18} /> Submit Report</>}
          </button>
        </form>
      </div>

      <style>{`
        .upload-box {
          height: 120px;
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .upload-box:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(79, 70, 229, 0.05);
        }
      `}</style>
    </div>
  );
};

export default ReportIssue;
