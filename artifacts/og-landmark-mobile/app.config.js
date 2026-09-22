const base = require('./app.json').expo;

// Mapbox is rendered through the shared WebView map surface, so no native map
// SDK configuration is needed in the Expo build.
module.exports = base;