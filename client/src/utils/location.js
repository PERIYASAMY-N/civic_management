const toFiniteNumber = (value) => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : null;
};

export const formatCoordinates = (lat, lng) => `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`;

export const reverseGeocodeAddress = async (lat, lng) => {
  const normalizedLat = toFiniteNumber(lat);
  const normalizedLng = toFiniteNumber(lng);

  if (normalizedLat === null || normalizedLng === null) {
    return '';
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(normalizedLat));
  url.searchParams.set('lon', String(normalizedLng));
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Unable to fetch a readable address for this location.');
  }

  const payload = await response.json();
  return typeof payload?.display_name === 'string' ? payload.display_name.trim() : '';
};

export const formatAddressForDisplay = (address) => String(address || '')
  .split(/\s*,\s*/)
  .filter(Boolean)
  .join(',\n');

export const getLocationCoordinates = (record) => {
  const lat = toFiniteNumber(record?.lat ?? record?.location?.lat);
  const lng = toFiniteNumber(record?.lng ?? record?.location?.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
};

export const getLocationAddress = (record, fallback = 'Location unavailable') => {
  const address = String(record?.address ?? record?.location?.address ?? '').trim();

  if (address) {
    return address;
  }

  const coordinates = getLocationCoordinates(record);
  return coordinates ? formatCoordinates(coordinates.lat, coordinates.lng) : fallback;
};

const buildProofLocation = ({ lat, lng, address, accuracy, timestamp }) => {
  const normalizedLat = toFiniteNumber(lat);
  const normalizedLng = toFiniteNumber(lng);
  const normalizedAddress = String(address || '').trim();

  return {
    lat: normalizedLat,
    lng: normalizedLng,
    address: normalizedAddress || (
      normalizedLat !== null && normalizedLng !== null
        ? formatCoordinates(normalizedLat, normalizedLng)
        : ''
    ),
    accuracy: toFiniteNumber(accuracy),
    timestamp: timestamp || ''
  };
};

export const getProofLocation = (issue, stage) => {
  if (stage === 'before') {
    return buildProofLocation({
      lat: issue?.beforeWork?.location?.lat ?? issue?.beforeWork?.lat ?? issue?.beforeLat,
      lng: issue?.beforeWork?.location?.lng ?? issue?.beforeWork?.lng ?? issue?.beforeLng,
      address: issue?.beforeWork?.location?.address ?? issue?.beforeWork?.address ?? issue?.beforeAddress,
      accuracy: issue?.beforeWork?.accuracy ?? issue?.beforeAccuracy,
      timestamp: issue?.beforeWork?.submittedAt ?? issue?.beforeWork?.timestamp ?? issue?.beforeTime
    });
  }

  if (stage === 'bill') {
    return buildProofLocation({
      lat: issue?.afterWork?.billLat ?? issue?.billLat,
      lng: issue?.afterWork?.billLng ?? issue?.billLng,
      address: issue?.afterWork?.billAddress ?? issue?.billAddress,
      accuracy: issue?.afterWork?.billAccuracy ?? issue?.billAccuracy,
      timestamp: issue?.afterWork?.billTimestamp ?? issue?.billTime
    });
  }

  return buildProofLocation({
    lat: issue?.afterWork?.location?.lat ?? issue?.afterWork?.lat ?? issue?.afterLat,
    lng: issue?.afterWork?.location?.lng ?? issue?.afterWork?.lng ?? issue?.afterLng,
    address: issue?.afterWork?.location?.address ?? issue?.afterWork?.address ?? issue?.afterAddress,
    accuracy: issue?.afterWork?.accuracy ?? issue?.afterAccuracy,
    timestamp: issue?.afterWork?.submittedAt ?? issue?.afterWork?.timestamp ?? issue?.afterTime
  });
};
