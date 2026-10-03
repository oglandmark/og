const { withAndroidManifest } = require('expo/config-plugins');

const GOOGLE_MAPS_METADATA_NAME = 'com.google.android.geo.API_KEY';

module.exports = function withGoogleMapsApiKey(config) {
  return withAndroidManifest(config, (modConfig) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY must be configured in the selected EAS build environment.',
      );
    }

    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android manifest is missing its application element.');
    }

    const metadata = application['meta-data'] ?? (application['meta-data'] = []);
    const existing = metadata.find(
      (entry) => entry.$?.['android:name'] === GOOGLE_MAPS_METADATA_NAME,
    );

    if (existing) {
      existing.$['android:value'] = apiKey;
    } else {
      metadata.push({
        $: {
          'android:name': GOOGLE_MAPS_METADATA_NAME,
          'android:value': apiKey,
        },
      });
    }

    return modConfig;
  });
};