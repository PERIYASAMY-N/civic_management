import { useEffect, useState } from 'react';
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
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setDepartmentsLoading(true);
        const response = await api.get('/departments/active');
        setDepartments(Array.isArray(response.data) ? response.data : []);
      } catch (fetchError) {
        console.error('Failed to load active departments', fetchError);
      } finally {
        setDepartmentsLoading(false);
      }
    };

    void fetchDepartments();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (['head', 'worker'].includes(formData.role) && !formData.department_id) {
      setError('Please select an active department');
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
              {formData.role === 'head' ? (
                <div className="input-group">
                  <label>Department</label>
                  <select name="department_id" value={formData.department_id} onChange={handleChange} required>
                    <option value="">Select an active department</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department.department_id}>
                        {department.name} ({department.department_id}) - {department.activeUsers} users
                      </option>
                    ))}
                  </select>
                  <p className="hint">
                    {departmentsLoading ? 'Loading active departments...' : 'Only departments with registered users are shown.'}
                  </p>
                </div>
              ) : null}

              {formData.role === 'worker' ? (
                <div className="input-group">
                  <label>Service Credentials</label>
                  <input name="employee_id" placeholder="Employee / Service ID" onChange={handleChange} required />
                  <select name="department_id" value={formData.department_id} onChange={handleChange} required>
                    <option value="">Select an active department</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department.department_id}>
                        {department.name} ({department.department_id}) - {department.activeUsers} users
                      </option>
                    ))}
                  </select>
                  <p className="hint">
                    {departmentsLoading ? 'Loading active departments...' : 'Only active departments are available for staff registration.'}
                  </p>
                </div>
              ) : null}

              {formData.role === 'volunteer' ? (
                <input name="government_id" placeholder="Aadhaar / Voter ID" onChange={handleChange} required />
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
                <button type="submit" className="btn btn-primary" disabled={loading || departmentsLoading}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          ) : null}
        </form>
        {error ? <p className="error">{error}</p> : null}
        <p className="auth-footer">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
};

export default Register;
