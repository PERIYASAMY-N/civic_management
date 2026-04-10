import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Image as ImageIcon, MapPin, Upload } from 'lucide-react';
import api, { resolveApiAssetUrl } from '../api';

const getStatusLabel = (status) => {
  const labels = {
    pending: 'Pending',
    assigned_to_worker: 'New Assignment',
    assigned_to_dept: 'Dept Assigned',
    in_progress: 'In Progress',
    waiting_for_verification: 'Waiting Verification',
    verified: 'Verified',
    rework_required: 'Rework Required',
    completed: 'Closed'
  };

  return labels[status] || status;
};

const getProofImage = (task, stage) => {
  if (stage === 'before') {
    return task?.beforeImage || task?.work_proof?.before_image || '';
  }

  return task?.afterImage || task?.work_proof?.after_image || '';
};

const isStartableWorkflowStatus = (status) => ['pending', 'assigned_to_worker', 'assigned_to_dept', 'rework_required'].includes(status);

const createEmptyDraft = () => ({
  selectedFile: null,
  previewUrl: '',
  selectedFileName: '',
  selectedImageSource: '',
  cameraOpen: false,
  cameraLoading: false,
  cameraError: '',
  formError: '',
  submitLoading: false
});

const supportedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const WorkerTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proofDrafts, setProofDrafts] = useState({});
  const [activeCameraKey, setActiveCameraKey] = useState('');

  const fileInputRefs = useRef({});
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    void fetchTasks();

    return () => {
      closeCameraStream();
      cleanupAllDrafts();
    };
  }, []);

  useEffect(() => {
    if (!activeCameraKey || !videoRef.current || !streamRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      updateDraft(activeCameraKey, (current) => ({
        ...current,
        cameraError: 'Unable to start the camera preview.'
      }));
    });
  }, [activeCameraKey, proofDrafts]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/complaints/my-tasks');
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch worker tasks', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getDraftKey = (taskId, stage) => `${taskId}:${stage}`;

  const getDraft = (taskId, stage) => proofDrafts[getDraftKey(taskId, stage)] || createEmptyDraft();

  const updateDraft = (draftKey, nextValue) => {
    setProofDrafts((current) => {
      const existing = current[draftKey] || createEmptyDraft();
      const updated = typeof nextValue === 'function'
        ? nextValue(existing)
        : { ...existing, ...nextValue };

      return {
        ...current,
        [draftKey]: updated
      };
    });
  };

  const closeCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const revokePreviewUrl = (previewUrl) => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const clearDraft = (draftKey) => {
    setProofDrafts((current) => {
      if (!current[draftKey]) {
        return current;
      }

      revokePreviewUrl(current[draftKey].previewUrl);
      const nextDrafts = { ...current };
      delete nextDrafts[draftKey];
      return nextDrafts;
    });
  };

  const cleanupAllDrafts = () => {
    setProofDrafts((current) => {
      Object.values(current).forEach((draft) => revokePreviewUrl(draft.previewUrl));
      return {};
    });
  };

  const closeActiveCamera = () => {
    closeCameraStream();

    if (activeCameraKey) {
      updateDraft(activeCameraKey, (current) => ({
        ...current,
        cameraOpen: false,
        cameraLoading: false
      }));
    }

    setActiveCameraKey('');
  };

  const validateImageFile = (file) => {
    if (!file) {
      return 'Please upload or capture an image.';
    }

    if (!String(file.type || '').startsWith('image/')) {
      return 'Only image files are allowed.';
    }

    if (!supportedImageTypes.has(String(file.type || '').toLowerCase())) {
      return 'Only JPG, JPEG, and PNG images are allowed.';
    }

    return '';
  };

  const setSelectedProof = (taskId, stage, file, source) => {
    const draftKey = getDraftKey(taskId, stage);
    const existingDraft = proofDrafts[draftKey];

    revokePreviewUrl(existingDraft?.previewUrl);
    closeActiveCamera();

    updateDraft(draftKey, {
      selectedFile: file,
      previewUrl: URL.createObjectURL(file),
      selectedFileName: file.name,
      selectedImageSource: source,
      cameraOpen: false,
      cameraLoading: false,
      cameraError: '',
      formError: '',
      submitLoading: false
    });
  };

  const handleFileSelection = (taskId, stage, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const draftKey = getDraftKey(taskId, stage);
    const validationError = validateImageFile(file);

    if (validationError) {
      updateDraft(draftKey, {
        formError: validationError
      });
      event.target.value = '';
      return;
    }

    setSelectedProof(taskId, stage, file, 'upload');
    event.target.value = '';
  };

  const openCamera = async (taskId, stage) => {
    const draftKey = getDraftKey(taskId, stage);

    if (!window.isSecureContext) {
      updateDraft(draftKey, {
        cameraError: 'Camera access requires HTTPS or localhost.'
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      updateDraft(draftKey, {
        cameraError: 'Camera access is not supported in this browser.'
      });
      return;
    }

    try {
      closeActiveCamera();
      updateDraft(draftKey, {
        cameraLoading: true,
        cameraError: '',
        formError: ''
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      });

      streamRef.current = stream;
      setActiveCameraKey(draftKey);
      updateDraft(draftKey, {
        cameraOpen: true,
        cameraLoading: false,
        cameraError: ''
      });
    } catch (error) {
      updateDraft(draftKey, {
        cameraLoading: false,
        cameraError: error.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can upload an image instead.'
          : 'Unable to access the camera. You can upload an image instead.'
      });
    }
  };

  const captureImage = async (taskId, stage) => {
    if (!videoRef.current) {
      return;
    }

    const draftKey = getDraftKey(taskId, stage);
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext('2d');
    if (!context) {
      updateDraft(draftKey, {
        cameraError: 'Unable to access the camera frame.'
      });
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));

    if (!blob) {
      updateDraft(draftKey, {
        cameraError: 'Unable to capture the current frame.'
      });
      return;
    }

    const capturedFile = new File([blob], `task-proof-${stage}-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });

    setSelectedProof(taskId, stage, capturedFile, 'camera');
  };

  const submitProof = async (task, stage) => {
    const draftKey = getDraftKey(task._id, stage);
    const draft = getDraft(task._id, stage);
    const beforeImage = getProofImage(task, 'before');

    if (!draft.selectedFile) {
      updateDraft(draftKey, {
        formError: stage === 'before'
          ? 'Before-work image is required before starting work.'
          : 'After-work image is required before completing work.'
      });
      return;
    }

    if (stage === 'after' && !beforeImage) {
      updateDraft(draftKey, {
        formError: 'Before-work proof must be submitted before task completion.'
      });
      return;
    }

    try {
      updateDraft(draftKey, {
        submitLoading: true,
        formError: ''
      });

      const payload = new FormData();
      payload.append('proofImage', draft.selectedFile);

      if (stage === 'before') {
        await api.post(`/complaints/start-work/${task._id}`, payload, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('Before photo saved. Work has started.');
      } else {
        payload.append('status', 'waiting_for_verification');
        await api.post(`/complaints/update-status/${task._id}`, payload, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('After photo saved. Work submitted for department verification.');
      }

      clearDraft(draftKey);
      closeActiveCamera();
      await fetchTasks();
    } catch (error) {
      updateDraft(draftKey, {
        submitLoading: false,
        formError: error.response?.data?.message || 'Unable to submit proof right now.'
      });
    }
  };

  const renderProofSection = (task, stage) => {
    const draftKey = getDraftKey(task._id, stage);
    const draft = getDraft(task._id, stage);
    const isBeforeStage = stage === 'before';
    const heading = isBeforeStage ? 'Step 1 - Before Work' : 'Step 2 - After Work';
    const uploadLabel = 'Upload Photo';
    const submitLabel = isBeforeStage ? 'Start Work' : 'Submit Work';
    const previewHeading = isBeforeStage ? 'Before Photo Preview' : 'After Photo Preview';
    const helperText = isBeforeStage
      ? 'Upload or capture a mandatory before-work photo. Start Work stays disabled until an image is ready.'
      : 'Upload or capture a mandatory after-work photo. Submit Work stays disabled until an image is ready.';

    return (
      <div className="workflow-panel">
        <div className="workflow-header">
          <strong>{heading}</strong>
          <span>{draft.selectedFile ? 'Photo ready' : 'Photo required'}</span>
        </div>

        <div className="workflow-actions">
          <button type="button" className="btn" onClick={() => fileInputRefs.current[draftKey]?.click()}>
            <Upload size={18} />
            {uploadLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void openCamera(task._id, stage)} disabled={draft.cameraLoading}>
            <Camera size={18} />
            {draft.cameraLoading ? 'Preparing Camera...' : 'Open Camera'}
          </button>
          <button
            type="button"
            className="btn btn-success"
            style={{ backgroundColor: 'var(--success)', color: 'white' }}
            disabled={!draft.selectedFile || draft.submitLoading}
            onClick={() => void submitProof(task, stage)}
          >
            {draft.submitLoading ? 'Submitting...' : submitLabel}
          </button>
        </div>

        <input
          ref={(node) => {
            if (node) {
              fileInputRefs.current[draftKey] = node;
            }
          }}
          type="file"
          accept=".jpg,.jpeg,.png,image/png,image/jpeg"
          onChange={(event) => handleFileSelection(task._id, stage, event)}
          style={{ display: 'none' }}
        />

        <p className="workflow-helper">{helperText}</p>

        {draft.cameraOpen && activeCameraKey === draftKey ? (
          <div className="camera-panel">
            <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
            <div className="camera-controls">
              <button type="button" className="btn btn-primary" onClick={() => void captureImage(task._id, stage)}>
                Capture Image
              </button>
              <button type="button" className="btn" onClick={closeActiveCamera}>
                Close Camera
              </button>
            </div>
          </div>
        ) : null}

        {draft.cameraError ? <p className="proof-error">{draft.cameraError}</p> : null}
        {draft.formError ? <p className="proof-error">{draft.formError}</p> : null}

        <div className="selected-proof-panel">
          <strong>{previewHeading}</strong>
          {draft.previewUrl ? (
            <div className="selected-proof-card">
              <img src={draft.previewUrl} alt={previewHeading} className="selected-proof-image" />
              <span>{draft.selectedImageSource === 'camera' ? 'Captured with camera' : 'Uploaded from device'}</span>
              <span>{draft.selectedFileName}</span>
            </div>
          ) : (
            <div className="proof-placeholder">
              <ImageIcon size={18} />
              <p>{isBeforeStage ? 'Upload or capture the before-work photo to continue.' : 'Upload or capture the after-work photo to continue.'}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompletedProofs = (task) => {
    const beforeImage = getProofImage(task, 'before');
    const afterImage = getProofImage(task, 'after');

    return (
      <div className="proof-preview-grid">
        <div className="proof-card">
          <span>Before Work Photo</span>
          {beforeImage ? (
            <img src={resolveApiAssetUrl(beforeImage)} alt={`${task.title} before work proof`} className="proof-preview-image" />
          ) : (
            <div className="proof-placeholder">
              <ImageIcon size={18} />
              <p>No before photo available</p>
            </div>
          )}
        </div>
        <div className="proof-card">
          <span>After Work Photo</span>
          {afterImage ? (
            <img src={resolveApiAssetUrl(afterImage)} alt={`${task.title} after work proof`} className="proof-preview-image" />
          ) : (
            <div className="proof-placeholder">
              <ImageIcon size={18} />
              <p>No after photo available</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div>Loading tasks...</div>;

  return (
    <div className="fade-in worker-page-shell">
      <h2 style={{ marginBottom: '2rem' }}>My Assigned Tasks</h2>
      {tasks.length === 0 ? (
        <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="tasks-grid worker-task-grid">
          {tasks.map((task) => {
            const beforeImage = getProofImage(task, 'before');
            const afterImage = getProofImage(task, 'after');
            const showBeforeSection = isStartableWorkflowStatus(task.status);
            const showAfterSection = task.status === 'in_progress' && Boolean(beforeImage);
            const isBlockedInProgress = task.status === 'in_progress' && !beforeImage;
            const showCompletedProofs = Boolean(beforeImage || afterImage)
              && ['waiting_for_verification', 'verified', 'rework_required', 'completed'].includes(task.status);

            return (
              <div key={task._id} className="glass worker-task-card">
                <div className="worker-task-top">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`status-badge ${task.status}`}>{getStatusLabel(task.status)}</span>
                    <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
                  </div>
                </div>

                <h3 style={{ marginBottom: '0.5rem' }}>{task.title}</h3>
                <p className="worker-task-location">
                  <MapPin size={14} /> {task.location?.address || task.address || 'Location unavailable'}
                </p>

                {showBeforeSection ? renderProofSection(task, 'before') : null}
                {showAfterSection ? renderProofSection(task, 'after') : null}
                {showCompletedProofs ? renderCompletedProofs(task) : null}

                {task.status === 'waiting_for_verification' ? (
                  <div className="workflow-info">
                    After-work proof submitted. Waiting for department head verification.
                  </div>
                ) : null}

                {task.status === 'verified' ? (
                  <div className="workflow-success">
                    Department head verified this work. Admin closure is pending.
                  </div>
                ) : null}

                {task.status === 'rework_required' ? (
                  <div className="workflow-warning">
                    Work not proper, redo required. Upload a fresh before photo and start the task again.
                    {task.verification?.comments ? ` ${task.verification.comments}` : ''}
                  </div>
                ) : null}

                {isBlockedInProgress ? (
                  <div className="workflow-warning">
                    This task cannot be submitted until a valid before-work photo is on record.
                  </div>
                ) : null}

                <div className="worker-task-actions">
                  {['waiting_for_verification', 'verified', 'completed'].includes(task.status) ? (
                    <button className="btn" style={{ flex: 1 }} disabled>
                      {task.status === 'waiting_for_verification'
                        ? 'Under Review'
                        : task.status === 'verified'
                          ? 'Verified'
                          : 'Closed'}
                    </button>
                  ) : null}
                  <Link to={`/issues/${task._id}`} className="btn" style={{ flex: 1, textAlign: 'center', border: '1px solid var(--border)' }}>Details</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .worker-task-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 1.5rem;
        }

        .worker-task-card {
          padding: 1.5rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          display: grid;
          gap: 1rem;
        }

        .worker-task-location {
          color: var(--text-muted);
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .proof-preview-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }

        .proof-card,
        .workflow-panel {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 0.9rem;
          background: var(--bg-main);
        }

        .proof-card span {
          display: block;
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-bottom: 0.6rem;
        }

        .proof-preview-image,
        .selected-proof-image {
          width: 100%;
          border-radius: 14px;
          object-fit: cover;
          height: 124px;
        }

        .proof-placeholder {
          height: 124px;
          border-radius: 14px;
          border: 1px dashed var(--border);
          background: rgba(148, 163, 184, 0.08);
          display: grid;
          place-items: center;
          text-align: center;
          color: var(--text-muted);
          padding: 0.75rem;
        }

        .workflow-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-bottom: 0.85rem;
        }

        .workflow-header span {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .workflow-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .workflow-helper {
          color: var(--text-muted);
          font-size: 0.88rem;
          margin-bottom: 1rem;
        }

        .camera-panel {
          margin-bottom: 1rem;
          border: 1px solid var(--border);
          border-radius: 18px;
          overflow: hidden;
          background: #000;
        }

        .camera-preview {
          width: 100%;
          min-height: 220px;
          max-height: 360px;
          object-fit: cover;
          display: block;
        }

        .camera-controls {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-card);
          flex-wrap: wrap;
        }

        .proof-error {
          margin-bottom: 1rem;
          color: var(--danger);
        }

        .selected-proof-panel {
          display: grid;
          gap: 0.7rem;
        }

        .selected-proof-card {
          display: grid;
          gap: 0.45rem;
        }

        .selected-proof-card span {
          color: var(--text-muted);
          font-size: 0.85rem;
          word-break: break-word;
        }

        .workflow-warning {
          border-radius: 14px;
          padding: 0.9rem 1rem;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          color: #b45309;
          font-size: 0.92rem;
        }

        .workflow-info,
        .workflow-success {
          border-radius: 14px;
          padding: 0.9rem 1rem;
          font-size: 0.92rem;
        }

        .workflow-info {
          background: rgba(14, 165, 233, 0.12);
          border: 1px solid rgba(14, 165, 233, 0.22);
          color: #0369a1;
        }

        .workflow-success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.22);
          color: #047857;
        }

        .worker-task-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 720px) {
          .proof-preview-grid {
            grid-template-columns: 1fr;
          }

          .workflow-actions,
          .camera-controls,
          .worker-task-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default WorkerTasks;
