import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Clock3, Loader, LocateFixed, MapPin, RefreshCw, Send, Upload, XCircle, Maximize, Trash2, Image as ImageIcon
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
const formatDisplayDate = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const formatDisplayTime = (value) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const buildOverlayLabel = (address, timestamp) => `${address} | ${formatDisplayDate(timestamp)} | ${formatDisplayTime(timestamp)}`;
const truncateLabel = (value, maxLength = 84) => value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Unable to read the selected image.')); };
  image.src = objectUrl;
});

const createStampedImage = async (file, metadata) => {
  if (!file) return file;
  try {
    const image = await loadImageFromFile(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return file;

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
    if (!stampedBlob) return file;
    const safeName = file.name?.replace(/\.[^.]+$/, '') || `issue-capture-${Date.now()}`;
    return new File([stampedBlob], `${safeName}-geo.jpg`, { type: 'image/jpeg' });
  } catch(e) {
    console.error(e);
    return file;
  }
};

const geocodeCache = new Map();

const ReportIssue = () => {
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium', category: 'Garbage' });
  
  const [imageState, setImageState] = useState({
    file: null,
    source: '',
    previewUrl: '',
    width: 0,
    height: 0,
    size: 0,
    capturedAt: null
  });

  const [locationState, setLocationState] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    address: '',
    loading: true,
    loadingLabel: 'Detecting GPS...',
    error: '',
    lastUpdated: null
  });

  const [cameraState, setCameraState] = useState({
    open: false,
    loading: false,
    error: ''
  });

  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const locationAbortControllerRef = useRef(null);
  const locationStateRef = useRef(locationState);
  const navigate = useNavigate();

  // Keep ref sync'd to prevent closure traps for image stamping
  useEffect(() => {
    locationStateRef.current = locationState;
  }, [locationState]);

  // Clean up ObjectURL ONLY on unmount (so we never randomly lose image due to rerender)
  useEffect(() => {
    return () => {
      setImageState(prev => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return prev;
      });
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraState(prev => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    return () => {
      cancelLocationTracking();
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (cameraState.open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        setCameraState(prev => ({ ...prev, error: 'Unable to start the camera preview.' }));
      });
    }
  }, [cameraState.open]);

  const updatePreview = (file, source, metadata) => {
    setImageState(prev => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        file,
        source,
        previewUrl: file ? URL.createObjectURL(file) : '',
        width: metadata?.width || 0,
        height: metadata?.height || 0,
        size: metadata?.size || 0,
        capturedAt: metadata?.capturedAt || null
      };
    });
  };

  const removeImage = () => {
    updatePreview(null, '', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const reverseGeocodeCoordinates = async (lat, lng) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (geocodeCache.has(key)) return geocodeCache.get(key);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    if (process.env.NODE_ENV === 'development') {
      console.log('GPS Coordinates:', { lat, lng });
      console.log('Reverse Geocoding Request:', url);
    }

    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'CivicHub/1.0' } });
      if (!response.ok) throw new Error('Failed to fetch address');
      const data = await response.json();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', data);
        console.log('display_name:', data?.display_name);
      }

      const address = data?.display_name || formatCoordinates(lat, lng);
      geocodeCache.set(key, address);
      return address;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Reverse geocoding failed', error);
      }
      return 'Unable to fetch readable address.';
    }
  };

  const cancelLocationTracking = () => {
    if (locationAbortControllerRef.current) {
      locationAbortControllerRef.current.abort();
      locationAbortControllerRef.current = null;
    }
  };

  const detectLocation = async ({ restart = false } = {}) => {
    if (!navigator.geolocation) {
      setLocationState(prev => ({ ...prev, loading: false, error: 'Location is not supported on this device.' }));
      return;
    }

    cancelLocationTracking();
    const controller = new AbortController();
    locationAbortControllerRef.current = controller;

    setLocationState(prev => ({ ...prev, loading: true, loadingLabel: 'Detecting Location...', error: '' }));

    let bestAccuracy = Infinity;
    let locationTimer = null;
    let watchId = null;

    const stopWatching = () => {
       if (locationAbortControllerRef.current === controller) {
           locationAbortControllerRef.current.abort();
           locationAbortControllerRef.current = null;
       }
    };

    controller.signal.addEventListener('abort', () => {
       if (watchId !== null) navigator.geolocation.clearWatch(watchId);
       if (locationTimer) clearTimeout(locationTimer);
    });

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (controller.signal.aborted) return;
        const { latitude, longitude, accuracy } = position.coords;
        const acc = Number(accuracy);

        if (acc < bestAccuracy) {
           const isFirst = bestAccuracy === Infinity;
           bestAccuracy = acc;
           
           setLocationState(prev => ({
             ...prev,
             lat: Number(latitude),
             lng: Number(longitude),
             accuracy: Number.isFinite(acc) ? acc : null,
             loading: acc > 100,
             loadingLabel: isFirst ? 'Location Found' : 'Updating Location...'
           }));

           if (acc <= 100) {
              setLocationState(prev => ({ ...prev, loading: false }));
              stopWatching();
           }
        }
      },
      (error) => {
        if (controller.signal.aborted) return;
        if (bestAccuracy !== Infinity) {
           setLocationState(prev => ({ ...prev, loading: false }));
           stopWatching();
        } else {
           setLocationState(prev => ({
             ...prev, loading: false, loadingLabel: '',
             error: error.code === error.PERMISSION_DENIED ? 'Location permission was denied. You can retry or enter an address manually.' : 'Unable to detect an accurate location right now.'
           }));
           stopWatching();
        }
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    locationTimer = setTimeout(() => {
       if (controller.signal.aborted) return;
       if (bestAccuracy !== Infinity) {
          setLocationState(prev => ({ ...prev, loading: false }));
       } else {
          setLocationState(prev => ({ ...prev, loading: false, loadingLabel: '', error: 'GPS request timed out. You can retry.' }));
       }
       stopWatching();
    }, 10000);
  };

  useEffect(() => {
    void detectLocation({ restart: true });
  }, []);

  useEffect(() => {
    const lat = locationState.lat;
    const lng = locationState.lng;

    if (lat !== null && lng !== null && !locationState.loading) {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      
      let isMounted = true;
      const fetchAddress = async () => {
        setLocationState(prev => ({ ...prev, loadingLabel: prev.address ? 'Updating Address...' : 'Fetching Address...' }));
        const address = await reverseGeocodeCoordinates(lat, lng);
        if (isMounted) {
          setLocationState(prev => ({ 
            ...prev, 
            address: address !== 'Unable to fetch readable address.' || prev.address === '' ? address : prev.address,
            loadingLabel: 'Address Ready'
          }));
        }
      };

      if (!geocodeCache.has(key)) {
         const timeoutId = setTimeout(() => fetchAddress(), 750);
         return () => {
           isMounted = false;
           clearTimeout(timeoutId);
         };
      } else {
         fetchAddress();
      }
    }
  }, [locationState.lat, locationState.lng, locationState.loading]);

  const processImageWithMetadata = async (file, source) => {
    try {
      const img = await loadImageFromFile(file);
      const width = img.width;
      const height = img.height;
      const capturedAt = new Date().toISOString();
      const currentLoc = locationStateRef.current;
      const address = currentLoc?.address || 'Location unavailable';

      let finalFile = file;
      if (currentLoc?.lat && currentLoc?.lng) {
        finalFile = await createStampedImage(file, { address, capturedAt });
      }

      updatePreview(finalFile, source, { width, height, size: finalFile.size, capturedAt });
    } catch (error) {
      console.error('Failed to process image', error);
      updatePreview(file, source, { size: file.size });
    }
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPG, PNG, and WEBP images are allowed.');
      event.target.value = '';
      return;
    }
    stopCamera();
    setCameraState(prev => ({ ...prev, error: '' }));
    await processImageWithMetadata(file, 'upload');
    event.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera();
      await processImageWithMetadata(file, 'upload');
    }
  };

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            stopCamera();
            await processImageWithMetadata(file, 'upload');
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [stopCamera]);

  const openCamera = async () => {
    if (!window.isSecureContext) {
      setCameraState(prev => ({ ...prev, error: 'Camera requires HTTPS or localhost.' }));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState(prev => ({ ...prev, error: 'Camera access is not available.' }));
      return;
    }
    try {
      setCameraState(prev => ({ ...prev, loading: true, error: '' }));
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraState(prev => ({ ...prev, open: true }));
    } catch (error) {
      setCameraState(prev => ({ ...prev, error: error.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'Unable to access the camera.' }));
    } finally {
      setCameraState(prev => ({ ...prev, loading: false }));
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
      setCameraState(prev => ({ ...prev, error: 'Unable to capture image.' }));
      return;
    }
    const capturedFile = new File([blob], `issue-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    await processImageWithMetadata(capturedFile, 'camera');
    stopCamera();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) return alert('Please enter a title.');
    if (!formData.description.trim()) return alert('Please enter a description.');
    if (!formData.category) return alert('Please select a category.');
    if (!imageState.file) return alert('Please attach an image. This is required.');
    if (!locationState.lat || !locationState.lng) return alert('Location is required. Please wait for GPS or input manually.');
    if (!locationState.address.trim()) return alert('Please provide a readable address.');

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('priority', formData.priority);
      payload.append('category', formData.category);
      payload.append('location', JSON.stringify({ lat: locationState.lat, lng: locationState.lng, address: locationState.address }));
      if (imageState.file) payload.append('imageFile', imageState.file);
      if (imageState.capturedAt) payload.append('imageContext', JSON.stringify({ capturedAt: imageState.capturedAt, width: imageState.width, height: imageState.height }));

      await api.post('/complaints', payload, { headers: { 'Content-Type': 'multipart/form-data' } });

      alert('Issue reported successfully.');
      setFormData({ title: '', description: '', priority: 'medium', category: 'Garbage' });
      removeImage();
      setLocationState(prev => ({ ...prev, lat: null, lng: null, accuracy: null, address: '', loading: true, loadingLabel: 'Detecting GPS...', error: '', lastUpdated: null }));
      void detectLocation({ restart: true });
      navigate('/public/user/complaints');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to report issue. You can try submitting again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in report-issue-page" style={{ maxWidth: '960px' }}>
      <div className="glass report-card">
        <h2>Report New Issue</h2>
        <p className="report-subtitle">Capture the issue live with your camera or upload an image if the camera is unavailable.</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Issue Title</label>
            <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Large pothole on Main St" required />
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea rows="4" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the issue in detail..." required style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
          </div>

          <div className="field-grid">
            <div className="input-group">
              <label>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="media-panel" onDragOver={handleDragOver} onDrop={handleDrop}>
            <div className="panel-heading">
              <div>
                <h3>Issue Photo</h3>
                <p>Camera captures and uploaded photos are stamped with address and time. You can drag and drop or paste an image here.</p>
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-primary" onClick={openCamera} disabled={cameraState.loading}>
                {cameraState.loading ? <Loader className="spin" size={18} /> : <Camera size={18} />}
                Open Camera
              </button>
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                Upload Image
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg,image/webp" onChange={handleFileSelection} style={{ display: 'none' }} />

            <div className="camera-grid">
              <div className="camera-box glass">
                {cameraState.open ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
                    <div className="camera-controls">
                      <button type="button" className="btn btn-primary" onClick={captureImage}>
                        <Camera size={18} /> Capture Image
                      </button>
                      <button type="button" className="btn" onClick={stopCamera}>
                        <XCircle size={18} /> Close Camera
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="camera-placeholder">
                    <Camera size={28} />
                    <span>{cameraState.error || 'Open the camera to capture a live issue photo.'}</span>
                  </div>
                )}
              </div>

              <div className="camera-box glass">
                {imageState.previewUrl ? (
                  <div className="captured-preview" style={{ padding: '0.75rem', justifyContent: 'flex-start' }}>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <img src={imageState.previewUrl} alt="Selected issue preview" style={{ maxHeight: '200px', objectFit: 'contain', background: '#0b1220', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => window.open(imageState.previewUrl, '_blank')} className="btn" style={{ padding: '0.4rem', borderRadius: '50%', background: 'var(--bg-main)' }} title="Full Screen"><Maximize size={16} /></button>
                        </div>
                    </div>
                    <div className="preview-copy" style={{ textAlign: 'left', width: '100%', marginTop: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ImageIcon size={16} /> 
                        {imageState.source === 'camera' ? 'Captured Image' : 'Uploaded Image'}
                      </strong>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        {imageState.file?.name} • {(imageState.size / 1024).toFixed(1)} KB
                      </p>
                      {imageState.width > 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Dimensions: {imageState.width}x{imageState.height}</p>}
                      {imageState.capturedAt && (
                        <div className="photo-meta" style={{ marginTop: '0.5rem' }}>
                          <span><Clock3 size={14} /> {formatDisplayDate(imageState.capturedAt)} {formatDisplayTime(imageState.capturedAt)}</span>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '0.5rem' }}><RefreshCw size={14}/> Replace</button>
                        <button type="button" className="btn" onClick={removeImage} style={{ flex: 1, padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger-alpha)' }}><Trash2 size={14}/> Remove</button>
                      </div>
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
                <p>We track your GPS to find your precise readable address. Ensure location is enabled.</p>
              </div>
              <button type="button" className="btn" onClick={() => void detectLocation({ restart: true })} disabled={locationState.loading}>
                {locationState.loading ? <Loader className="spin" size={18} /> : <RefreshCw size={18} />} Retry GPS
              </button>
            </div>

            <div className="location-status glass">
              <div className="status-icon">
                {locationState.loading ? <Loader className="spin" size={20} /> : <LocateFixed size={20} />}
              </div>
              <div>
                <strong>
                  {locationState.address 
                      ? formatAddressHeadline(locationState.address) 
                      : (locationState.loadingLabel || 'Detecting Location...')}
                </strong>
                <p>
                  {locationState.error || (locationState.loading
                      ? Number.isFinite(locationState.accuracy)
                        ? `${locationState.loadingLabel} (Accuracy: ${formatAccuracyMeters(locationState.accuracy)})`
                        : locationState.loadingLabel
                      : Number.isFinite(locationState.lat) && Number.isFinite(locationState.lng)
                        ? `Latitude ${locationState.lat.toFixed(5)}, Longitude ${locationState.lng.toFixed(5)}`
                        : 'Grant location permission to attach coordinates automatically.')}
                </p>
                {Number.isFinite(locationState.accuracy) && !locationState.loading && (
                  <p className="accuracy-readout">{`Final Accuracy: ${formatAccuracyMeters(locationState.accuracy)}`}</p>
                )}
              </div>
            </div>

            <div className="coordinate-grid">
              <div className="input-group">
                <label>Latitude</label>
                <input type="number" step="any" value={locationState.lat ?? ''} onChange={(e) => setLocationState(prev => ({ ...prev, lat: e.target.value === '' ? null : Number(e.target.value), accuracy: null, error: '' }))} placeholder="Auto-detected latitude" />
              </div>
              <div className="input-group">
                <label>Longitude</label>
                <input type="number" step="any" value={locationState.lng ?? ''} onChange={(e) => setLocationState(prev => ({ ...prev, lng: e.target.value === '' ? null : Number(e.target.value), accuracy: null, error: '' }))} placeholder="Auto-detected longitude" />
              </div>
            </div>

            <div className="input-group">
              <label>Full Address / Manual Override</label>
              <div className="location-input-wrap">
                <MapPin size={18} />
                <input value={locationState.address} onChange={(e) => setLocationState(prev => ({ ...prev, address: e.target.value, error: '' }))} placeholder="Readable location address" style={{ flex: 1 }} />
              </div>
            </div>
          </div>

          <button className="btn btn-primary submit-btn" disabled={loading}>
            {loading ? <Loader className="spin" size={20} /> : <><Send size={18} /> Submit Report</>}
          </button>
        </form>
      </div>

      <style>{`
        .report-card { padding: 3rem; border-radius: var(--radius); }
        .report-subtitle { color: var(--text-muted); margin: 0.75rem 0 2rem; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
        .coordinate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .media-panel, .location-panel {
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.5rem;
          background: var(--bg-main);
          margin-bottom: 1.5rem;
          transition: border-color 0.2s ease;
        }
        .media-panel:hover { border-color: rgba(79, 70, 229, 0.4); }
        .panel-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 1.25rem; }
        .panel-heading p { color: var(--text-muted); margin-top: 0.35rem; }
        .action-row { display: flex; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .camera-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1rem; }
        .camera-box { min-height: 280px; border: 1px solid var(--border); border-radius: 18px; overflow: hidden; background: var(--bg-card); }
        .camera-preview { width: 100%; height: 100%; min-height: 220px; object-fit: cover; display: block; background: #000; }
        .camera-controls { display: flex; gap: 1rem; padding: 1rem; flex-wrap: wrap; }
        .camera-placeholder, .captured-preview {
          min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.75rem; text-align: center; color: var(--text-muted); padding: 1.5rem;
        }
        .captured-preview img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; }
        .preview-copy p { margin-top: 0.25rem; word-break: break-word; }
        .photo-meta { margin-top: 0.9rem; display: grid; gap: 0.45rem; text-align: left; }
        .photo-meta span { display: flex; align-items: center; gap: 0.45rem; color: var(--text-main); font-size: 0.88rem; }
        .location-status { display: flex; gap: 1rem; align-items: flex-start; padding: 1rem; border-radius: 16px; margin-bottom: 1rem; }
        .location-status p { color: var(--text-muted); margin-top: 0.3rem; }
        .accuracy-readout { color: var(--text-main); font-weight: 600; }
        .status-icon { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(79, 70, 229, 0.08); color: var(--primary); flex-shrink: 0; }
        .location-input-wrap { display: flex; align-items: center; gap: 0.75rem; padding: 0 1rem; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-card); }
        .location-input-wrap input { border: none; background: transparent; box-shadow: none; padding-left: 0; width: 100%; }
        .submit-btn { width: 100%; justify-content: center; margin-top: 2rem; }
        @media (max-width: 720px) {
          .report-card { padding: 1.5rem; }
          .field-grid, .coordinate-grid, .camera-grid { grid-template-columns: 1fr; }
          .panel-heading, .location-status, .camera-controls { flex-direction: column; }
          .panel-heading > .btn, .camera-controls > .btn, .action-row > .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
};

export default ReportIssue;
