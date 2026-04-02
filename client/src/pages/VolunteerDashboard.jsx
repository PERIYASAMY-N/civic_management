import { useState, useEffect } from 'react';
import api from '../api';
import { Trophy, CheckCircle, MapPin } from 'lucide-react';

const VolunteerDashboard = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, lbRes] = await Promise.all([
          api.get('/complaints/my-tasks'),
          api.get('/complaints/leaderboard')
        ]);
        setTasks(tasksRes.data);
        setLeaderboard(lbRes.data);
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '2rem' }}>Loading volunteer dashboard...</div>;

  return (
    <div className="fade-in">
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <h3>Assigned Tasks</h3>
          <div className="tasks-list" style={{ marginTop: '1.5rem' }}>
            {tasks.length === 0 ? <p>No tasks currently assigned.</p> : tasks.map(task => (
              <div key={task._id} className="task-card glass" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ color: 'var(--primary)' }}>{task.title}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><MapPin size={14} /> {task.location.address}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontWeight: 700, color: 'var(--success)' }}>+10 Pts</span>
                  <Link to={`/dashboard/complaint/${task._id}`} className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', marginTop: '0.5rem', display: 'inline-block' }}>Details</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Trophy size={48} color="var(--warning)" style={{ margin: '0 auto' }} />
            <h3 style={{ marginTop: '1rem' }}>Rankings</h3>
            <p style={{ color: 'var(--text-muted)' }}>Top Contributors</p>
          </div>
          
          <h3>Leaderboard</h3>
          <div style={{ marginTop: '1rem' }}>
            {leaderboard.length === 0 ? <p>No data yet.</p> : leaderboard.map((entry, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{i + 1}. {entry.name} {entry._id === user.id && '(You)'}</span>
                <strong>{entry.points} pts</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;
