import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Clock3,
  Loader,
  LocateFixed,
  MapPin,
  RefreshCw,
  Send,
  Upload,
  XCircle
} from 'lucide-react';
import api from '../api';
import {
  LOCATION_TARGET_ACCURACY_METERS,
  formatAccuracyMeters,
  watchForAccuratePosition
} from '../utils/geolocation';

const categories = ['Road Damage', 'Garbage', 'Water Leakage', 'Street Light', 'Other'];

const formatCoordinates = (lat, lng) => `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`;

const formatAddressHeadline = (address) => `📍 Location: ${address}`;

const formatDisplayDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
}).format(new Date(value));

const formatDisplayTime = (value) => new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(value));

const buildOverlayLabel = (address, timestamp) => (
  `${address} | ${formatDisplayDate(timestamp)} | ${formatDisplayTime(timestamp)}`
);

const truncateLabel = (value, maxLength = 84) => (
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
);

const hasAcceptedLocation = (location) => (
  Number.isFinite(location?.lat)
  && Number.isFinite(location?.lng)
  && Number.isFinite(Number(location?.accuracy))
  && Number(location.accuracy) <= LOCATION_TARGET_ACCURACY_METERS
  && !location?.loading
);

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Unable to read the selected image.'));
  };

  image.src = objectUrl;
});

const createStampedImage = async (file, metadata) => {
  if (!file) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const padding = Math.max(24, Math.round(canvas.width * 0.02));
  const footerHeight = Math.max(92, Math.round(canvas.height * 0.14));
  const lineOne = truncateLabel(metadata?.address || 'Location unavailable');
  const lineTwo = `${formatDisplayDate(metadata?.capturedAt || Date.now())} | ${formatDisplayTime(metadata?.capturedAt || Date.now())}`;

  context.save();
  context.fillStyle = 'rgba(11, 18, 32, 0.72)';
  context.fillRect(0, canvas.height - footerHeight, canvas.width, footerHeight);

  context.fillStyle = '#ffffff';
  context.textBaseline = 'top';
  context.font = `600 ${Math.max(18, Math.round(canvas.width * 0.023))}px sans-serif`;
  context.fillText(lineOne, padding, canvas.height - footerHeight + padding * 0.55);

  context.font = `500 ${Math.max(15, Math.round(canvas.width * 0.018))}px sans-serif`;
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.fillText(lineTwo, padding, canvas.height - footerHeight + padding * 1.75);
  context.restore();

  const stampedBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!stampedBlob) {
    return file;
  }

  const safeName = file.name?.replace(/\.[^.]+$/, '') || `issue-capture-${Date.now()}`;
  return new File([stampedBlob], `${safeName}-geo.jpg`, { type: 'image/jpeg' });
};

const ReportIssue = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'Garbage'
  });
  const [imageFile, setImageFile] = useState(null);
  const [imageSource, setImageSource] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [photoContext, setPhotoContext] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [locationState, setLocationState] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    address: '',
    loading: true,
    loadingLabel: 'Detecting accurate location...',
    error: ''
  });
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const locationAbortControllerRef = useRef(null);
  const locationPromiseRef = useRef(null);
  const navigate = useNavigate();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const updatePreview = (file, source, metadata) => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(file);
    setImageSource(source);
    setPhotoContext(metadata || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const reverseGeocodeCoordinates = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      const data = await response.json();
      console.log('Address API:', data);

      if (!response.ok) {
        throw new Error('Failed to fetch address from reverse geocoding API');
      }

      return data?.display_name || formatCoordinates(lat, lng);
    } catch (error) {
      console.error('Reverse geocoding failed', error);
      return formatCoordinates(lat, lng);
    }
  };

  const updateLocationState = (nextValue) => {
    setLocationState((current) => ({
      ...current,
      ...nextValue
    }));
  };

  const cancelLocationTracking = () => {
    if (locationAbortControllerRef.current) {
      locationAbortControllerRef.current.abort();
      locationAbortControllerRef.current = null;
    }

    locationPromiseRef.current = null;
  };

  const detectLocation = async ({ restart = false } = {}) => {
    if (!navigator.geolocation) {
      const unsupportedState = {
        lat: null,
        lng: null,
        accuracy: null,
        address: '',
        loading: false,
        loadingLabel: '',
        error: 'Location is not supported on this device.'
      };
      setLocationState(unsupportedState);
      return unsupportedState;
    }

    if (!restart && locationPromiseRef.current) {
      return locationPromiseRef.current;
    }

    cancelLocationTracking();

    const controller = new AbortController();
    locationAbortControllerRef.current = controller;

    updateLocationState({
      lat: null,
      lng: null,
      accuracy: null,
      address: '',
      loading: true,
      loadingLabel: 'Detecting accurate location...',
      error: ''
    });

    let trackingPromise;
    trackingPromise = (async () => {
      try {
        const position = await watchForAccuratePosition({
          targetAccuracy: LOCATION_TARGET_ACCURACY_METERS,
          signal: controller.signal,
          onProgress: (nextPosition) => {
            const { latitude, longitude, accuracy } = nextPosition.coords;
            const normalizedAccuracy = Number(accuracy);

            updateLocationState({
              lat: Number(latitude),
              lng: Number(longitude),
              accuracy: Number.isFinite(normalizedAccuracy) ? normalizedAccuracy : null,
              address: '',
              loading: true,
              loadingLabel: 'Detecting accurate location...',
              error: ''
            });
          }
        });

        if (controller.signal.aborted) {
          return null;
        }

        const { latitude, longitude, accuracy } = position.coords;
        const lat = Number(latitude);
        const lng = Number(longitude);
        const normalizedAccuracy = Number(accuracy);

        updateLocationState({
          lat,
          lng,
          accuracy: Number.isFinite(normalizedAccuracy) ? normalizedAccuracy : null,
          address: '',
          loading: true,
          loadingLabel: 'Fetching full address...',
          error: ''
        });

        const address = await reverseGeocodeCoordinates(lat, lng);
        if (controller.signal.aborted) {
          return null;
        }

        const resolvedLocation = {
          lat,
          lng,
          accuracy: Number.isFinite(normalizedAccuracy) ? normalizedAccuracy : null,
          address: address || formatCoordinates(lat, lng),
          loading: false,
          loadingLabel: '',
          error: ''
        };

        setLocationState(resolvedLocation);
        return resolvedLocation;
      } catch (error) {
        if (error?.name === 'AbortError') {
          return null;
        }

        const fallbackState = {
          lat: null,
          lng: null,
          accuracy: null,
          address: '',
          loading: false,
          loadingLabel: '',
          error: error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can retry or enter an address manually.'
            : 'Unable to detect an accurate location right now.'
        };

        setLocationState(fallbackState);
        return fallbackState;
      } finally {
        if (locationAbortControllerRef.current === controller) {
          locationAbortControllerRef.current = null;
        }

        if (locationPromiseRef.current === trackingPromise) {
          locationPromiseRef.current = null;
        }
      }
    })();

    locationPromiseRef.current = trackingPromise;
    return trackingPromise;
  };

  const resolveLocationSnapshot = async () => {
    if (hasAcceptedLocation(locationState)) {
      if (
        locationState.address
        && locationState.address !== formatCoordinates(locationState.lat, locationState.lng)
      ) {
        return {
          lat: locationState.lat,
          lng: locationState.lng,
          accuracy: locationState.accuracy,
          address: locationState.address
        };
      }

      return {
        lat: locationState.lat,
        lng: locationState.lng,
        accuracy: locationState.accuracy,
        address: locationState.address || formatCoordinates(locationState.lat, locationState.lng)
      };
    }

    const detected = await detectLocation();
    return hasAcceptedLocation(detected)
      ? detected
      : {
          lat: null,
          lng: null,
          accuracy: null,
          address: ''
        };
  };

  useEffect(() => {
    void detectLocation({ restart: true });

    return () => {
      cancelLocationTracking();
      stopCamera();
    };
  }, []);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        setCameraError('Unable to start the camera preview.');
      });
    }
  }, [cameraOpen]);

  const handleAddressChange = (event) => {
    const value = event.target.value;
    setLocationState((current) => ({
      ...current,
      address: value,
      error: ''
    }));
  };

  const handleCoordinateChange = (key, value) => {
    setLocationState((current) => ({
      ...current,
      [key]: value === '' ? null : Number(value),
      accuracy: null,
      error: ''
    }));
  };

  const processImageWithMetadata = async (file, source) => {
    const locationSnapshot = await resolveLocationSnapshot();
    const capturedAt = new Date().toISOString();
    const address = locationSnapshot?.address || 'Location unavailable';
    const overlayLabel = buildOverlayLabel(address, capturedAt);

    try {
      const stampedFile = await createStampedImage(file, {
        address,
        capturedAt
      });

      updatePreview(stampedFile, source, {
        source,
        capturedAt,
        lat: locationSnapshot?.lat,
        lng: locationSnapshot?.lng,
        address,
        overlayLabel
      });
    } catch (error) {
      console.error('Failed to apply geo-tag overlay', error);
      updatePreview(file, source, {
        source,
        capturedAt,
        lat: locationSnapshot?.lat,
        lng: locationSnapshot?.lng,
        address,
        overlayLabel
      });
    }
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValidType = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
    if (!isValidType) {
      alert('Only JPG and PNG images are allowed.');
      event.target.value = '';
      return;
    }

    stopCamera();
    setCameraError('');

    await processImageWithMetadata(file, 'upload');
    event.target.value = '';
  };

  const openCamera = async () => {
    if (!window.isSecureContext) {
      setCameraError('Camera access requires a secure context such as HTTPS or localhost.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      return;
    }

    try {
      setCameraLoading(true);
      setCameraError('');
      stopCamera();
      void resolveLocationSnapshot();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can use file upload instead.'
          : 'Unable to access the camera. You can use file upload instead.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const captureImage = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      setCameraError('Unable to capture an image from the camera preview.');
      return;
    }

    const capturedFile = new File([blob], `issue-capture-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });

    await processImageWithMetadata(capturedFile, 'camera');
    stopCamera();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (!Number.isFinite(locationState.lat) || !Number.isFinite(locationState.lng)) {
        alert('Please allow location access or enter valid latitude and longitude before submitting.');
        return;
      }

      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('priority', formData.priority);
      payload.append('category', formData.category);
      payload.append('location', JSON.stringify({
        lat: locationState.lat,
        lng: locationState.lng,
        address: locationState.address || formatCoordinates(locationState.lat, locationState.lng)
      }));

      if (imageFile) {
        payload.append('imageFile', imageFile);
      }

      if (photoContext) {
        payload.append('imageContext', JSON.stringify(photoContext));
      }

      await api.post('/complaints', payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Issue reported successfully.');
      navigate('/issues');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to report issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in report-issue-page" style={{ maxWidth: '960px' }}>
      <div className="glass report-card">
        <h2>Report New Issue</h2>
        <p className="report-subtitle">
          Capture the issue live with your camera or upload an image if the camera is unavailable.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Issue Title</label>
            <input
              value={formData.title}
              onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              placeholder="e.g. Large pothole on Main St"
              required
            />
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea
              rows="4"
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              placeholder="Describe the issue in detail..."
              required
              style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="field-grid">
            <div className="input-group">
              <label>Category</label>
              <select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Priority</label>
              <select value={formData.priority} onChange={(event) => setFormData({ ...formData, priority: event.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="media-panel">
            <div className="panel-heading">
              <div>
                <h3>Issue Photo</h3>
                <p>Camera captures and uploaded photos are stamped with address and time when location is available.</p>
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-primary" onClick={openCamera} disabled={cameraLoading}>
                {cameraLoading ? <Loader className="spin" size={18} /> : <Camera size={18} />}
                Open Camera
              </button>
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                Upload Image
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/png,image/jpeg"
              onChange={handleFileSelection}
              style={{ display: 'none' }}
            />

            <div className="camera-grid">
              <div className="camera-box glass">
                {cameraOpen ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
                    <div className="camera-controls">
                      <button type="button" className="btn btn-primary" onClick={captureImage}>
                        <Camera size={18} />
                        Capture Image
                      </button>
                      <button type="button" className="btn" onClick={stopCamera}>
                        <XCircle size={18} />
                        Close Camera
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="camera-placeholder">
                    <Camera size={28} />
                    <span>{cameraError || 'Open the camera to capture a live issue photo.'}</span>
                  </div>
                )}
              </div>

              <div className="camera-box glass">
                {previewUrl ? (
                  <div className="captured-preview">
                    <img src={previewUrl} alt="Selected issue preview" />
                    <div className="preview-copy">
                      <strong>{imageSource === 'camera' ? 'Captured image ready' : 'Uploaded image ready'}</strong>
                      <p>{imageFile?.name}</p>
                      {photoContext ? (
                        <div className="photo-meta">
                          <span><MapPin size={14} /> {photoContext.address}</span>
                          <span><Clock3 size={14} /> {formatDisplayDate(photoContext.capturedAt)} | {formatDisplayTime(photoContext.capturedAt)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="camera-placeholder">
                    <Upload size={28} />
                    <span>Your captured or uploaded image preview will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="location-panel">
            <div className="panel-heading">
              <div>
                <h3>Location</h3>
                <p>We keep tracking your GPS until it reaches 30 meters or better, then convert it into a readable address.</p>
              </div>
              <button type="button" className="btn" onClick={() => void detectLocation({ restart: true })}>
                {locationState.loading ? <Loader className="spin" size={18} /> : <RefreshCw size={18} />}
                Retry
              </button>
            </div>

            <div className="location-status glass">
              <div className="status-icon">
                {locationState.loading ? <Loader className="spin" size={20} /> : <LocateFixed size={20} />}
              </div>
              <div>
                <strong>
                  {locationState.loading
                    ? locationState.loadingLabel || 'Detecting accurate location...'
                    : locationState.address
                      ? formatAddressHeadline(locationState.address)
                      : 'Location not detected yet'}
                </strong>
                <p>
                  {locationState.error
                    || (locationState.loading
                      ? Number.isFinite(locationState.accuracy)
                        ? `Current GPS accuracy: ${formatAccuracyMeters(locationState.accuracy)}. Waiting for ${LOCATION_TARGET_ACCURACY_METERS} m or better.`
                        : `Waiting for GPS to reach ${LOCATION_TARGET_ACCURACY_METERS} m or better.`
                      : Number.isFinite(locationState.lat) && Number.isFinite(locationState.lng)
                        ? `Latitude ${locationState.lat.toFixed(5)}, Longitude ${locationState.lng.toFixed(5)}`
                        : 'Grant location permission to attach coordinates automatically.')}
                </p>
                {Number.isFinite(locationState.accuracy) ? (
                  <p className="accuracy-readout">{`Accuracy: ${formatAccuracyMeters(locationState.accuracy)}`}</p>
                ) : null}
              </div>
            </div>

            <div className="coordinate-grid">
              <div className="input-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationState.lat ?? ''}
                  onChange={(event) => handleCoordinateChange('lat', event.target.value)}
                  placeholder="Auto-detected latitude"
                />
              </div>
              <div className="input-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationState.lng ?? ''}
                  onChange={(event) => handleCoordinateChange('lng', event.target.value)}
                  placeholder="Auto-detected longitude"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Full Address / Manual Override</label>
              <div className="location-input-wrap">
                <MapPin size={18} />
                <input
                  value={locationState.address}
                  onChange={handleAddressChange}
                  placeholder="Readable location address"
                />
              </div>
            </div>
          </div>

          <button className="btn btn-primary submit-btn" disabled={loading || locationState.loading}>
            {loading ? <Loader className="spin" size={20} /> : <><Send size={18} /> Submit Report</>}
          </button>
        </form>
      </div>

      <style>{`
        .report-card {
          padding: 3rem;
          border-radius: var(--radius);
        }

        .report-subtitle {
          color: var(--text-muted);
          margin: 0.75rem 0 2rem;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .coordinate-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .media-panel,
        .location-panel {
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.5rem;
          background: var(--bg-main);
          margin-bottom: 1.5rem;
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .panel-heading p {
          color: var(--text-muted);
          margin-top: 0.35rem;
        }

        .action-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .camera-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 1rem;
        }

        .camera-box {
          min-height: 280px;
          border: 1px solid var(--border);
          border-radius: 18px;
          overflow: hidden;
          background: var(--bg-card);
        }

        .camera-preview {
          width: 100%;
          height: 100%;
          min-height: 220px;
          object-fit: cover;
          display: block;
          background: #000;
        }

        .camera-controls {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          flex-wrap: wrap;
        }

        .camera-placeholder,
        .captured-preview {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          text-align: center;
          color: var(--text-muted);
          padding: 1.5rem;
        }

        .captured-preview img {
          width: 100%;
          max-height: 220px;
          object-fit: cover;
          border-radius: 16px;
        }

        .preview-copy p {
          margin-top: 0.25rem;
          word-break: break-word;
        }

        .photo-meta {
          margin-top: 0.9rem;
          display: grid;
          gap: 0.45rem;
          text-align: left;
        }

        .photo-meta span {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-main);
          font-size: 0.88rem;
        }

        .location-status {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 1rem;
          border-radius: 16px;
          margin-bottom: 1rem;
        }

        .location-status p {
          color: var(--text-muted);
          margin-top: 0.3rem;
        }

        .accuracy-readout {
          color: var(--text-main);
          font-weight: 600;
        }

        .status-icon {
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(79, 70, 229, 0.08);
          color: var(--primary);
          flex-shrink: 0;
        }

        .location-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 1rem;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
        }

        .location-input-wrap input {
          border: none;
          background: transparent;
          box-shadow: none;
          padding-left: 0;
        }

        .submit-btn {
          width: 100%;
          justify-content: center;
          margin-top: 2rem;
        }

        @media (max-width: 720px) {
          .report-card {
            padding: 1.5rem;
          }

          .field-grid,
          .coordinate-grid,
          .camera-grid {
            grid-template-columns: 1fr;
          }

          .panel-heading,
          .location-status,
          .camera-controls {
            flex-direction: column;
          }

          .panel-heading > .btn,
          .camera-controls > .btn,
          .action-row > .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportIssue;
