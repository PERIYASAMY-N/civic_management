import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  MapPin,
  Receipt,
  RefreshCw
} from 'lucide-react';
import api, { resolveApiAssetUrl } from '../api';
import { useNotification } from '../context/NotificationContext';
import {
  LOCATION_TARGET_ACCURACY_METERS,
  formatAccuracyMeters,
  watchForAccuratePosition
} from '../utils/geolocation';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const LOCATION_MAX_ACCURACY_METERS = LOCATION_TARGET_ACCURACY_METERS;
const LOCATION_REQUIRED_MESSAGE = 'Location required';

const createDraft = () => ({
  beforeFile: null,
  beforePreview: '',
  beforeLocation: null,
  beforeLocationLoading: false,
  beforeLocationError: '',
  beforeSubmitting: false,
  afterFile: null,
  afterPreview: '',
  afterLocation: null,
  afterLocationLoading: false,
  afterLocationError: '',
  billFile: null,
  billPreview: '',
  description: '',
  afterSubmitting: false,
  formError: ''
});

const createCameraModal = () => ({
  open: false,
  taskId: '',
  field: 'before',
  error: '',
  starting: false,
  processing: false
});

const revokePreviewUrl = (previewUrl) => {
  if (previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

const getLocationAccuracy = (location) => {
  const accuracy = Number(location?.accuracy);
  return Number.isFinite(accuracy) ? accuracy : null;
};

const hasAccurateLocation = (location) => {
  const accuracy = getLocationAccuracy(location);
  return accuracy !== null && accuracy <= LOCATION_MAX_ACCURACY_METERS;
};

const formatAccuracy = (accuracy) => {
  return formatAccuracyMeters(accuracy);
};

const formatCoordinates = (lat, lng) => `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`;

const getWorkerStage = (task) => {
  const status = String(task?.status || '').toLowerCase();

  if (status === 'in_progress') {
    return 'IN_PROGRESS';
  }

  if (['completed', 'verified', 'waiting_for_head', 'waiting_for_verification'].includes(status)) {
    return 'COMPLETED';
  }

  return 'PENDING';
};

const getStageAccent = (stage) => {
  if (stage === 'IN_PROGRESS') {
    return 'progress';
  }

  if (stage === 'COMPLETED') {
    return 'completed';
  }

  return 'pending';
};

const getStageLabel = (stage) => {
  if (stage === 'IN_PROGRESS') {
    return 'In Progress';
  }

  if (stage === 'COMPLETED') {
    return 'Completed';
  }

  return 'Pending';
};

const getImageValue = (task, key) => {
  if (key === 'before') {
    return task?.beforeWork?.image || task?.beforeImage || task?.work_proof?.before_image || '';
  }

  if (key === 'after') {
    return task?.afterWork?.image || task?.afterImage || task?.work_proof?.after_image || '';
  }

  return task?.afterWork?.billImage || task?.billImage || task?.work_proof?.bill_image || '';
};

const getLocationValue = (task, key) => {
  if (key === 'before') {
    return {
      address: task?.beforeWork?.address || task?.beforeAddress || '',
      accuracy: task?.beforeWork?.accuracy ?? task?.beforeAccuracy,
      timestamp: task?.beforeWork?.timestamp || task?.beforeTime || ''
    };
  }

  if (key === 'after') {
    return {
      address: task?.afterWork?.address || task?.afterAddress || '',
      accuracy: task?.afterWork?.accuracy ?? task?.afterAccuracy,
      timestamp: task?.afterWork?.timestamp || task?.afterTime || ''
    };
  }

  return {
    address: task?.afterWork?.billAddress || task?.billAddress || '',
    accuracy: task?.afterWork?.billAccuracy ?? task?.billAccuracy,
    timestamp: task?.afterWork?.billTimestamp || task?.billTime || ''
  };
};

const validateImageFile = (file) => {
  if (!file) {
    return 'Please select an image file.';
  }

  if (!String(file.type || '').startsWith('image/')) {
    return 'Only image files are allowed.';
  }

  if (!SUPPORTED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Only JPG, JPEG, and PNG images are allowed.';
  }

  return '';
};

const reverseGeocode = async (lat, lng) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  const data = await response.json();
  return data?.display_name || 'Address not found';
};

const dataUrlToFile = (dataUrl, filename) => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta?.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(content || '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mimeType });
};

const WorkerTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [cameraModal, setCameraModal] = useState(createCameraModal);
  const draftsRef = useRef({});
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRefs = useRef({});
  const { addToast } = useNotification();

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => () => {
    Object.values(draftsRef.current).forEach((draft) => {
      revokePreviewUrl(draft.beforePreview);
      revokePreviewUrl(draft.afterPreview);
      revokePreviewUrl(draft.billPreview);
    });
  }, []);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => {
    stopCameraStream();
  }, [stopCameraStream]);

  useEffect(() => {
    if (!cameraModal.open) {
      stopCameraStream();
      return undefined;
    }

    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = 'Camera is not supported in this browser';
        setCameraModal((current) => ({ ...current, starting: false, error: message }));
        addToast(message, 'error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment'
          }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setCameraModal((current) => ({ ...current, starting: false, error: '' }));
      } catch (error) {
        const message = error?.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : error instanceof Error
            ? error.message
            : 'Unable to open camera';

        setCameraModal((current) => ({ ...current, starting: false, error: message }));
        addToast(message, 'error');
      }
    };

    setCameraModal((current) => ({ ...current, starting: true, error: '' }));
    void startCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [addToast, cameraModal.open, stopCameraStream]);

  const getDraft = (taskId) => drafts[taskId] || createDraft();

  const updateDraft = (taskId, nextValue) => {
    setDrafts((current) => {
      const existing = current[taskId] || createDraft();
      const updated = typeof nextValue === 'function'
        ? nextValue(existing)
        : { ...existing, ...nextValue };

      return {
        ...current,
        [taskId]: updated
      };
    });
  };

  const clearDraft = (taskId) => {
    setDrafts((current) => {
      const draft = current[taskId];
      if (!draft) {
        return current;
      }

      revokePreviewUrl(draft.beforePreview);
      revokePreviewUrl(draft.afterPreview);
      revokePreviewUrl(draft.billPreview);

      const nextDrafts = { ...current };
      delete nextDrafts[taskId];
      return nextDrafts;
    });
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/complaints/my-tasks');
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch worker tasks', error);
      setTasks([]);
      addToast('Unable to load assigned tasks right now.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const openFilePicker = (taskId, field) => {
    fileInputRefs.current[`${taskId}:${field}`]?.click();
  };

  const resetCaptureField = (taskId, field) => {
    const fileKey = `${field}File`;
    const previewKey = `${field}Preview`;
    const locationKey = `${field}Location`;
    const loadingKey = `${field}LocationLoading`;
    const errorKey = `${field}LocationError`;

    updateDraft(taskId, (current) => {
      revokePreviewUrl(current[previewKey]);

      return {
        ...current,
        [fileKey]: null,
        [previewKey]: '',
        [locationKey]: null,
        [loadingKey]: false,
        [errorKey]: '',
        formError: ''
      };
    });
  };

  const openCameraModal = (taskId, field) => {
    resetCaptureField(taskId, field);
    setCameraModal({
      open: true,
      taskId,
      field,
      error: '',
      starting: true,
      processing: false
    });
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setCameraModal(createCameraModal());
  };

  const captureLiveLocation = async (taskId, field, options = {}) => {
    const loadingKey = `${field}LocationLoading`;
    const errorKey = `${field}LocationError`;
    const locationKey = `${field}Location`;
    const { alertOnDenied = false } = options;

    updateDraft(taskId, {
      [loadingKey]: true,
      [errorKey]: '',
      [locationKey]: null,
      formError: ''
    });

    try {
      const position = await watchForAccuratePosition({
        targetAccuracy: LOCATION_MAX_ACCURACY_METERS,
        onProgress: (nextPosition) => {
          const lat = Number(nextPosition.coords.latitude);
          const lng = Number(nextPosition.coords.longitude);
          const accuracy = Number(nextPosition.coords.accuracy);

          updateDraft(taskId, {
            [loadingKey]: true,
            [errorKey]: '',
            [locationKey]: {
              lat,
              lng,
              address: '',
              accuracy: Number.isFinite(accuracy) ? accuracy : null,
              timestamp: ''
            },
            formError: ''
          });
        }
      });
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      const timestamp = new Date().toISOString();
      const address = await reverseGeocode(lat, lng).catch(() => formatCoordinates(lat, lng));
      const location = {
        lat,
        lng,
        address: address || formatCoordinates(lat, lng),
        accuracy,
        timestamp
      };

      updateDraft(taskId, {
        [loadingKey]: false,
        [locationKey]: location
      });
      return { location, error: '' };
    } catch (error) {
      const isPermissionDenied = error?.code === 1 || error?.name === 'NotAllowedError';
      const message = isPermissionDenied
        ? LOCATION_REQUIRED_MESSAGE
        : error instanceof Error
          ? error.message
          : 'Unable to fetch your live location.';

      updateDraft(taskId, {
        [loadingKey]: false,
        [locationKey]: null,
        [errorKey]: message
      });

      if (isPermissionDenied && alertOnDenied && typeof window !== 'undefined') {
        window.alert(LOCATION_REQUIRED_MESSAGE);
      }

      addToast(message, 'error');
      return { location: null, error: message };
    }
  };

  const setPreviewFile = (taskId, field, file, previewOverride) => {
    const previewKey = `${field}Preview`;
    const fileKey = `${field}File`;

    updateDraft(taskId, (current) => {
      revokePreviewUrl(current[previewKey]);

      return {
        ...current,
        [fileKey]: file,
        [previewKey]: previewOverride || URL.createObjectURL(file),
        formError: ''
      };
    });
  };

  const handleFileChange = (taskId, field, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      updateDraft(taskId, { formError: validationError });
      addToast(validationError, 'error');
      return;
    }

    setPreviewFile(taskId, field, file);
  };

  const capturePhoto = async () => {
    const { field, taskId } = cameraModal;

    if (!taskId || !field || !videoRef.current || !canvasRef.current) {
      return;
    }

    const width = videoRef.current.videoWidth || 1280;
    const height = videoRef.current.videoHeight || 720;
    const context = canvasRef.current.getContext('2d');

    if (!context) {
      const message = 'Unable to capture image from camera';
      addToast(message, 'error');
      setCameraModal((current) => ({ ...current, error: message }));
      return;
    }

    setCameraModal((current) => ({ ...current, processing: true, error: '' }));

    const { location, error } = await captureLiveLocation(taskId, field, { alertOnDenied: true });
    if (!location || !hasAccurateLocation(location)) {
      setCameraModal((current) => ({
        ...current,
        processing: false,
        error: error || LOCATION_REQUIRED_MESSAGE
      }));
      return;
    }

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    context.drawImage(videoRef.current, 0, 0, width, height);

    const imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.92);
    const imageFile = dataUrlToFile(imageBase64, `${field}-work-${Date.now()}.jpg`);
    setPreviewFile(taskId, field, imageFile, imageBase64);
    setCameraModal((current) => ({ ...current, processing: false }));
    closeCameraModal();
  };

  const submitBeforeWork = async (task) => {
    const draft = getDraft(task._id);

    if (!draft.beforeFile || !hasAccurateLocation(draft.beforeLocation)) {
      const message = 'Before photo and an accurate live location are required.';
      updateDraft(task._id, { formError: message });
      addToast(message, 'error');
      return;
    }

    updateDraft(task._id, { beforeSubmitting: true, formError: '' });

    try {
      const payload = new FormData();
      payload.append('beforeImageFile', draft.beforeFile);
      payload.append('beforeLocation', JSON.stringify(draft.beforeLocation));

      console.log('Before payload', {
        beforeImage: draft.beforeFile?.name || '',
        beforeLocation: draft.beforeLocation
      });

      const response = await api.patch(`/tasks/${task._id}/before`, payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Before response', response.data);

      clearDraft(task._id);
      await fetchTasks();
      addToast('Before work submitted successfully.', 'success');
    } catch (error) {
      console.error(error.response?.data || error.message);
      const message = error.response?.data?.message || 'Failed to submit before work.';
      updateDraft(task._id, { beforeSubmitting: false, formError: message });
      addToast(message, 'error');
    }
  };

  const submitAfterWork = async (task) => {
    const draft = getDraft(task._id);

    if (!draft.afterFile || !draft.billFile || !hasAccurateLocation(draft.afterLocation) || !draft.description.trim()) {
      const message = 'After photo, bill proof, description, and an accurate live location are required.';
      updateDraft(task._id, { formError: message });
      addToast(message, 'error');
      return;
    }

    updateDraft(task._id, { afterSubmitting: true, formError: '' });

    try {
      const payload = new FormData();
      payload.append('afterImageFile', draft.afterFile);
      payload.append('billImageFile', draft.billFile);
      payload.append('afterLocation', JSON.stringify(draft.afterLocation));
      payload.append('description', draft.description.trim());

      console.log('After payload', {
        afterImage: draft.afterFile?.name || '',
        afterLocation: draft.afterLocation,
        billImage: draft.billFile?.name || '',
        description: draft.description.trim()
      });

      const response = await api.patch(`/tasks/${task._id}/after`, payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('After response', response.data);

      clearDraft(task._id);
      await fetchTasks();
      addToast('After work submitted successfully.', 'success');
    } catch (error) {
      console.error(error.response?.data || error.message);
      const message = error.response?.data?.message || 'Failed to submit after work.';
      updateDraft(task._id, { afterSubmitting: false, formError: message });
      addToast(message, 'error');
    }
  };

  const renderLocationBlock = (location, loading, error) => {
    if (loading) {
      return (
        <div className="location-pill location-loading">
          <RefreshCw size={14} className="spin" />
          <span>
            {getLocationAccuracy(location) !== null
              ? `Detecting accurate location... Current accuracy: ${formatAccuracy(location.accuracy)}. Waiting for ${LOCATION_MAX_ACCURACY_METERS} m or better.`
              : `Detecting accurate location... Waiting for ${LOCATION_MAX_ACCURACY_METERS} m or better.`}
          </span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="location-warning">
          <div className="location-warning-copy">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        </div>
      );
    }

    if (!location) {
      return (
        <div className="location-pill">
          <MapPin size={14} />
          <span>Capture a photo to attach a live GPS location.</span>
        </div>
      );
    }

    if (!hasAccurateLocation(location)) {
      return (
        <div className="location-warning">
          <div className="location-warning-copy">
            <AlertTriangle size={16} />
            <span>{`Location accuracy must be ${LOCATION_MAX_ACCURACY_METERS} m or better.`}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="location-card">
        <div className="location-row">
          <MapPin size={14} />
          <span>{location.address}</span>
        </div>
        <div className="location-row">
          <CheckCircle2 size={14} />
          <span>{`Accuracy: ${formatAccuracy(location.accuracy)}`}</span>
        </div>
      </div>
    );
  };

  const renderDraftPreview = (title, previewUrl, location) => (
    <div className="preview-shell">
      <span className="preview-label">{title}</span>
      {previewUrl ? (
        <>
          <div className="preview-card">
            <img src={previewUrl} alt={title} className="preview-image" />
          </div>
          {location ? (
            <div className="preview-meta">
              <div className="location-row">
                <MapPin size={14} />
                <span>{location.address}</span>
              </div>
              {getLocationAccuracy(location) !== null ? (
                <div className="location-row">
                  <CheckCircle2 size={14} />
                  <span>{`Accuracy: ${formatAccuracy(location.accuracy)}`}</span>
                </div>
              ) : null}
              <div className="location-row">
                <Clock size={14} />
                <span>{formatDateTime(location.timestamp)}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="preview-empty">
          <ImageIcon size={18} />
          <span>No image selected yet</span>
        </div>
      )}
    </div>
  );

  const renderStoredPreview = (title, imageUrl, location) => (
    <div className="summary-media">
      <span className="preview-label">{title}</span>
      {imageUrl ? (
        <div className="preview-card">
          <img src={resolveApiAssetUrl(imageUrl)} alt={title} className="preview-image" />
        </div>
      ) : (
        <div className="preview-empty">
          <ImageIcon size={18} />
          <span>No image available</span>
        </div>
      )}
      {location?.address ? (
        <div className="summary-meta">
          <div className="location-row">
            <MapPin size={14} />
            <span>{location.address}</span>
          </div>
          {Number.isFinite(Number(location.accuracy)) ? (
            <div className="location-row">
              <CheckCircle2 size={14} />
              <span>{`Accuracy: ${formatAccuracy(location.accuracy)}`}</span>
            </div>
          ) : null}
          {location.timestamp ? (
            <div className="location-row">
              <Clock size={14} />
              <span>{formatDateTime(location.timestamp)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderBeforeSection = (task, draft) => (
    <section className="task-stage-card">
      <div className="stage-header">
        <div>
          <p className="eyebrow">Before Work</p>
          <h4>Capture the starting proof</h4>
        </div>
        <span className="stage-chip">Pending</span>
      </div>

      <div className="stage-body">
        <button
          type="button"
          className="primary-action"
          onClick={() => openCameraModal(task._id, 'before')}
        >
          <Camera size={18} />
          {draft.beforePreview ? 'Open Camera' : 'Start Work'}
        </button>

        {renderDraftPreview('Before Photo', draft.beforePreview, draft.beforeLocation)}
        {renderLocationBlock(
          draft.beforeLocation,
          draft.beforeLocationLoading,
          draft.beforeLocationError
        )}

        {draft.formError ? <p className="inline-error">{draft.formError}</p> : null}

        <button
          type="button"
          className="submit-action"
          disabled={!draft.beforeFile || !hasAccurateLocation(draft.beforeLocation) || draft.beforeSubmitting}
          onClick={() => void submitBeforeWork(task)}
        >
          {draft.beforeSubmitting ? 'Submitting...' : 'Submit Before Work'}
        </button>
      </div>
    </section>
  );

  const renderAfterSection = (task, draft) => (
    <section className="task-stage-card">
      <div className="stage-header">
        <div>
          <p className="eyebrow">After Work</p>
          <h4>Finish the task submission</h4>
        </div>
        <span className="stage-chip progress">In Progress</span>
      </div>

      <div className="stage-body">
        <div className="action-grid">
          <button
            type="button"
            className="primary-action"
            onClick={() => openCameraModal(task._id, 'after')}
          >
            <Camera size={18} />
            Open Camera
          </button>

          <button
            type="button"
            className="secondary-action"
            onClick={() => openFilePicker(task._id, 'bill')}
          >
            <Receipt size={18} />
            Upload Bill Proof
          </button>
        </div>

        <div className="preview-grid">
          {renderDraftPreview('After Photo', draft.afterPreview, draft.afterLocation)}
          {renderDraftPreview('Bill Proof', draft.billPreview)}
        </div>

        {renderLocationBlock(
          draft.afterLocation,
          draft.afterLocationLoading,
          draft.afterLocationError
        )}

        <div className="description-block">
          <label htmlFor={`description-${task._id}`}>Description</label>
          <textarea
            id={`description-${task._id}`}
            rows="4"
            value={draft.description}
            onChange={(event) => updateDraft(task._id, { description: event.target.value, formError: '' })}
            placeholder="Describe the completed work..."
          />
        </div>

        {draft.formError ? <p className="inline-error">{draft.formError}</p> : null}

        <button
          type="button"
          className="submit-action"
          disabled={!draft.afterFile || !draft.billFile || !hasAccurateLocation(draft.afterLocation) || !draft.description.trim() || draft.afterSubmitting}
          onClick={() => void submitAfterWork(task)}
        >
          {draft.afterSubmitting ? 'Submitting...' : 'Submit After Work'}
        </button>
      </div>
    </section>
  );

  const renderCompletedSection = (task) => (
    <section className="task-stage-card completed-card">
      <div className="stage-header">
        <div>
          <p className="eyebrow">Completed Summary</p>
          <h4>Read-only submission record</h4>
        </div>
        <span className="stage-chip completed">
          <CheckCircle2 size={14} />
          Completed
        </span>
      </div>

      <div className="summary-grid">
        {renderStoredPreview('Before Work', getImageValue(task, 'before'), getLocationValue(task, 'before'))}
        {renderStoredPreview('After Work', getImageValue(task, 'after'), getLocationValue(task, 'after'))}
        {renderStoredPreview('Bill Proof', getImageValue(task, 'bill'), getLocationValue(task, 'bill'))}
        <div className="summary-copy">
          <span className="preview-label">Description</span>
          <div className="summary-text-card">
            <FileText size={18} />
            <p>{task.afterWork?.description || task.workDescription || task.work_proof?.description || 'No description available.'}</p>
          </div>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading tasks...</div>;
  }

  return (
    <div className="fade-in worker-tasks-page">
      <div className="worker-page-header">
        <div>
          <p className="page-kicker">Worker Tasks</p>
          <h2>Assigned task workflow</h2>
          <p className="page-subtitle">Only one section is shown at a time based on the current task status.</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="glass empty-state-card">
          <p>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="task-grid">
          {tasks.map((task) => {
            const draft = getDraft(task._id);
            const stage = getWorkerStage(task);
            const accent = getStageAccent(stage);

            return (
              <article key={task._id} className={`glass task-card ${accent}`}>
                <input
                  ref={(node) => {
                    if (node) {
                      fileInputRefs.current[`${task._id}:bill`] = node;
                    }
                  }}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={(event) => void handleFileChange(task._id, 'bill', event)}
                />

                <div className="task-card-top">
                  <div>
                    <div className="task-badges">
                      <span className={`status-pill ${accent}`}>{getStageLabel(stage)}</span>
                      <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
                    </div>
                    <h3>{task.title}</h3>
                  </div>
                  <Link to={`/issues/${task._id}`} className="details-link">
                    View Details
                  </Link>
                </div>

                <div className="task-location">
                  <MapPin size={14} />
                  <span>{task.location?.address || task.address || 'Location unavailable'}</span>
                </div>

                {task.status === 'rework_required' ? (
                  <div className="status-note warning">
                    <AlertTriangle size={16} />
                    <span>{task.verification?.comments || 'Rework requested. Please submit a fresh before-work proof.'}</span>
                  </div>
                ) : null}

                {stage === 'PENDING' ? renderBeforeSection(task, draft) : null}
                {stage === 'IN_PROGRESS' ? renderAfterSection(task, draft) : null}
                {stage === 'COMPLETED' ? renderCompletedSection(task) : null}
              </article>
            );
          })}
        </div>
      )}

      {cameraModal.open ? (
        <div className="camera-modal-backdrop" role="presentation" onClick={closeCameraModal}>
          <div
            className="camera-modal"
            role="dialog"
            aria-modal="true"
            aria-label={cameraModal.field === 'after' ? 'After work camera' : 'Before work camera'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="camera-modal-header">
              <div>
                <p className="eyebrow">{cameraModal.field === 'after' ? 'After Work' : 'Before Work'}</p>
                <h4>Open Camera</h4>
              </div>
              <button type="button" className="camera-close-button" onClick={closeCameraModal}>
                Close
              </button>
            </div>

            <div className="camera-modal-body">
              <div className="camera-preview-shell">
                <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
                <canvas ref={canvasRef} className="camera-canvas" />
              </div>

              {cameraModal.starting ? (
                <div className="camera-status">
                  <RefreshCw size={14} className="spin" />
                  <span>Starting camera...</span>
                </div>
              ) : null}

              {cameraModal.error ? (
                <div className="location-warning">
                  <div className="location-warning-copy">
                    <AlertTriangle size={16} />
                    <span>{cameraModal.error}</span>
                  </div>
                </div>
              ) : null}

              <div className="camera-modal-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => void capturePhoto()}
                  disabled={cameraModal.starting || cameraModal.processing || !cameraStreamRef.current}
                >
                  <Camera size={18} />
                  {cameraModal.processing ? 'Attaching Location...' : 'Capture'}
                </button>
                <button type="button" className="secondary-action" onClick={closeCameraModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .worker-tasks-page {
          display: grid;
          gap: 1.5rem;
        }

        .worker-page-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .page-kicker,
        .eyebrow {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--text-muted);
          margin-bottom: 0.35rem;
        }

        .page-subtitle {
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        .empty-state-card {
          padding: 2rem;
          text-align: center;
        }

        .task-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 1.5rem;
        }

        .task-card {
          padding: 1.5rem;
          border-radius: 22px;
          border: 1px solid var(--border);
          display: grid;
          gap: 1rem;
          position: relative;
          overflow: hidden;
        }

        .task-card.pending {
          background: linear-gradient(180deg, rgba(245, 158, 11, 0.08), rgba(255, 255, 255, 0.92));
        }

        .task-card.progress {
          background: linear-gradient(180deg, rgba(14, 165, 233, 0.08), rgba(255, 255, 255, 0.92));
        }

        .task-card.completed {
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.92));
        }

        .task-card-top {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .task-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .status-pill,
        .stage-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.8rem;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .status-pill.pending,
        .stage-chip {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .status-pill.progress,
        .stage-chip.progress {
          background: rgba(14, 165, 233, 0.14);
          color: #0369a1;
        }

        .status-pill.completed,
        .stage-chip.completed {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .details-link {
          white-space: nowrap;
          align-self: center;
          font-weight: 600;
          color: var(--primary);
        }

        .task-location,
        .location-row,
        .location-warning-copy,
        .summary-text-card {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .task-location,
        .location-row,
        .summary-meta,
        .summary-text-card p {
          color: var(--text-muted);
        }

        .status-note {
          border-radius: 16px;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          font-size: 0.92rem;
        }

        .status-note.warning {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.22);
          color: #b45309;
        }

        .task-stage-card {
          border-radius: 20px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.78);
          padding: 1.1rem;
          display: grid;
          gap: 1rem;
          backdrop-filter: blur(12px);
        }

        .stage-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .stage-body {
          display: grid;
          gap: 1rem;
        }

        .action-grid,
        .preview-grid,
        .summary-grid {
          display: grid;
          gap: 1rem;
        }

        .preview-grid,
        .summary-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .camera-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.82);
          display: grid;
          place-items: center;
          padding: 1rem;
          z-index: 50;
        }

        .camera-modal {
          width: min(100%, 720px);
          border-radius: 24px;
          background: #0f172a;
          color: white;
          box-shadow: 0 24px 60px -24px rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
        }

        .camera-modal-header,
        .camera-modal-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .camera-modal-body,
        .camera-preview-shell {
          display: grid;
          gap: 1rem;
        }

        .camera-video {
          width: 100%;
          max-height: 60vh;
          border-radius: 18px;
          background: black;
          object-fit: cover;
        }

        .camera-canvas {
          display: none;
        }

        .camera-status {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255, 255, 255, 0.78);
        }

        .camera-close-button {
          border-radius: 999px;
          padding: 0.55rem 0.85rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .primary-action,
        .secondary-action,
        .submit-action,
        .mini-action {
          border-radius: 16px;
          padding: 0.9rem 1rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          font-weight: 600;
        }

        .primary-action {
          background: linear-gradient(135deg, #0f766e, #0ea5e9);
          color: white;
          box-shadow: 0 14px 28px -20px rgba(14, 165, 233, 0.9);
        }

        .secondary-action {
          background: rgba(15, 23, 42, 0.06);
          color: var(--text-main);
          border: 1px solid var(--border);
        }

        .submit-action {
          background: #111827;
          color: white;
        }

        .submit-action:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .mini-action {
          padding: 0.55rem 0.8rem;
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .preview-shell,
        .summary-copy {
          display: grid;
          gap: 0.6rem;
        }

        .preview-meta {
          display: grid;
          gap: 0.45rem;
          max-width: 240px;
          border-radius: 16px;
          border: 1px solid var(--border);
          padding: 0.75rem 0.85rem;
          background: rgba(255, 255, 255, 0.86);
        }

        .preview-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .preview-card {
          max-width: 240px;
          width: 100%;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: white;
          box-shadow: 0 18px 30px -24px rgba(15, 23, 42, 0.45);
        }

        .preview-image {
          display: block;
          width: 100%;
          height: auto;
          max-height: 220px;
          object-fit: cover;
        }

        .preview-empty {
          max-width: 240px;
          min-height: 140px;
          border-radius: 18px;
          border: 1px dashed var(--border);
          display: grid;
          place-items: center;
          padding: 1rem;
          text-align: center;
          color: var(--text-muted);
          background: rgba(148, 163, 184, 0.08);
        }

        .location-pill,
        .location-card,
        .location-warning,
        .summary-meta,
        .summary-text-card {
          border-radius: 16px;
          border: 1px solid var(--border);
          padding: 0.85rem 0.95rem;
          background: rgba(255, 255, 255, 0.8);
        }

        .location-pill,
        .location-warning {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .location-loading {
          color: #0369a1;
        }

        .location-warning {
          background: rgba(254, 249, 195, 0.7);
          border-color: rgba(245, 158, 11, 0.28);
          color: #92400e;
        }

        .inline-error {
          color: var(--danger);
          font-size: 0.92rem;
        }

        .description-block {
          display: grid;
          gap: 0.55rem;
        }

        .description-block label {
          font-weight: 600;
        }

        .description-block textarea {
          min-height: 110px;
          resize: vertical;
        }

        .summary-media {
          display: grid;
          gap: 0.6rem;
        }

        .summary-meta,
        .summary-text-card {
          display: grid;
          gap: 0.45rem;
        }

        .summary-text-card {
          grid-template-columns: 18px 1fr;
        }

        .completed-card {
          background: rgba(240, 253, 244, 0.75);
        }

        .priority-tag {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.18rem 0.55rem;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .priority-tag.high {
          background: rgba(244, 63, 94, 0.12);
          color: #be123c;
        }

        .priority-tag.medium {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .priority-tag.low {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .spin {
          animation: worker-spin 1s linear infinite;
        }

        @keyframes worker-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 760px) {
          .task-card-top,
          .stage-header,
          .camera-modal-header,
          .camera-modal-actions,
          .location-pill,
          .location-warning {
            flex-direction: column;
          }

          .details-link {
            align-self: flex-start;
          }

          .preview-grid,
          .summary-grid,
          .task-grid {
            grid-template-columns: 1fr;
          }

          .preview-card,
          .preview-empty,
          .preview-meta {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default WorkerTasks;
