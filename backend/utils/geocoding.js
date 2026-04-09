const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const withTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async (url, options) => {
  const response = await withTimeout(url, options);
  if (!response.ok) {
    throw new Error(`Reverse geocoding request failed with status ${response.status}`);
  }
  return response.json();
};

const normalizeAddress = (address) => (
  typeof address === 'string' && address.trim()
    ? address.trim()
    : ''
);

const buildProviders = (lat, lng) => {
  const providers = [];

  if (GOOGLE_MAPS_API_KEY) {
    providers.push({
      name: 'google',
      url: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
      extractAddress: (payload) => normalizeAddress(payload?.results?.[0]?.formatted_address)
    });
  }

  if (OPENCAGE_API_KEY) {
    providers.push({
      name: 'opencage',
      url: `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${OPENCAGE_API_KEY}`,
      extractAddress: (payload) => normalizeAddress(payload?.results?.[0]?.formatted)
    });
  }

  providers.push({
    name: 'nominatim',
    url: `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    options: {
      headers: {
        'User-Agent': 'Civic-Issue-Management-System/1.0'
      }
    },
    extractAddress: (payload) => normalizeAddress(payload?.display_name)
  });

  return providers;
};

const reverseGeocodeCoordinates = async (lat, lng) => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!isFiniteCoordinate(parsedLat) || !isFiniteCoordinate(parsedLng)) {
    return '';
  }

  for (const provider of buildProviders(parsedLat, parsedLng)) {
    try {
      const payload = await fetchJson(provider.url, provider.options);
      const address = provider.extractAddress(payload);
      if (address) {
        return address;
      }
    } catch (error) {
      console.warn(`[reverse-geocode:${provider.name}]`, error.message);
    }
  }

  return '';
};

module.exports = {
  reverseGeocodeCoordinates
};
