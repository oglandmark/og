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

module.exports = config;
