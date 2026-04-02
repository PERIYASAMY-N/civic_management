import { useState, useEffect } from 'react';
import api from '../api';
import { Users, Building, CheckCircle, XCircle, Plus, Shield } from 'lucide-react';

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', department_id: '', head_id: '' });

  const fetchPendingUsers = async () => {
    try {
      const res = await api.get('/admin/users/pending');
      setPendingUsers(res.data);
    } catch {
      console.error('Error fetching users');
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

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchPendingUsers();
    fetchDepartments();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleUserAction = async (id, action) => {
    try {
      await api.post(`/admin/users/${action}/${id}`);
      alert(`User ${action}ed successfully`);
      fetchPendingUsers();
    } catch {
      alert('Action failed');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/departments', newDept);
      alert('Department created');
      fetchDepartments();
      setShowDeptModal(false);
    } catch {
      alert('Creation failed');
    }
  };

  return (
    <div className="fade-in">
      <div className="admin-header glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Administration Console</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage system users, roles, and departments</p>
        </div>
        <div className="tab-menu glass" style={{ display: 'flex', gap: '1rem', padding: '0.5rem' }}>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Users
          </button>
          <button className={`btn ${activeTab === 'depts' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('depts')}>
            <Building size={18} /> Departments
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="glass" style={{ padding: '2rem' }}>
          <h3>Pending Approvals</h3>
          <div className="users-table" style={{ marginTop: '1.5rem' }}>
            {pendingUsers.length === 0 ? <p>No pending users at this time.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Name</th>
                    <th style={{ padding: '1rem' }}>Role</th>
                    <th style={{ padding: '1rem' }}>ID Info</th>
                    <th style={{ padding: '1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => (
                    <tr key={user._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{user.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
                      </td>
                      <td style={{ padding: '1rem' }}><span className="role-badge">{user.role}</span></td>
                      <td style={{ padding: '1rem' }}>
                        {user.role === 'head' && `Dept ID: ${user.department_id}`}
                        {user.role === 'worker' && `Emp ID: ${user.employee_id}`}
                        {user.role === 'volunteer' && `Gov ID: ${user.government_id}`}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-success" style={{ padding: '0.4rem' }} onClick={() => handleUserAction(user._id, 'approve')}>
                            <CheckCircle size={18} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleUserAction(user._id, 'reject')}>
                            <XCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3>Departments</h3>
            <button className="btn btn-primary" onClick={() => setShowDeptModal(true)}><Plus size={18} /> Add Dept</button>
          </div>
          <div className="depts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {departments.map(dept => (
              <div key={dept._id} className="glass" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                <Shield size={32} color="var(--primary)" />
                <h4 style={{ marginTop: '1rem' }}>{dept.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {dept.department_id}</p>
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.9rem' }}>
                   Head: {dept.head_id?.name || 'Unassigned'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal glass fade-in">
            <h3>Create New Department</h3>
            <form onSubmit={handleCreateDept} style={{ marginTop: '1.5rem' }}>
              <div className="input-group">
                <label>Department Name</label>
                <input type="text" onChange={e => setNewDept({...newDept, name: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Department Code/ID</label>
                <input type="text" onChange={e => setNewDept({...newDept, department_id: e.target.value})} required />
              </div>
              <div className="btn-group" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn" onClick={() => setShowDeptModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .role-badge { text-transform: uppercase; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; background: var(--bg-main); border-radius: 4px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { width: 100%; max-width: 450px; padding: 2.5rem; border-radius: 20px; }
        .input-group { margin-bottom: 1rem; }
        .input-group label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; }
        .input-group input { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-main); color: var(--text-main); }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
