import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Loader,
  MapPin,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Upload
} from 'lucide-react';
import api, { API_BASE_URL, resolveApiAssetUrl } from '../api';
import { useNotification } from '../context/NotificationContext';
import {
  formatAddressForDisplay,
  getLocationAddress,
  getProofLocation,
  reverseGeocodeAddress
} from '../utils/location';
import { formatAccuracyMeters } from '../utils/geolocation';

const GPS_ACCURACY_LIMIT_METERS = 200;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const STATUS_COPY = {
  PENDING: {
    badge: 'PENDING',
    tone: 'pending',
    title: 'Before Work Verification',
    text: 'Capture live work-start proof with GPS verification'
  },
  IN_PROGRESS: {
    badge: 'IN_PROGRESS',
    tone: 'progress',
    title: 'After Work Submission',
    text: 'Upload completed civic work proof'
  },
  WAITING_FOR_APPROVAL: {
    badge: 'WAITING',
    tone: 'waiting',
    title: 'Waiting for Department Verification',
    text: 'Department Head is reviewing your completed civic work.'
  },
  COMPLETED: {
    badge: 'COMPLETED',
    tone: 'completed',
    title: 'Task Completed Successfully',
    text: 'The civic task is verified and closed.'
  }
};

const createDraft = () => ({
  beforeImageFile: null,
  beforePreview: '',
  beforeLocation: null,
  beforeLocationLoading: false,
  beforeLocationError: '',
  beforeSubmitting: false,
  afterImageFile: null,
  afterPreview: '',
  afterLocation: null,
  afterLocationLoading: false,
  afterLocationError: '',
  billImageFile: null,
  billPreview: '',
  description: '',
  afterSubmitting: false,
  formError: ''
});

const revokePreview = (value) => {
  if (value?.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Time unavailable';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

const validateImageFile = (file) => {
  if (!file) {
    return 'Please select an image file.';
  }

  if (!String(file.type || '').startsWith('image/')) {
    return 'Only image files are allowed.';
  }

  if (!SUPPORTED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Only JPG, JPEG, PNG, and WEBP images are allowed.';
  }

  return '';
};

const getTaskStage = (task) => {
  const status = String(task?.status || '').toLowerCase();

  if (status === 'in_progress') {
    return 'IN_PROGRESS';
  }

  if (['waiting_for_head', 'waiting_for_verification', 'verified'].includes(status)) {
    return 'WAITING_FOR_APPROVAL';
  }

  if (status === 'completed') {
    return 'COMPLETED';
  }

  return 'PENDING';
};

const hasAccurateLocation = (location) => {
  const accuracy = Number(location?.accuracy);
  return (
    Number.isFinite(Number(location?.lat))
    && Number.isFinite(Number(location?.lng))
    && String(location?.address || '').trim().length > 0
    && Number.isFinite(accuracy)
    && accuracy <= GPS_ACCURACY_LIMIT_METERS
  );
};

const getAssignedBy = (task) => {
  const timeline = Array.isArray(task?.timeline) ? [...task.timeline] : [];
  const assignment = timeline
    .reverse()
    .find((entry) => String(entry?.status || '').toLowerCase() === 'assigned_to_worker');

  return assignment?.updated_by?.name || task?.created_by?.name || 'Department Head';
};

const getStoredImage = (task, type) => {
  if (type === 'before') {
    return task?.beforeWork?.image || task?.beforeImage || task?.work_proof?.before_image || '';
  }

  if (type === 'after') {
    return task?.afterWork?.image || task?.afterImage || task?.work_proof?.after_image || '';
  }

  return task?.afterWork?.billImage || task?.billImage || task?.work_proof?.bill_image || '';
};

const getStoredDescription = (task) => (
  task?.afterWork?.description
  || task?.workDescription
  || task?.work_proof?.description
  || 'No description submitted.'
);

const WorkerTasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef({});
  const fileInputRefs = useRef({});
  const locationRequestRef = useRef({});
  const { addToast } = useNotification();
  const addToastRef = useRef(addToast);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => () => {
    Object.values(draftsRef.current).forEach((draft) => {
      revokePreview(draft.beforePreview);
      revokePreview(draft.afterPreview);
      revokePreview(draft.billPreview);
    });
  }, []);

  const fetchTasks = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/complaints/my-tasks', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load worker tasks', error);
      if (error.response?.status === 401) {
        navigate('/login');
        return;
      }
      addToastRef.current?.('Unable to load assigned tasks right now.', 'error');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const getDraft = useCallback((taskId) => drafts[taskId] || createDraft(), [drafts]);

  const updateDraft = useCallback((taskId, updater) => {
    setDrafts((current) => {
      const existing = current[taskId] || createDraft();
      const nextValue = typeof updater === 'function'
        ? updater(existing)
        : { ...existing, ...updater };

      return {
        ...current,
        [taskId]: nextValue
      };
    });
  }, []);

  const clearDraft = useCallback((taskId) => {
    setDrafts((current) => {
      const existing = current[taskId];
      if (!existing) {
        return current;
      }

      revokePreview(existing.beforePreview);
      revokePreview(existing.afterPreview);
      revokePreview(existing.billPreview);

      const nextDrafts = { ...current };
      delete nextDrafts[taskId];
      return nextDrafts;
    });
  }, []);

  const replaceTask = useCallback((nextTask) => {
    if (!nextTask?._id) {
      return;
    }

    setTasks((current) => current.map((task) => (
      task._id === nextTask._id ? nextTask : task
    )));
  }, []);

  const triggerInput = (taskId, field) => {
    fileInputRefs.current[`${taskId}:${field}`]?.click();
  };

  const setPreviewFile = useCallback((taskId, previewKey, fileKey, file) => {
    updateDraft(taskId, (current) => {
      revokePreview(current[previewKey]);
      return {
        ...current,
        [fileKey]: file,
        [previewKey]: URL.createObjectURL(file),
        formError: ''
      };
    });
  }, [updateDraft]);

  const detectLiveLocation = useCallback(async (taskId, field) => {
    const requestKey = `${taskId}:${field}`;
    const requestNumber = (locationRequestRef.current[requestKey] || 0) + 1;
    locationRequestRef.current[requestKey] = requestNumber;

    const loadingKey = `${field}LocationLoading`;
    const errorKey = `${field}LocationError`;
    const locationKey = `${field}Location`;

    updateDraft(taskId, {
      [loadingKey]: true,
      [errorKey]: '',
      [locationKey]: null,
      formError: ''
    });

    const updateIfCurrent = (payload) => {
      if (locationRequestRef.current[requestKey] !== requestNumber) {
        return;
      }

      updateDraft(taskId, payload);
    };

    try {
      if (!navigator.geolocation?.getCurrentPosition) {
        throw new Error('Location is not supported in this browser.');
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Unable to detect GPS coordinates.');
      }

      if (!Number.isFinite(accuracy) || accuracy > GPS_ACCURACY_LIMIT_METERS) {
        throw new Error('Move to open area for accurate GPS');
      }

      const address = String(await reverseGeocodeAddress(lat, lng) || '').trim();
      if (!address) {
        throw new Error('Unable to fetch full live address');
      }

      updateIfCurrent({
        [loadingKey]: false,
        [errorKey]: '',
        [locationKey]: {
          lat,
          lng,
          accuracy,
          address,
          timestamp: new Date(position.timestamp || Date.now()).toISOString()
        }
      });
    } catch (error) {
      const message = error?.code === 1
        ? 'Location permission denied'
        : error instanceof Error
          ? error.message
          : 'Unable to detect live location';

      updateIfCurrent({
        [loadingKey]: false,
        [errorKey]: message,
        [locationKey]: null
      });
      addToastRef.current?.(message, 'error');
    }
  }, [updateDraft]);

  const handleBeforeImage = useCallback(async (taskId, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      updateDraft(taskId, { formError: validationMessage });
      addToastRef.current?.(validationMessage, 'error');
      return;
    }

    setPreviewFile(taskId, 'beforePreview', 'beforeImageFile', file);
    await detectLiveLocation(taskId, 'before');
  }, [detectLiveLocation, setPreviewFile, updateDraft]);

  const handleAfterImage = useCallback(async (taskId, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      updateDraft(taskId, { formError: validationMessage });
      addToastRef.current?.(validationMessage, 'error');
      return;
    }

    setPreviewFile(taskId, 'afterPreview', 'afterImageFile', file);
    await detectLiveLocation(taskId, 'after');
  }, [detectLiveLocation, setPreviewFile, updateDraft]);

  const handleBillImage = useCallback((taskId, file) => {
    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      updateDraft(taskId, { formError: validationMessage });
      addToastRef.current?.(validationMessage, 'error');
      return;
    }

    setPreviewFile(taskId, 'billPreview', 'billImageFile', file);
  }, [setPreviewFile, updateDraft]);

  const submitBeforeWork = async (task) => {
    const draft = getDraft(task._id);
    const locationData = draft.beforeLocation;
    const beforeImage = draft.beforeImageFile;
    const token = localStorage.getItem('token');

    console.log('Submitting Before Work');
    console.log({
      taskId: task?._id,
      beforeImage,
      locationData,
      hasToken: Boolean(token)
    });

    if (!task?._id) {
      const message = 'Task ID missing';
      addToastRef.current?.(message, 'error');
      return;
    }

    if (!draft.beforeImageFile) {
      const message = 'Upload image first';
      updateDraft(task._id, { beforeSubmitting: false, formError: message });
      addToastRef.current?.(message, 'error');
      return;
    }

    if (!Number.isFinite(Number(locationData?.lat)) || !Number.isFinite(Number(locationData?.lng))) {
      const message = 'Location missing';
      updateDraft(task._id, { beforeSubmitting: false, formError: message });
      addToastRef.current?.(message, 'error');
      return;
    }

    if (!String(locationData?.address || '').trim()) {
      const message = 'Address missing';
      updateDraft(task._id, { beforeSubmitting: false, formError: message });
      addToastRef.current?.(message, 'error');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    updateDraft(task._id, { beforeSubmitting: true, formError: '' });

    try {
      const formData = new FormData();
      formData.append('beforeImage', draft.beforeImageFile);
      formData.append('lat', String(locationData.lat));
      formData.append('lng', String(locationData.lng));
      formData.append('accuracy', String(locationData.accuracy ?? ''));
      formData.append('address', locationData.address || '');
      formData.append('submittedAt', locationData.timestamp || new Date().toISOString());
      formData.append('beforeLocation', JSON.stringify(locationData));

      console.log([...formData.entries()]);

      const response = await axios.patch(`${API_BASE_URL}/tasks/${task._id}/before`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(response.data);

      clearDraft(task._id);
      replaceTask(response.data?.task || response.data?.complaint);
      addToastRef.current?.('Before work submitted', 'success');
    } catch (error) {
      console.log('FULL ERROR:', error);
      console.log('ERROR RESPONSE:', error.response?.data);
      if (error.response?.status === 401) {
        navigate('/login');
        return;
      }
      const message = error.response?.data?.message || error.message || 'Submission failed';
      updateDraft(task._id, { beforeSubmitting: false, formError: message });
      addToastRef.current?.(message, 'error');
    }
  };

  const submitAfterWork = async (task) => {
    const draft = getDraft(task._id);

    if (!draft.afterImageFile || !draft.billImageFile || !draft.description.trim() || !hasAccurateLocation(draft.afterLocation)) {
      const message = 'After image, bill copy, description, and accurate GPS location are required.';
      updateDraft(task._id, { formError: message });
      addToastRef.current?.(message, 'error');
      return;
    }

    updateDraft(task._id, { afterSubmitting: true, formError: '' });

    try {
      const formData = new FormData();
      formData.append('afterImage', draft.afterImageFile);
      formData.append('billImage', draft.billImageFile);
      formData.append('description', draft.description.trim());
      formData.append('workDescription', draft.description.trim());
      formData.append('lat', String(draft.afterLocation.lat));
      formData.append('lng', String(draft.afterLocation.lng));
      formData.append('accuracy', String(draft.afterLocation.accuracy));
      formData.append('address', draft.afterLocation.address);
      formData.append('submittedAt', draft.afterLocation.timestamp);
      formData.append('afterLocation', JSON.stringify(draft.afterLocation));
      formData.append('billLocation', JSON.stringify(draft.afterLocation));
      console.log('After work form data', Array.from(formData.entries()));

      const response = await api.patch(`/tasks/${task._id}/after`, formData);

      clearDraft(task._id);
      replaceTask(response.data?.complaint || response.data?.task);
      addToastRef.current?.('Completed work submitted successfully', 'success');
    } catch (error) {
      console.error('After work submit failed', error.response?.data || error);
      const message = error.response?.data?.message || 'Completed work submission failed';
      updateDraft(task._id, { afterSubmitting: false, formError: message });
      addToastRef.current?.(message, 'error');
    }
  };

  const renderLocationCard = (location, loadingState, errorState, retryAction) => {
    if (loadingState) {
      return (
        <div className="worker-location-card info">
          <Loader size={16} className="spin" />
          <span>Detecting accurate GPS location...</span>
        </div>
      );
    }

    if (errorState) {
      return (
        <div className="worker-location-card warning">
          <span>{errorState}</span>
          <button type="button" className="worker-inline-button" onClick={retryAction}>
            Retry
          </button>
        </div>
      );
    }

    if (!location) {
      return (
        <div className="worker-location-card muted">
          <span>Live address will appear after photo upload or capture.</span>
        </div>
      );
    }

    return (
      <div className="worker-location-card success">
        <div className="worker-location-line">
          <MapPin size={16} />
          <p>{formatAddressForDisplay(location.address)}</p>
        </div>
        <div className="worker-location-line small">
          <ShieldCheck size={16} />
          <span>{`GPS Accuracy: ${formatAccuracyMeters(location.accuracy)}`}</span>
        </div>
        <div className="worker-location-line small">
          <Clock3 size={16} />
          <span>{formatDateTime(location.timestamp)}</span>
        </div>
      </div>
    );
  };

  const renderPreviewCard = (label, previewUrl, fileName, locationContent) => (
    <div className="worker-preview-card">
      <span className="worker-section-label">{label}</span>
      {previewUrl ? (
        <img src={previewUrl} alt={label} className="worker-proof-image" />
      ) : (
        <div className="worker-empty-preview">No image selected yet.</div>
      )}
      {fileName ? <p className="worker-file-name">{fileName}</p> : null}
      {locationContent}
    </div>
  );

  const renderStoredPreview = (label, imagePath, location) => (
    <div className="worker-preview-card">
      <span className="worker-section-label">{label}</span>
      {imagePath ? (
        <img src={resolveApiAssetUrl(imagePath)} alt={label} className="worker-proof-image" />
      ) : (
        <div className="worker-empty-preview">Not available.</div>
      )}
      {location?.address ? (
        <div className="worker-location-card success">
          <div className="worker-location-line">
            <MapPin size={16} />
            <p>{formatAddressForDisplay(location.address)}</p>
          </div>
          {Number.isFinite(Number(location?.accuracy)) ? (
            <div className="worker-location-line small">
              <ShieldCheck size={16} />
              <span>{`GPS Accuracy: ${formatAccuracyMeters(location.accuracy)}`}</span>
            </div>
          ) : null}
          {location?.timestamp ? (
            <div className="worker-location-line small">
              <Clock3 size={16} />
              <span>{formatDateTime(location.timestamp)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderMetaCard = (task, stage) => (
    <section className="worker-meta-card">
      <div className="worker-meta-top">
        <div>
          <p className="worker-kicker">Assigned Civic Task</p>
          <h3>{task.title}</h3>
        </div>
        <div className="worker-badges">
          <span className={`worker-status-badge ${STATUS_COPY[stage].tone}`}>{STATUS_COPY[stage].badge}</span>
          <span className={`worker-priority-badge ${String(task.priority || 'medium').toLowerCase()}`}>
            {String(task.priority || 'medium').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="worker-meta-grid">
        <div className="worker-meta-item">
          <span>Department</span>
          <strong>{task?.department_id?.name || 'Not assigned'}</strong>
        </div>
        <div className="worker-meta-item">
          <span>Assigned By</span>
          <strong>{getAssignedBy(task)}</strong>
        </div>
        <div className="worker-meta-item">
          <span>Created Date</span>
          <strong>{formatDateTime(task?.createdAt)}</strong>
        </div>
        <div className="worker-meta-item">
          <span>Status</span>
          <strong>{STATUS_COPY[stage].badge}</strong>
        </div>
      </div>

      <div className="worker-address-card">
        <MapPin size={16} />
        <span>{getLocationAddress(task, 'Address unavailable')}</span>
      </div>

      <div className="worker-meta-footer">
        <p>{STATUS_COPY[stage].text}</p>
        <Link to={`/issues/${task._id}`} className="worker-detail-link">
          Open issue details
        </Link>
      </div>
    </section>
  );

  const renderBeforeSection = (task, draft) => (
    <section className="worker-flow-card">
      <div className="worker-flow-heading">
        <div>
          <p className="worker-kicker">Before Work</p>
          <h4>Before Work Verification</h4>
          <p>Capture live work-start proof with GPS verification</p>
        </div>
      </div>

      <div className="worker-action-row">
        <button type="button" className="worker-primary-button" onClick={() => triggerInput(task._id, 'before-camera')}>
          <Camera size={18} />
          Open Camera
        </button>
        <button type="button" className="worker-secondary-button" onClick={() => triggerInput(task._id, 'before-upload')}>
          <Upload size={18} />
          Upload Photo
        </button>
      </div>

      {renderPreviewCard(
        'Before Work Preview',
        draft.beforePreview,
        draft.beforeImageFile?.name || '',
        renderLocationCard(
          draft.beforeLocation,
          draft.beforeLocationLoading,
          draft.beforeLocationError,
          () => void detectLiveLocation(task._id, 'before')
        )
      )}

      {draft.formError ? <p className="worker-form-error">{draft.formError}</p> : null}

      <button
        type="button"
        className="worker-submit-button"
        disabled={!draft.beforeImageFile || !hasAccurateLocation(draft.beforeLocation) || draft.beforeLocationLoading || draft.beforeSubmitting}
        onClick={() => void submitBeforeWork(task)}
      >
        {draft.beforeSubmitting ? 'Submitting...' : 'Submit Before Work'}
      </button>
    </section>
  );

  const renderAfterSection = (task, draft) => (
    <section className="worker-flow-card">
      <div className="worker-flow-heading">
        <div>
          <p className="worker-kicker">After Work</p>
          <h4>After Work Submission</h4>
          <p>Upload completed civic work proof</p>
        </div>
      </div>

      <div className="worker-split-grid">
        <div className="worker-column">
          <div className="worker-action-row compact">
            <button type="button" className="worker-primary-button" onClick={() => triggerInput(task._id, 'after-camera')}>
              <Camera size={18} />
              Open Camera
            </button>
            <button type="button" className="worker-secondary-button" onClick={() => triggerInput(task._id, 'after-upload')}>
              <Upload size={18} />
              Upload Photo
            </button>
          </div>

          {renderPreviewCard(
            'After Work Image',
            draft.afterPreview,
            draft.afterImageFile?.name || '',
            renderLocationCard(
              draft.afterLocation,
              draft.afterLocationLoading,
              draft.afterLocationError,
              () => void detectLiveLocation(task._id, 'after')
            )
          )}
        </div>

        <div className="worker-column">
          <div className="worker-action-row compact">
            <button type="button" className="worker-secondary-button" onClick={() => triggerInput(task._id, 'bill-upload')}>
              <Receipt size={18} />
              Upload Bill Copy
            </button>
          </div>

          {renderPreviewCard(
            'Bill Copy',
            draft.billPreview,
            draft.billImageFile?.name || '',
            <div className="worker-location-card muted">
              <span>Bill proof is required for final verification.</span>
            </div>
          )}
        </div>
      </div>

      <div className="worker-description-block">
        <label htmlFor={`description-${task._id}`}>Description</label>
        <textarea
          id={`description-${task._id}`}
          rows="5"
          value={draft.description}
          onChange={(event) => updateDraft(task._id, { description: event.target.value, formError: '' })}
          placeholder="Describe the completed civic maintenance work."
        />
      </div>

      {draft.formError ? <p className="worker-form-error">{draft.formError}</p> : null}

      <button
        type="button"
        className="worker-submit-button"
        disabled={!draft.afterImageFile || !draft.billImageFile || !draft.description.trim() || !hasAccurateLocation(draft.afterLocation) || draft.afterLocationLoading || draft.afterSubmitting}
        onClick={() => void submitAfterWork(task)}
      >
        {draft.afterSubmitting ? 'Submitting...' : 'Submit Completed Work'}
      </button>
    </section>
  );

  const renderWaitingSection = (task) => {
    const isVerified = String(task?.status || '').toLowerCase() === 'verified';

    return (
      <section className="worker-message-card waiting">
        <div className="worker-message-icon waiting">
          <Clock3 size={22} />
        </div>
        <div>
          <h4>{isVerified ? 'Verified and Waiting for Admin Closure' : 'Waiting for Department Verification'}</h4>
          <p>
            {isVerified
              ? 'Department Head has verified this civic work. Admin will close the task next.'
              : 'Department Head is reviewing your completed civic work.'}
          </p>
        </div>
      </section>
    );
  };

  const renderCompletedSection = (task) => (
    <section className="worker-message-card completed card-grid">
      <div className="worker-message-row">
        <div className="worker-message-icon completed">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <h4>Task Completed Successfully</h4>
          <p>The civic workflow is complete. Review the final submission summary below.</p>
        </div>
      </div>

      <div className="worker-summary-grid">
        {renderStoredPreview('Before Work', getStoredImage(task, 'before'), getProofLocation(task, 'before'))}
        {renderStoredPreview('After Work', getStoredImage(task, 'after'), getProofLocation(task, 'after'))}
        {renderStoredPreview('Bill Proof', getStoredImage(task, 'bill'), getProofLocation(task, 'bill'))}
      </div>

      <div className="worker-location-card success">
        <div className="worker-location-line">
          <FileText size={16} />
          <p>{getStoredDescription(task)}</p>
        </div>
        <div className="worker-location-line small">
          <Clock3 size={16} />
          <span>{formatDateTime(task?.updatedAt)}</span>
        </div>
      </div>
    </section>
  );

  return (
    <div className="fade-in worker-dashboard-page">
      <header className="worker-dashboard-hero">
        <div>
          <p className="worker-kicker">Worker Workflow</p>
          <h2>My Assigned Tasks</h2>
          <p>Track and complete civic maintenance workflow</p>
        </div>
        <button type="button" className="worker-refresh-button" onClick={() => void fetchTasks()}>
          <RefreshCw size={18} />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="worker-loading-card glass">
          <Loader size={18} className="spin" />
          <span>Loading assigned tasks...</span>
        </div>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <div className="worker-empty-card glass">
          <ShieldCheck size={22} />
          <div>
            <h3>No assigned tasks</h3>
            <p>Your civic assignments will appear here once the Department Head assigns them.</p>
          </div>
        </div>
      ) : null}

      <div className="worker-task-list">
        {tasks.map((task) => {
          const stage = getTaskStage(task);
          const draft = getDraft(task._id);

          return (
            <article key={task._id} className={`worker-task-shell glass ${STATUS_COPY[stage].tone}`}>
              <input
                ref={(node) => { if (node) fileInputRefs.current[`${task._id}:before-camera`] = node; }}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void handleBeforeImage(task._id, file);
                  }
                }}
              />
              <input
                ref={(node) => { if (node) fileInputRefs.current[`${task._id}:before-upload`] = node; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void handleBeforeImage(task._id, file);
                  }
                }}
              />
              <input
                ref={(node) => { if (node) fileInputRefs.current[`${task._id}:after-camera`] = node; }}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void handleAfterImage(task._id, file);
                  }
                }}
              />
              <input
                ref={(node) => { if (node) fileInputRefs.current[`${task._id}:after-upload`] = node; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void handleAfterImage(task._id, file);
                  }
                }}
              />
              <input
                ref={(node) => { if (node) fileInputRefs.current[`${task._id}:bill-upload`] = node; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    handleBillImage(task._id, file);
                  }
                }}
              />

              {renderMetaCard(task, stage)}
              {stage === 'PENDING' ? renderBeforeSection(task, draft) : null}
              {stage === 'IN_PROGRESS' ? renderAfterSection(task, draft) : null}
              {stage === 'WAITING_FOR_APPROVAL' ? renderWaitingSection(task) : null}
              {stage === 'COMPLETED' ? renderCompletedSection(task) : null}
            </article>
          );
        })}
      </div>

      <style>{`
        .worker-dashboard-page {
          display: grid;
          gap: 1.5rem;
        }

        .worker-dashboard-hero {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          padding: 1.8rem;
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 35%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 249, 255, 0.9));
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 30px 60px -46px rgba(15, 23, 42, 0.42);
        }

        .worker-dashboard-hero h2 {
          margin: 0;
        }

        .worker-dashboard-hero p:last-child {
          margin-top: 0.55rem;
          color: var(--text-muted);
        }

        .worker-kicker {
          margin: 0 0 0.38rem;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--text-muted);
        }

        .worker-refresh-button,
        .worker-primary-button,
        .worker-secondary-button,
        .worker-submit-button,
        .worker-inline-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          border-radius: 18px;
          font-weight: 700;
        }

        .worker-refresh-button {
          padding: 0.9rem 1rem;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: var(--text-main);
        }

        .worker-loading-card,
        .worker-empty-card {
          padding: 1.35rem 1.5rem;
          border-radius: 24px;
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .worker-empty-card p {
          margin-top: 0.35rem;
          color: var(--text-muted);
        }

        .worker-task-list {
          display: grid;
          gap: 1.5rem;
        }

        .worker-task-shell {
          padding: 1.5rem;
          border-radius: 28px;
          display: grid;
          gap: 1.2rem;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 28px 54px -44px rgba(15, 23, 42, 0.38);
        }

        .worker-task-shell.pending {
          background: linear-gradient(180deg, rgba(255, 251, 235, 0.9), rgba(255, 255, 255, 0.96));
        }

        .worker-task-shell.progress {
          background: linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(255, 255, 255, 0.96));
        }

        .worker-task-shell.waiting {
          background: linear-gradient(180deg, rgba(240, 249, 255, 0.9), rgba(255, 255, 255, 0.96));
        }

        .worker-task-shell.completed {
          background: linear-gradient(180deg, rgba(240, 253, 244, 0.92), rgba(255, 255, 255, 0.96));
        }

        .worker-meta-card,
        .worker-flow-card,
        .worker-message-card {
          border-radius: 24px;
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 1rem;
        }

        .worker-meta-top,
        .worker-meta-footer,
        .worker-flow-heading,
        .worker-message-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .worker-badges {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .worker-status-badge,
        .worker-priority-badge {
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .worker-status-badge.pending {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .worker-status-badge.progress {
          background: rgba(14, 165, 233, 0.14);
          color: #0369a1;
        }

        .worker-status-badge.waiting {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
        }

        .worker-status-badge.completed {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .worker-priority-badge.high {
          background: rgba(244, 63, 94, 0.12);
          color: #be123c;
        }

        .worker-priority-badge.medium {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .worker-priority-badge.low {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .worker-meta-grid,
        .worker-summary-grid,
        .worker-split-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.9rem;
        }

        .worker-meta-item {
          border-radius: 18px;
          padding: 0.9rem;
          background: rgba(248, 250, 252, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.16);
          display: grid;
          gap: 0.3rem;
        }

        .worker-meta-item span {
          font-size: 0.82rem;
          color: var(--text-muted);
        }

        .worker-address-card {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          padding: 0.9rem 1rem;
          border-radius: 18px;
          background: rgba(248, 250, 252, 0.94);
          border: 1px solid rgba(148, 163, 184, 0.16);
          color: var(--text-muted);
        }

        .worker-meta-footer p,
        .worker-flow-heading p {
          margin: 0.25rem 0 0;
          color: var(--text-muted);
        }

        .worker-detail-link {
          font-weight: 700;
          color: var(--primary);
          white-space: nowrap;
        }

        .worker-action-row,
        .worker-preview-card,
        .worker-description-block,
        .worker-column {
          display: grid;
          gap: 1rem;
        }

        .worker-action-row {
          grid-template-columns: repeat(auto-fit, minmax(180px, max-content));
        }

        .worker-action-row.compact {
          grid-template-columns: repeat(auto-fit, minmax(160px, max-content));
        }

        .worker-primary-button {
          padding: 0.95rem 1rem;
          background: linear-gradient(135deg, #0f766e, #0284c7);
          color: white;
          box-shadow: 0 20px 32px -24px rgba(2, 132, 199, 0.72);
        }

        .worker-secondary-button {
          padding: 0.95rem 1rem;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.24);
          color: var(--text-main);
        }

        .worker-submit-button {
          padding: 0.95rem 1.2rem;
          background: #0f172a;
          color: white;
          width: fit-content;
          min-width: 220px;
        }

        .worker-submit-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .worker-section-label {
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .worker-proof-image,
        .worker-empty-preview {
          width: 100%;
          max-width: 200px;
          border-radius: 18px;
          box-shadow: 0 18px 28px -22px rgba(15, 23, 42, 0.45);
        }

        .worker-proof-image {
          display: block;
          object-fit: cover;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .worker-empty-preview {
          min-height: 150px;
          display: grid;
          place-items: center;
          padding: 1rem;
          text-align: center;
          background: rgba(241, 245, 249, 0.9);
          border: 1px dashed rgba(148, 163, 184, 0.34);
          color: var(--text-muted);
        }

        .worker-file-name {
          margin: 0;
          color: var(--text-muted);
          word-break: break-word;
        }

        .worker-location-card {
          border-radius: 18px;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(248, 250, 252, 0.92);
        }

        .worker-location-card.info {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          color: #0369a1;
        }

        .worker-location-card.warning {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          background: rgba(254, 249, 195, 0.8);
          border-color: rgba(245, 158, 11, 0.22);
          color: #92400e;
        }

        .worker-location-card.success {
          background: rgba(236, 253, 245, 0.82);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .worker-location-card.muted {
          color: var(--text-muted);
        }

        .worker-location-line {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          color: var(--text-main);
        }

        .worker-location-line p {
          margin: 0;
          white-space: pre-line;
        }

        .worker-location-line.small {
          margin-top: 0.75rem;
          color: var(--text-muted);
        }

        .worker-inline-button {
          padding: 0.45rem 0.75rem;
          background: rgba(255, 255, 255, 0.9);
          color: #92400e;
        }

        .worker-description-block label {
          font-weight: 700;
        }

        .worker-description-block textarea {
          width: 100%;
          min-height: 130px;
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          background: white;
          padding: 1rem;
          resize: vertical;
        }

        .worker-form-error {
          margin: 0;
          color: var(--danger);
          font-weight: 600;
        }

        .worker-message-card.waiting {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(239, 246, 255, 0.92);
        }

        .worker-message-card.completed {
          display: grid;
          gap: 1rem;
          background: rgba(236, 253, 245, 0.92);
        }

        .worker-message-icon {
          width: 3rem;
          height: 3rem;
          border-radius: 18px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .worker-message-icon.waiting {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
        }

        .worker-message-icon.completed {
          background: rgba(16, 185, 129, 0.12);
          color: #047857;
        }

        .spin {
          animation: worker-spin 1s linear infinite;
        }

        @keyframes worker-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 780px) {
          .worker-dashboard-hero,
          .worker-meta-top,
          .worker-meta-footer,
          .worker-flow-heading,
          .worker-message-row,
          .worker-message-card.waiting {
            flex-direction: column;
          }

          .worker-badges {
            justify-content: flex-start;
          }

          .worker-action-row,
          .worker-action-row.compact,
          .worker-meta-grid,
          .worker-summary-grid,
          .worker-split-grid {
            grid-template-columns: 1fr;
          }

          .worker-refresh-button,
          .worker-primary-button,
          .worker-secondary-button,
          .worker-submit-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default WorkerTasks;
