import { useState, useEffect } from 'react';
import api from '../api';
import { CheckSquare, Clock, MapPin, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

const WorkerTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState(null);
  const [proof, setProof] = useState({ comments: '', after_image: '' });

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStartWork = async (taskId) => {
    try {
      await api.post(`/complaints/start-work/${taskId}`);
      alert('Work started successfully');
      fetchTasks();
    } catch {
      alert('Failed to start work');
    }
  };

  const handleUpdateStatus = async (taskId, status, data = {}) => {
    if (status === 'completed' && (!data.comments || data.comments.trim() === '')) {
      alert('Comments are mandatory for completion proof');
      return;
    }
    try {
      await api.post(`/complaints/update-status/${taskId}`, {
        status,
        ...data
      });
      alert(`Status updated to ${status}`);
      fetchTasks();
      setCompletingTask(null);
    } catch {
      alert('Update failed');
    }
  };

  if (loading) return <div>Loading tasks...</div>;

  const getStatusBadge = (status) => {
    const labels = {
      'assigned_to_worker': 'New Assignment',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'assigned_to_dept': 'Dept Assigned'
    };
    return <span className={`status-badge ${status}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: '2rem' }}>My Assigned Tasks</h2>
      {tasks.length === 0 ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="tasks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {tasks.map(task => (
            <div key={task._id} className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                {getStatusBadge(task.status)}
                <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>{task.title}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}><MapPin size={14} /> {task.location.address}</p>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {task.status === 'assigned_to_worker' && (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleStartWork(task._id)}>Start Work</button>
                )}
                {task.status === 'in_progress' && (
                  <button className="btn btn-success" style={{ flex: 1, backgroundColor: 'var(--success)', color: 'white' }} onClick={() => setCompletingTask(task)}>Submit Proof</button>
                )}
                {task.status === 'completed' && (
                  <button className="btn" style={{ flex: 1 }} disabled>Resolved</button>
                )}
                <Link to={`/dashboard/complaint/${task._id}`} className="btn" style={{ flex: 1, textAlign: 'center', border: '1px solid var(--border)' }}>Details</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {completingTask && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Complete Task</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{completingTask.title}</p>
            
            <div className="input-group">
              <label>Resolution Summary <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea 
                placeholder="Submit your completion report here..." 
                onChange={(e) => setProof({...proof, comments: e.target.value})}
                style={{ width: '100%', minHeight: '120px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', color: 'var(--text-main)', fontSize: '0.95rem' }}
              />
            </div>
            <div className="input-group">
              <label>After Image URL (Optional)</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="https://image-hosting.com/proof.jpg" 
                  onChange={(e) => setProof({...proof, after_image: e.target.value})}
                />
                <button className="btn btn-outline" title="Upload Image"><Camera size={18} /></button>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setCompletingTask(null)} style={{ flex: 1 }}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => handleUpdateStatus(completingTask._id, 'completed', proof)}
              >
                Submit Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { width: 100%; max-width: 500px; padding: 2rem; border-radius: 20px; }
        .input-group { margin-bottom: 1.5rem; }
        .input-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
        .input-group input { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-main); color: var(--text-main); }
      `}</style>
    </div>
  );
};

export default WorkerTasks;
