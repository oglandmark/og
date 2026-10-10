const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { inflateSync } = require("node:zlib");

const projectRoot = process.cwd();
const alphaThreshold = 16;
const maskSafeFraction = 66 / 108;
const centerToleranceFraction = 0.05;

function fail(message) {
  console.error(`Brand asset check failed: ${message}`);
  process.exit(1);
}

function resolveAsset(label, configuredPath) {
  if (typeof configuredPath !== "string" || configuredPath.trim() === "") {
    fail(`${label} is not configured in the resolved Expo config.`);
  }

  const assetPath = path.resolve(projectRoot, configuredPath);
  let stat;
  try {
    stat = fs.statSync(assetPath);
  } catch {
    fail(`${label} does not exist: ${configuredPath}`);
  }
  if (!stat.isFile()) {
    fail(`${label} is not a file: ${configuredPath}`);
  }

  console.log(`✓ ${label}: ${configuredPath}`);
  return assetPath;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function getRgbaPngAlphaBounds(assetPath, { allowEmpty = false } = {}) {
  const data = fs.readFileSync(assetPath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.length < 33 || !data.subarray(0, 8).equals(signature)) {
    fail(`Adaptive foreground is not a valid PNG: ${path.basename(assetPath)}`);
  }

  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlaceMethod;
  const imageData = [];

  for (let offset = 8; offset + 12 <= data.length;) {
    const chunkLength = data.readUInt32BE(offset);
    const chunkType = data.toString("ascii", offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd + 4 > data.length) {
      fail(`Adaptive foreground has a truncated PNG chunk: ${chunkType}`);
    }

    if (chunkType === "IHDR") {
      width = data.readUInt32BE(chunkStart);
      height = data.readUInt32BE(chunkStart + 4);
      bitDepth = data[chunkStart + 8];
      colorType = data[chunkStart + 9];
      interlaceMethod = data[chunkStart + 12];
    } else if (chunkType === "IDAT") {
      imageData.push(data.subarray(chunkStart, chunkEnd));
    } else if (chunkType === "IEND") {
      break;
    }

    offset = chunkEnd + 4;
  }

  if (!width || !height || width !== height) {
    fail(`Adaptive foreground must be a square PNG; found ${width}x${height}.`);
  }
  if (bitDepth !== 8 || colorType !== 6 || interlaceMethod !== 0) {
    fail(
      "Adaptive foreground must be a non-interlaced 8-bit RGBA PNG so its visible artwork can be checked."
    );
  }

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const pixels = inflateSync(Buffer.concat(imageData));
  if (pixels.length !== height * (rowLength + 1)) {
    fail("Adaptive foreground PNG pixel data has an unexpected size.");
  }

  let previousRow = Buffer.alloc(rowLength);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (rowLength + 1);
    const filter = pixels[sourceOffset];
    const row = Buffer.allocUnsafe(rowLength);

    for (let i = 0; i < rowLength; i += 1) {
      const raw = pixels[sourceOffset + i + 1];
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const above = previousRow[i];
      const upperLeft = i >= bytesPerPixel ? previousRow[i - bytesPerPixel] : 0;

      switch (filter) {
        case 0:
          row[i] = raw;
          break;
        case 1:
          row[i] = (raw + left) & 0xff;
          break;
        case 2:
          row[i] = (raw + above) & 0xff;
          break;
        case 3:
          row[i] = (raw + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4:
          row[i] = (raw + paethPredictor(left, above, upperLeft)) & 0xff;
          break;
        default:
          fail(`Adaptive foreground uses unsupported PNG filter ${filter}.`);
      }
    }

    for (let x = 0; x < width; x += 1) {
      if (row[x * bytesPerPixel + 3] >= alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    previousRow = row;
  }

  if (maxX < 0 && !allowEmpty) {
    fail("Adaptive foreground has no visible artwork.");
  }
  return { width, height, minX, minY, maxX, maxY };
}

function checkAdaptiveForeground(assetPath) {
  const bounds = getRgbaPngAlphaBounds(assetPath);
  const { width, height, minX, minY, maxX, maxY } = bounds;
  const safeInsetX = ((1 - maskSafeFraction) * width) / 2;
  const safeInsetY = ((1 - maskSafeFraction) * height) / 2;
  const artRight = maxX + 1;
  const artBottom = maxY + 1;
  const centerX = (minX + artRight) / 2;
  const centerY = (minY + artBottom) / 2;
  const centerOffsetX = Math.abs(centerX - width / 2);
  const centerOffsetY = Math.abs(centerY - height / 2);

  if (
    minX < safeInsetX ||
    minY < safeInsetY ||
    artRight > width - safeInsetX ||
    artBottom > height - safeInsetY
  ) {
    fail(
      `Adaptive foreground artwork extends beyond the centered 66/108 mask-safe area (visible bounds ${minX},${minY}–${maxX},${maxY} on ${width}x${height}).`
    );
  }
  if (
    centerOffsetX > width * centerToleranceFraction ||
    centerOffsetY > height * centerToleranceFraction
  ) {
    fail(
      `Adaptive foreground artwork is off-center (center offset ${centerOffsetX.toFixed(1)}px, ${centerOffsetY.toFixed(1)}px; limit ${Math.round(width * centerToleranceFraction)}px).`
    );
  }

  console.log(
    `✓ Adaptive foreground artwork is centered inside the 66/108 mask-safe area (visible bounds ${minX},${minY}–${maxX},${maxY} on ${width}x${height}).`
  );
}

const expoConfigResult = spawnSync("pnpm", ["exec", "expo", "config", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
});

if (expoConfigResult.error || expoConfigResult.status !== 0) {
  fail(
    `Could not resolve Expo config with "pnpm exec expo config --json". ${
      expoConfigResult.stderr || expoConfigResult.error?.message || ""
    }`.trim()
  );
}

let config;
try {
  config = JSON.parse(expoConfigResult.stdout);
} catch {
  fail("Expo config command did not return valid JSON.");
}

console.log("Resolved Expo config successfully.");
resolveAsset("iOS app icon", config.ios?.icon ?? config.icon);
const adaptiveForeground = resolveAsset(
  "Android adaptive foreground",
  config.android?.adaptiveIcon?.foregroundImage
);
checkAdaptiveForeground(adaptiveForeground);

const splashPlugin = config.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen"
);
const splashOptions = Array.isArray(splashPlugin) ? splashPlugin[1] : undefined;
const splashImage = resolveAsset("Transparent splash image", splashOptions?.image);
const splashImageBounds = getRgbaPngAlphaBounds(splashImage, { allowEmpty: true });
if (
  splashImageBounds.width !== 1 ||
  splashImageBounds.height !== 1 ||
  splashImageBounds.maxX >= 0 ||
  splashOptions?.imageWidth !== 1
) {
  fail("Native splash image must be a fully transparent 1x1 pixel.");
}
const darkSplashImage = resolveAsset("Dark transparent splash image", splashOptions?.dark?.image);
if (darkSplashImage !== splashImage) {
  fail("Light and dark native splash images must use the same transparent pixel.");
}
if (!splashOptions?.backgroundColor) {
  fail("Native splash must keep a plain background while the named app splash loads.");
}
if (splashOptions?.dark?.backgroundColor !== splashOptions.backgroundColor) {
  fail("Light and dark native splash backgrounds must match.");
}

const logoComponent = fs.readFileSync(
  path.resolve(projectRoot, "components/OGLandmarkLogo.tsx"),
  "utf8"
);
const primaryLogo = logoComponent.match(
  /const logoAsset\s*=\s*require\(['"]@\/assets\/images\/([^'"]+)['"]\)/
);
if (!primaryLogo) {
  fail("Could not identify the primary logo used by the in-app startup splash.");
}
const startupLogo = path.resolve(projectRoot, "assets/images", primaryLogo[1]);
if (!fs.existsSync(startupLogo)) {
  fail(`In-app startup logo does not exist: ${primaryLogo[1]}`);
}
const startupLayout = fs.readFileSync(
  path.resolve(projectRoot, "app/_layout.tsx"),
  "utf8"
);
if (!/<OGLandmarkLogo\s+size=\{\d+\}\s*\/>/.test(startupLayout) || !startupLayout.includes("OG Landmark")) {
  fail("The in-app startup splash must retain both the logo and OG Landmark name.");
}
console.log("✓ Native splash image is transparent; the in-app startup splash keeps the logo and name.");