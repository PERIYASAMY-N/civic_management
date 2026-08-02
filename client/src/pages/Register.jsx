import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../api';
import './Auth.css';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'public',
    department_id: '', volunteer_code: '', employee_id: '', government_id: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Code Verification State
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [verificationError, setVerificationError] = useState('');

  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    
    // Reset verification if code changes
    if (name === 'department_id' || name === 'volunteer_code') {
      setIsCodeVerified(false);
      setVerificationData(null);
      setVerificationError('');
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB');
        return;
      }
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(selectedFile.type)) {
        setError('Only JPG, JPEG, and PNG formats are allowed');
        return;
      }
      setFile(selectedFile);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const nextStep = () => setStep((current) => current + 1);
  const prevStep = () => setStep((current) => current - 1);

  const verifyCode = async () => {
    setVerificationLoading(true);
    setVerificationError('');
    setVerificationData(null);
    setIsCodeVerified(false);

    try {
      if (formData.role === 'head' || formData.role === 'worker') {
        if (!formData.department_id) {
          setVerificationError('Please enter a Department Code.');
          return;
        }
        const res = await api.post('/auth/departments/validate-code', { code: formData.department_id });
        
        // Additional constraints
        if (formData.role === 'head' && res.data.department.hasApprovedHead) {
           setVerificationError(`Department ${res.data.department.name} already has an active Department Head.`);
           return;
        }
        if (formData.role === 'worker' && !res.data.department.hasApprovedHead) {
           setVerificationError(`Department ${res.data.department.name} does not have an approved Department Head yet.`);
           return;
        }

        setVerificationData(res.data.department);
        setIsCodeVerified(true);
      } else if (formData.role === 'volunteer') {
        if (!formData.volunteer_code) {
          setVerificationError('Please enter a Volunteer Code.');
          return;
        }
        const res = await api.post('/auth/volunteers/validate-code', { code: formData.volunteer_code });
        setVerificationData(res.data.codeData);
        setIsCodeVerified(true);
      }
    } catch (err) {
      setVerificationError(err.response?.data?.message || 'Verification failed. Invalid Code.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (['head', 'worker'].includes(formData.role) && !isCodeVerified) {
      setError('Please verify your Department Code before completing registration.');
      setLoading(false);
      return;
    }

    if (formData.role === 'volunteer' && !isCodeVerified) {
      setError('Please verify your Volunteer Code before completing registration.');
      setLoading(false);
      return;
    }

    if (formData.role === 'volunteer' && !file) {
      setError('Please upload ID proof photo');
      setLoading(false);
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });

    if (file) {
      data.append('government_id_proof', file);
    }

    try {
      const res = await api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderCodeVerification = (type) => (
    <div className="input-group verification-group" style={{ marginBottom: '1.5rem' }}>
      <label>{type === 'department' ? 'Department Code *' : 'Volunteer Code *'}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          name={type === 'department' ? 'department_id' : 'volunteer_code'} 
          placeholder={`Enter ${type === 'department' ? 'Department' : 'Volunteer'} Code`} 
          value={type === 'department' ? formData.department_id : formData.volunteer_code}
          onChange={handleChange} 
          disabled={isCodeVerified}
          required 
          style={{ flex: 1 }}
        />
        {!isCodeVerified ? (
          <button type="button" className="btn btn-primary" onClick={verifyCode} disabled={verificationLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem' }}>
            {verificationLoading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
            Verify
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={() => { setIsCodeVerified(false); setVerificationData(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem' }}>
            Change
          </button>
        )}
      </div>

      {verificationError ? (
        <div className="verification-status error fade-in" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#ef4444' }}>
          <XCircle size={20} />
          <span style={{ fontSize: '0.9rem' }}>{verificationError}</span>
        </div>
      ) : null}

      {isCodeVerified && verificationData ? (
        <div className="verification-status success fade-in" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#16a34a' }}>
          <CheckCircle size={20} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
              {type === 'department' ? 'Department Found' : 'Code Verified'}
            </strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
              {type === 'department' 
                ? verificationData.name 
                : (verificationData.department ? `Assigned to: ${verificationData.department.name}` : 'General Volunteer Pool')}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="auth-split-layout">
      <motion.div 
        className="auth-image-panel"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-image-content">
          <h1>Civic<span>Hub</span></h1>
          <p>Join thousands of citizens and officials working together to build better, safer, and smarter communities.</p>
        </div>
      </motion.div>
      <motion.div 
        className="auth-form-panel"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="auth-card glass" style={{ maxWidth: '550px' }}>
          <h2>Join CivicHub</h2>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <div className="fade-in">
              <h3>Step 1: Account Info</h3>
              <input name="name" placeholder="Full Name" onChange={handleChange} required />
              <input name="email" type="email" placeholder="Email Address" onChange={handleChange} required />
              <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
              <button type="button" className="btn btn-primary" onClick={nextStep}>Next</button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="fade-in">
              <h3>Step 2: Choose Role</h3>
              <select name="role" onChange={handleChange} value={formData.role}>
                <option value="public">Public User</option>
                <option value="head">Department Head</option>
                <option value="worker">Worker</option>
                <option value="volunteer">Volunteer</option>
              </select>
              <div className="btn-group">
                <button type="button" className="btn" onClick={prevStep}>Back</button>
                <button type="button" className="btn btn-primary" onClick={nextStep}>Next</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="fade-in">
              <h3>Step 3: Verification</h3>
              {formData.role === 'head' ? renderCodeVerification('department') : null}

              {formData.role === 'worker' ? (
                <>
                  <div className="input-group">
                    <label>Employee / Service ID</label>
                    <input name="employee_id" placeholder="Enter Employee ID" onChange={handleChange} required />
                  </div>
                  {renderCodeVerification('department')}
                </>
              ) : null}

              {formData.role === 'volunteer' ? (
                <>
                  <div className="input-group">
                    <label>Aadhaar / Voter ID</label>
                    <input name="government_id" placeholder="Enter Government ID" onChange={handleChange} required />
                  </div>
                  {renderCodeVerification('volunteer')}
                </>
              ) : null}

              {formData.role !== 'public' ? (
                <div className="file-upload-container">
                  <p style={{ marginBottom: '10px', fontSize: '0.9rem', fontWeight: '500' }}>
                    Upload Government ID Proof {formData.role === 'volunteer' ? '*' : '(Optional)'}
                  </p>
                  {!preview ? (
                    <div className="file-input-wrapper">
                      <button type="button" className="btn btn-outline" style={{ width: '100%' }}>Choose Image</button>
                      <input type="file" accept="image/*" onChange={handleFileChange} />
                      <p className="hint" style={{ marginTop: '10px' }}>Max 2MB: JPG, JPEG, PNG</p>
                    </div>
                  ) : (
                    <div className="file-info">
                      <img src={preview} alt="ID Preview" className="image-preview" />
                      <p>{file.name}</p>
                      <button type="button" className="remove-file-btn" onClick={removeFile}>Remove / Change</button>
                    </div>
                  )}
                </div>
              ) : null}

              {formData.role === 'public' ? (
                <p>Public users don't need additional verification. You're all set!</p>
              ) : null}

              <div className="btn-group">
                <button type="button" className="btn" onClick={prevStep}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          ) : null}
        </form>
        {error ? <p className="error fade-in">{error}</p> : null}
        <p className="auth-footer">Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </motion.div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Register;

