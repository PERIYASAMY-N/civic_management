import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const CameraCapture = ({ onCapture, onCancel, fallbackInputRef }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError('');
    } catch (err) {
      console.error('Camera access failed:', err);
      // Fallback to native input if WebRTC fails
      if (fallbackInputRef?.current) {
        fallbackInputRef.current.click();
        onCancel();
      } else {
        setError('Camera access denied or unavailable.');
      }
    }
  }, [fallbackInputRef, onCancel]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhoto({ file, preview: URL.createObjectURL(file) });
        // Stop stream after capture to save battery
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      }
    }, 'image/jpeg', 0.85);
  };

  const handleRetake = () => {
    if (photo?.preview) {
      URL.revokeObjectURL(photo.preview);
    }
    setPhoto(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (photo?.file) {
      onCapture(photo.file);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn" onClick={onCancel}>Close</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#000', padding: '1rem', borderRadius: '12px', overflow: 'hidden' }}>
      {!photo ? (
        <>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#111', borderRadius: '8px', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
            <button
              onClick={onCancel}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '999px', border: 'none', background: '#333', color: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={capturePhoto}
              style={{ padding: '0.75rem 2rem', borderRadius: '999px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Camera size={20} />
              Capture
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#111', borderRadius: '8px', overflow: 'hidden' }}>
            <img src={photo.preview} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={handleRetake}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '999px', border: 'none', background: '#333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={18} />
              Retake
            </button>
            <button
              onClick={handleConfirm}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '999px', border: 'none', background: 'var(--success)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <CheckCircle2 size={18} />
              Confirm
            </button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CameraCapture;
