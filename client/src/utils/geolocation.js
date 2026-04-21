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
  onProgress,
  signal
} = {}) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Location is not supported in this browser.'));
    return;
  }

  let watchId = null;
  let settled = false;

  const cleanup = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
  };

  const finalizeResolve = (position) => {
    if (settled) {
      return;
    }

    settled = true;
    cleanup();
    resolve(position);
  };

  const finalizeReject = (error) => {
    if (settled) {
      return;
    }

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

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (typeof onProgress === 'function') {
        onProgress(position);
      }

      const accuracy = Number(position.coords.accuracy);
      if (Number.isFinite(accuracy) && accuracy <= targetAccuracy) {
        finalizeResolve(position);
      }
    },
    (error) => {
      finalizeReject(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0
    }
  );
});
