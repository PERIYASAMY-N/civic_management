import { useState } from 'react';
import { User, Shield, Bell, Moon } from 'lucide-react';

const Settings = ({ user }) => {
  const [twoFA, setTwoFA] = useState(false);

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: '2rem' }}>Account Settings</h2>
      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', paddingBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '80px', height: '80px', background: 'var(--primary)', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white', fontWeight: 700 }}>
              {user.name.charAt(0)}
            </div>
            <h3 style={{ marginTop: '1rem' }}>{user.name}</h3>
            <span className="role-badge">{user.role}</span>
          </div>
          
          <div className="settings-nav" style={{ marginTop: '2rem' }}>
            <button className="settings-item active"><User size={18} /> Profile</button>
            <button className="settings-item"><Shield size={18} /> Security</button>
            <button className="settings-item"><Bell size={18} /> Notifications</button>
            <button className="settings-item"><Moon size={18} /> Appearance</button>
          </div>
        </div>

        <div className="glass" style={{ padding: '2rem' }}>
          <h3>Security & Verification</h3>
          <div className="security-section" style={{ marginTop: '2rem' }}>
            <div className="option-row glass" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4>Two-Factor Authentication</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Secure your account with an extra layer of security</p>
              </div>
              <input type="checkbox" checked={twoFA} onChange={() => setTwoFA(!twoFA)} style={{ width: '20px', height: '20px' }} />
            </div>
            
            <div className="option-row glass" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4>Identity Verification</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: <span style={{ color: 'var(--success)', fontWeight: 700 }}>VERIFIED</span></p>
              </div>
              <Shield size={24} color="var(--success)" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-item { width: 100%; display: flex; gap: 1rem; align-items: center; padding: 1rem; background: transparent; border-radius: 8px; text-align: left; }
        .settings-item.active { background: rgba(79, 70, 229, 0.1); color: var(--primary); }
        .option-row { border: 1px solid var(--border); }
      `}</style>
    </div>
  );
};

export default Settings;
