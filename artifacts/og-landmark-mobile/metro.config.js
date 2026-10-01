const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  // Block Metro from watching temp/non-existent directories created during pnpm install
  blockList: [
    /.*_tmp_\d+.*/,
    /.*\.tmp\/.*/,
  ],
};

// Expo Go requests Android development bundles with `Accept: multipart/mixed`.
// That streaming response is not preserved by the Replit Expo proxy, which
// makes Expo Go fail with "Error while reading multipart response" even when
// Metro returned HTTP 200. Force a regular bundle only for Android bundle
// requests; web and other Metro endpoints keep their normal negotiation.
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;
const isReplitExpoPreview = Boolean(process.env.REPLIT_EXPO_DEV_DOMAIN);
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, metroServer) => {
    const enhancedMiddleware = defaultEnhanceMiddleware
      ? defaultEnhanceMiddleware(metroMiddleware, metroServer)
      : metroMiddleware;

    return (req, res, next) => {
      const requestUrl = String(req.url || '');
      const isAndroidBundle =
        requestUrl.includes('.bundle?') &&
        /(?:^|[?&])platform=android(?:&|$)/.test(requestUrl);
      const accept = req.headers?.accept;

      if (isReplitExpoPreview && isAndroidBundle && typeof accept === 'string') {
        const regularAccept = accept
          .split(',')
          .filter((value) => !value.trim().toLowerCase().startsWith('multipart/mixed'))
          .join(',');
        req.headers.accept = regularAccept || 'application/javascript, */*';
      }

      return enhancedMiddleware(req, res, next);
    };
  },
};

module.exports = config;
