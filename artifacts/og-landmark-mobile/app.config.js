const base = require('./app.json').expo;

/**
 * Keep the checked-in Expo identity/settings in app.json while injecting the
 * platform-restricted Google Maps SDK key only at native build time.
 */
const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  base.android?.config?.googleMaps?.apiKey ||
  base.ios?.config?.googleMapsApiKey ||
  '';

if (!googleMapsApiKey.trim()) {
  throw new Error(
    'Google Maps SDK key is missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before building the native app.',
  );
}

module.exports = {
  ...base,
  ios: {
    ...base.ios,
    config: {
      ...base.ios?.config,
      googleMapsApiKey,
    },
  },
  android: {
    ...base.android,
    config: {
      ...base.android?.config,
      googleMaps: {
        ...base.android?.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  },
  plugins: [
    ...(base.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ],
};