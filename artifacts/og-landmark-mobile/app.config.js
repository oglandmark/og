const base = require('./app.json').expo;

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
      googleMapsApiKey:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        base.ios?.config?.googleMapsApiKey ||
        '',
    },
  },
  android: {
    ...base.android,
    config: {
      ...base.android?.config,
      googleMaps: {
        ...base.android?.config?.googleMaps,
        apiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          process.env.GOOGLE_MAPS_API_KEY ||
          base.android?.config?.googleMaps?.apiKey ||
          '',
      },
    },
  },
};