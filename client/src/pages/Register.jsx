import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import './Auth.css';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'public',
    department_id: '', employee_id: '', government_id: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
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

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation for Volunteer
    if (formData.role === 'volunteer' && !file) {
      setError('Please upload ID proof photo');
      setLoading(false);
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach(key => {
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

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <h2>Join Civic Project</h2>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="fade-in">
              <h3>Step 1: Account Info</h3>
              <input name="name" placeholder="Full Name" onChange={handleChange} required />
              <input name="email" type="email" placeholder="Email Address" onChange={handleChange} required />
              <input name="password" type="password" placeholder="Password" onChange={handleChange} required />
              <button type="button" className="btn btn-primary" onClick={nextStep}>Next</button>
            </div>
          )}

          {step === 2 && (
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
          )}

          {step === 3 && (
            <div className="fade-in">
              <h3>Step 3: Verification</h3>
              {formData.role === 'head' && (
                <div className="input-group">
                  <label>Department Code</label>
                  <input name="department_id" placeholder="e.g., WATE-0411 or PW-202" onChange={handleChange} required />
                  <p className="hint">Ask your system admin for your department's code.</p>
                </div>
              )}
              {formData.role === 'worker' && (
                <div className="input-group">
                  <label>Service Credentials</label>
                  <input name="employee_id" placeholder="Employee / Service ID" onChange={handleChange} required />
                  <input name="department_id" placeholder="Department Code (e.g., PW-202)" onChange={handleChange} required />
                </div>
              )}
              {formData.role === 'volunteer' && (
                <input name="government_id" placeholder="Aadhaar / Voter ID" onChange={handleChange} required />
              )}
              
              {/* Common File Upload for Head, Worker, Volunteer (Mandatory for Volunteer) */}
              {formData.role !== 'public' && (
                <div className="file-upload-container">
                  <p style={{marginBottom: '10px', fontSize: '0.9rem', fontWeight: '500'}}>
                    Upload Government ID Proof {formData.role === 'volunteer' ? '*' : '(Optional)'}
                  </p>
                  {!preview ? (
                    <div className="file-input-wrapper">
                      <button type="button" className="btn btn-outline" style={{width: '100%'}}>Choose Image</button>
                      <input type="file" accept="image/*" onChange={handleFileChange} />
                      <p className="hint" style={{marginTop: '10px'}}>Max 2MB: JPG, JPEG, PNG</p>
                    </div>
                  ) : (
                    <div className="file-info">
                      <img src={preview} alt="ID Preview" className="image-preview" />
                      <p>{file.name}</p>
                      <button type="button" className="remove-file-btn" onClick={removeFile}>Remove / Change</button>
                    </div>
                  )}
                </div>
              )}

              {formData.role === 'public' && (
                <p>Public users don't need additional verification. You're all set!</p>
              )}
              
              <div className="btn-group">
                <button type="button" className="btn" onClick={prevStep}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          )}
        </form>
        {error && <p className="error">{error}</p>}
        <p className="auth-footer">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
};

export default Register;
