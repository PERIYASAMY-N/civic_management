export const getCameraStream = async ({ facingMode = 'environment' } = {}) => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera is not supported in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
    }
    if (error.name === 'NotFoundError') {
      throw new Error('No camera hardware found on this device.');
    }
    
    // Fallback: If 'environment' camera is requested but not available (common on desktops), 
    // try to get any available camera.
    if (facingMode === 'environment') {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true, // Just any video
          audio: false
        });
      } catch (fallbackError) {
        throw new Error('Camera access failed.');
      }
    }
    
    throw new Error('Camera access failed: ' + error.message);
  }
};

export const captureImageFromStream = (videoElement) => {
  if (!videoElement || videoElement.videoWidth === 0) return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  // Return base64 encoded image
  return canvas.toDataURL('image/jpeg', 0.8);
};

export const dataURItoBlob = (dataURI) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};
