const base = require('./app.json').expo;
const mapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  base.android?.config?.googleMaps?.apiKey ||
  base.ios?.config?.googleMapsApiKey ||
  '';

if (process.env.EAS_BUILD_PROFILE === 'production' && !mapsApiKey.trim()) {
  throw new Error(
    'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for the production Android/iOS build. ' +
    'Add it to the EAS production environment before building.',
  );
}

/**
 * Keep the checked-in Expo identity/settings in app.json while injecting the
 * platform-restricted Google Maps SDK key only at native build time.
 */
module.exports = {
  ...base,
  ios: {
    ...base.ios,
    config: {
      ...base.ios?.config,
      googleMapsApiKey: mapsApiKey,
    },
  },
  android: {
    ...base.android,
    config: {
      ...base.android?.config,
      googleMaps: {
        ...base.android?.config?.googleMaps,
        apiKey: mapsApiKey,
      },
    },
  },
};