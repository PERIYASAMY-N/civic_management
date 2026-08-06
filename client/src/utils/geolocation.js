export const LOCATION_TARGET_ACCURACY_METERS = 30;

export const formatAccuracyMeters = (accuracy) => {
  const normalizedAccuracy = Number(accuracy);

  if (!Number.isFinite(normalizedAccuracy)) {
    return '';
  }

  return `${Math.round(normalizedAccuracy)} m`;
};

export const watchForAccuratePosition = ({
  targetAccuracy = LOCATION_TARGET_ACCURACY_METERS,
  maxWaitTimeMs = 15000,
  onProgress,
  signal
} = {}) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Location is not supported in this browser.'));
    return;
  }

  let watchId = null;
  let settled = false;
  let bestPosition = null;
  let timeoutId = null;

  const cleanup = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
  };

  const finalizeResolve = (position, status) => {
    if (settled) return;
    settled = true;
    cleanup();
    position.status = status; // Attach status for UI
    resolve(position);
  };

  const finalizeReject = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  };

  const handleAbort = () => {
    finalizeReject(new DOMException('Location tracking was cancelled.', 'AbortError'));
  };

  if (signal?.aborted) {
    handleAbort();
    return;
  }

  if (signal) {
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  // Set timeout to return best position after maxWaitTimeMs
  timeoutId = setTimeout(() => {
    if (bestPosition) {
      finalizeResolve(bestPosition, 'TIMEOUT_FALLBACK');
    } else {
      finalizeReject(new Error('Location request timed out. Please check your GPS signal.'));
    }
  }, maxWaitTimeMs);

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const accuracy = Number(position.coords.accuracy);
      const isFirst = !bestPosition;
      
      if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
        bestPosition = position;
      }

      if (typeof onProgress === 'function') {
        onProgress(bestPosition, isFirst ? 'DETECTING' : 'IMPROVING');
      }

      if (Number.isFinite(accuracy) && accuracy <= targetAccuracy) {
        finalizeResolve(position, 'READY');
      }
    },
    (error) => {
      // Reject if we don't have a fallback best position yet
      if (!bestPosition) {
        finalizeReject(error);
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: maxWaitTimeMs
    }
  );
});
