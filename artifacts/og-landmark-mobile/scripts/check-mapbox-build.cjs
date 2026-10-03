const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

async function main() {
  if (!token) {
    throw new Error(
      'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is missing from this EAS project build environment. Configure it before building the APK.',
    );
  }

  for (const style of ['streets-v12', 'satellite-streets-v12']) {
    const url = new URL(
      `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/256/0/0/0@2x`,
    );
    url.searchParams.set('access_token', token);
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    } catch {
      throw new Error(`Mapbox ${style} tile request failed or timed out.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) {
      throw new Error(`Mapbox ${style} tile validation failed (HTTP ${response.status}).`);
    }
    await response.arrayBuffer();
  }
  console.log('Mapbox build check passed: both map tile styles are accessible.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});