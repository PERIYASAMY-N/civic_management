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

  const fetchTasks = async () => {
    try {
      const res = await api.get('/complaints/my-tasks');
      setTasks(res.data);
    } catch {
      console.error('Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, status, data = {}) => {
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

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: '2rem' }}>Assigned Tasks</h2>
      {tasks.length === 0 ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="tasks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {tasks.map(task => (
            <div key={task._id} className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span className={`status-badge ${task.status}`}>{task.status}</span>
                <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
              </div>
              <h3>{task.title}</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}><MapPin size={14} /> {task.location.address}</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {task.status === 'pending' && (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleUpdateStatus(task._id, 'in_progress')}>Start Task</button>
                )}
                {task.status === 'in_progress' && (
                  <button className="btn btn-success" style={{ flex: 1, backgroundColor: 'var(--success)', color: 'white' }} onClick={() => setCompletingTask(task)}>Submit Proof</button>
                )}
                <Link to={`/dashboard/complaint/${task._id}`} className="btn" style={{ flex: 1, textAlign: 'center' }}>Details</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {completingTask && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Complete Task: {completingTask.title}</h3>
            <div className="input-group" style={{ marginTop: '1.5rem' }}>
              <label>Resolution Summary</label>
              <textarea 
                placeholder="Describe what was done..." 
                onChange={(e) => setProof({...proof, comments: e.target.value})}
                style={{ width: '100%', minHeight: '100px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', color: 'var(--text-main)' }}
              />
            </div>
            <div className="input-group">
              <label>Proof Image URL (After)</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="https://..." 
                  onChange={(e) => setProof({...proof, after_image: e.target.value})}
                />
                <button className="btn"><Camera size={18} /></button>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button className="btn" onClick={() => setCompletingTask(null)} style={{ flex: 1 }}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => handleUpdateStatus(completingTask._id, 'completed', proof)}
              >
                Submit & Close
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
