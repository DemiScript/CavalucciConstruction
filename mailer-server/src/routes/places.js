import { Router } from 'express';
import rateLimit from 'express-rate-limit';

// Proxy for Google Places (New) so the API key stays on the server. The browser
// only ever talks to these two endpoints.
const router = Router();

const PLACES_BASE = 'https://places.googleapis.com/v1';
const REQUEST_TIMEOUT_MS = 5000;

// Suggestions fire as the visitor types (debounced client-side), so this is
// looser than the contact limiter but still caps what one IP can spend.
const placesLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.PLACES_RATE_MAX) || 120,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Bias (not restrict) results toward the service area around Park Ridge, NJ.
const LOCATION_BIAS = {
  circle: { center: { latitude: 41.0334, longitude: -74.0415 }, radius: 50000 },
};

const SESSION_TOKEN = /^[A-Za-z0-9-]{8,64}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

async function googleFetch(url, options) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    const err = new Error('GOOGLE_PLACES_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, 'X-Goog-Api-Key': key },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Log Google's reason server-side only; never forward it to the browser.
    console.warn(
      JSON.stringify({ event: 'places_error', status: res.status, body: await res.text() })
    );
    const err = new Error('Places request failed');
    err.status = 502;
    throw err;
  }
  return res.json();
}

router.post('/autocomplete', placesLimiter, async (req, res, next) => {
  try {
    const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    const sessionToken = req.body?.sessionToken;
    if (input.length < 3 || input.length > 100 || !SESSION_TOKEN.test(sessionToken || '')) {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const data = await googleFetch(`${PLACES_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ['us'],
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        locationBias: LOCATION_BIAS,
      }),
    });

    const suggestions = (data.suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        placeId: p.placeId,
        main: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondary: p.structuredFormat?.secondaryText?.text || '',
      }));

    return res.json({ success: true, suggestions });
  } catch (err) {
    next(err);
  }
});

// Pick one address component by Google type, e.g. 'locality' -> "Park Ridge".
const component = (components, type, name = 'longText') =>
  components.find((c) => c.types?.includes(type))?.[name] || '';

router.post('/details', placesLimiter, async (req, res, next) => {
  try {
    const { placeId, sessionToken } = req.body || {};
    if (!PLACE_ID.test(placeId || '') || !SESSION_TOKEN.test(sessionToken || '')) {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const data = await googleFetch(
      `${PLACES_BASE}/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`,
      { method: 'GET', headers: { 'X-Goog-FieldMask': 'addressComponents' } }
    );

    const c = data.addressComponents || [];
    const zip = component(c, 'postal_code');
    const suffix = component(c, 'postal_code_suffix');

    return res.json({
      success: true,
      address: {
        line1: [component(c, 'street_number'), component(c, 'route')].filter(Boolean).join(' '),
        // NYC boroughs and some NJ towns have no `locality`, so fall back.
        city:
          component(c, 'locality') ||
          component(c, 'sublocality_level_1') ||
          component(c, 'sublocality') ||
          component(c, 'postal_town'),
        state: component(c, 'administrative_area_level_1', 'shortText'),
        zip: zip && suffix ? `${zip}-${suffix}` : zip,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
