import { useEffect, useMemo, useState } from 'react';
import { Bell, ImagePlus, Loader, Lock, Mail, Phone, Save, Shield, User } from 'lucide-react';
import api from '../api';
import { normalizeUser } from '../utils/userAccess';
import { resolveApiAssetUrl } from '../api';

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const Settings = ({ user, setUser }) => {
  const [profile, setProfile] = useState(user);
  const [activitySummary, setActivitySummary] = useState([]);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    issueUpdates: true,
    assignmentAlerts: true,
    completionAlerts: true
  });
  const [previewUrl, setPreviewUrl] = useState(user?.profile_image ? resolveApiAssetUrl(user.profile_image) : '');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get('/user/profile');
        const nextUser = normalizeUser(response.data.user);
        setProfile(nextUser);
        setActivitySummary(response.data.activitySummary || []);
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
        setFormData({
          name: nextUser.name || '',
          email: nextUser.email || '',
          phone: nextUser.phone || '',
          oldPassword: '',
          newPassword: '',
          confirmPassword: '',
          issueUpdates: nextUser.notification_preferences?.issue_updates !== false,
          assignmentAlerts: nextUser.notification_preferences?.assignment_alerts !== false,
          completionAlerts: nextUser.notification_preferences?.completion_alerts !== false
        });
        setPreviewUrl(nextUser.profile_image ? resolveApiAssetUrl(nextUser.profile_image) : '');
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || 'Unable to load your profile right now.');
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, []);

  const departmentLabel = useMemo(() => {
    if (!profile?.department_id) {
      return 'Not assigned';
    }

    if (typeof profile.department_id === 'object') {
      return `${profile.department_id.name} (${profile.department_id.department_id})`;
    }

    return String(profile.department_id);
  }, [profile]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Only JPG, JPEG, and PNG profile images are allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Profile image must be under 2MB.');
      return;
    }

    setError('');
    setProfileImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    if (formData.phone && !PHONE_REGEX.test(formData.phone)) {
      setError('Please enter a valid phone number.');
      setSaving(false);
      return;
    }

    if ((formData.oldPassword || formData.newPassword || formData.confirmPassword) && !PASSWORD_STRENGTH_REGEX.test(formData.newPassword)) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, and a number.');
      setSaving(false);
      return;
    }

    const payload = new FormData();
    payload.append('name', formData.name);
    payload.append('email', formData.email);
    payload.append('phone', formData.phone);
    payload.append('oldPassword', formData.oldPassword);
    payload.append('newPassword', formData.newPassword);
    payload.append('confirmPassword', formData.confirmPassword);
    payload.append('issueUpdates', String(formData.issueUpdates));
    payload.append('assignmentAlerts', String(formData.assignmentAlerts));
    payload.append('completionAlerts', String(formData.completionAlerts));

    if (profileImageFile) {
      payload.append('profileImage', profileImageFile);
    }

    try {
      const response = await api.post('/user/update-profile', payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const updatedUser = normalizeUser(response.data.user);
      setProfile(updatedUser);
      setActivitySummary(response.data.activitySummary || []);
      setFormData((current) => ({
        ...current,
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setProfileImageFile(null);
      setPreviewUrl(updatedUser.profile_image ? resolveApiAssetUrl(updatedUser.profile_image) : '');
      setMessage(response.data.message || 'Profile updated successfully.');
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-in profile-loading">
        <Loader className="spin" size={22} />
        <span>Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="fade-in profile-settings-page">
      <div className="profile-page-header">
        <div>
          <h2>Profile Settings</h2>
          <p>Update personal details, security preferences, and how you receive civic alerts.</p>
        </div>
      </div>

      {message ? <div className="profile-banner success">{message}</div> : null}
      {error ? <div className="profile-banner error">{error}</div> : null}

      <div className="profile-shell">
        <aside className="glass profile-summary-card">
          <div className="profile-hero">
            <div className="profile-image-frame">
              {previewUrl ? (
                <img src={previewUrl} alt={`${profile?.name || 'User'} profile`} className="profile-image-preview" />
              ) : (
                <span>{profile?.name?.[0] || 'U'}</span>
              )}
            </div>
            <div>
              <h3>{profile?.name}</h3>
              <p>{profile?.email}</p>
              <span className="role-badge">{profile?.role}</span>
            </div>
          </div>

          <div className="profile-summary-list">
            <div>
              <span>Department</span>
              <strong>{departmentLabel}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{profile?.phone || 'Not added'}</strong>
            </div>
          </div>

          <div className="activity-summary-grid">
            {activitySummary.map((item) => (
              <div key={item.label} className="activity-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <form className="profile-form-stack" onSubmit={handleSubmit}>
          <section className="glass settings-section-card">
            <div className="section-title">
              <div className="section-icon"><User size={18} /></div>
              <div>
                <h3>Personal Info</h3>
                <p>Keep your public account identity and contact details current.</p>
              </div>
            </div>

            <div className="profile-grid">
              <div className="input-group">
                <label>Name</label>
                <input name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Email</label>
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                </div>
              </div>
              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-with-icon">
                  <Phone size={16} />
                  <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+91xxxxxxxxxx" />
                </div>
              </div>
              <div className="input-group">
                <label>Department</label>
                <input value={departmentLabel} readOnly disabled />
              </div>
            </div>

            <div className="profile-image-uploader">
              <div>
                <label>Profile Image</label>
                <p>Upload a JPG or PNG image and preview it before saving.</p>
              </div>
              <label className="upload-button">
                <ImagePlus size={18} />
                Choose Image
                <input type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handleImageSelection} hidden />
              </label>
            </div>
          </section>

          <section className="glass settings-section-card">
            <div className="section-title">
              <div className="section-icon"><Shield size={18} /></div>
              <div>
                <h3>Security</h3>
                <p>Change your password with confirmation and strength validation.</p>
              </div>
            </div>

            <div className="profile-grid">
              <div className="input-group">
                <label>Current Password</label>
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input type="password" name="oldPassword" value={formData.oldPassword} onChange={handleChange} />
                </div>
              </div>
              <div className="input-group">
                <label>New Password</label>
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} />
                </div>
              </div>
              <div className="input-group">
                <label>Confirm Password</label>
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} />
                </div>
              </div>
            </div>
          </section>

          <section className="glass settings-section-card">
            <div className="section-title">
              <div className="section-icon"><Bell size={18} /></div>
              <div>
                <h3>Preferences</h3>
                <p>Choose which civic updates should reach you.</p>
              </div>
            </div>

            <div className="preference-list">
              <label className="preference-row">
                <span>Issue Updates</span>
                <input type="checkbox" name="issueUpdates" checked={formData.issueUpdates} onChange={handleChange} />
              </label>
              <label className="preference-row">
                <span>Assignment Alerts</span>
                <input type="checkbox" name="assignmentAlerts" checked={formData.assignmentAlerts} onChange={handleChange} />
              </label>
              <label className="preference-row">
                <span>Completion Alerts</span>
                <input type="checkbox" name="completionAlerts" checked={formData.completionAlerts} onChange={handleChange} />
              </label>
            </div>
          </section>

          <button type="submit" className="btn btn-primary profile-save-button" disabled={saving}>
            {saving ? <Loader className="spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      <style>{`
        .profile-settings-page {
          display: grid;
          gap: 1.5rem;
        }

        .profile-page-header p {
          color: var(--text-muted);
          margin-top: 0.4rem;
        }

        .profile-banner {
          padding: 1rem 1.25rem;
          border-radius: 16px;
          font-weight: 500;
        }

        .profile-banner.success {
          background: rgba(22, 163, 74, 0.12);
          color: #166534;
          border: 1px solid rgba(22, 163, 74, 0.2);
        }

        .profile-banner.error {
          background: rgba(239, 68, 68, 0.12);
          color: #b91c1c;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .profile-shell {
          display: grid;
          grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.4fr);
          gap: 1.5rem;
        }

        .profile-summary-card,
        .settings-section-card {
          padding: 1.5rem;
          border-radius: 24px;
        }

        .profile-form-stack {
          display: grid;
          gap: 1.25rem;
        }

        .profile-hero {
          display: flex;
          gap: 1rem;
          align-items: center;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .profile-image-frame {
          width: 84px;
          height: 84px;
          border-radius: 24px;
          overflow: hidden;
          background: var(--primary);
          color: white;
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
        }

        .profile-image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-summary-list,
        .activity-summary-grid,
        .profile-grid,
        .preference-list {
          display: grid;
          gap: 1rem;
        }

        .profile-summary-list {
          margin-top: 1.5rem;
        }

        .profile-summary-list span,
        .activity-card span {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .profile-summary-list strong,
        .activity-card strong {
          display: block;
          margin-top: 0.2rem;
        }

        .activity-summary-grid {
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          margin-top: 1.5rem;
        }

        .activity-card {
          padding: 1rem;
          border-radius: 18px;
          background: var(--bg-main);
          border: 1px solid var(--border);
        }

        .section-title {
          display: flex;
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .section-title p {
          color: var(--text-muted);
          margin-top: 0.3rem;
        }

        .section-icon {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(79, 70, 229, 0.1);
          color: var(--primary);
          flex-shrink: 0;
        }

        .profile-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .input-with-icon {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 1rem;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--bg-main);
        }

        .input-with-icon input {
          border: none;
          box-shadow: none;
          background: transparent;
          padding-left: 0;
        }

        .profile-image-uploader {
          margin-top: 1.25rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 1rem 1.1rem;
          border-radius: 18px;
          background: var(--bg-main);
          border: 1px dashed var(--border);
        }

        .profile-image-uploader p {
          color: var(--text-muted);
          margin-top: 0.25rem;
        }

        .upload-button {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          background: var(--primary);
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .preference-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.1rem;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--bg-main);
        }

        .profile-save-button {
          justify-self: start;
        }

        .profile-loading {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
        }

        @media (max-width: 960px) {
          .profile-shell,
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .profile-image-uploader,
          .profile-hero {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Settings;
