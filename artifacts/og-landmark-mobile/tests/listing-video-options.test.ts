import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { getListingVideoExportOptions } from '../lib/listingVideoOptions';
import { sortMyListings } from '../lib/listingSorting';

const here = dirname(fileURLToPath(import.meta.url));

function listing(id: string, postedBy: string, postedAt: string) {
  return {
    id, postedBy, postedAt,
  };
}

test('iOS listing videos use H.264 1080p export while Android stays unchanged', () => {
  assert.deepEqual(
    getListingVideoExportOptions('ios', 'H264_1920x1080'),
    { videoExportPreset: 'H264_1920x1080' },
  );
  assert.deepEqual(getListingVideoExportOptions('android', 'H264_1920x1080'), {});
  assert.deepEqual(getListingVideoExportOptions('web', 'H264_1920x1080'), {});
});

test('My Properties trusts the authenticated API result without a second account-ID filter', () => {
  const first = listing('api_1', 'seller-id', '2026-11-10T08:00:00.000Z');
  const second = listing('api_2', 'agent-id', '2026-11-10T09:00:00.000Z');
  assert.deepEqual(sortMyListings([first, second]).map((item) => item.id), ['api_2', 'api_1']);
  assert.deepEqual(sortMyListings([first, second], 'seller-id').map((item) => item.id), ['api_1']);
});

test('both property listing forms apply the platform-specific video export option', async () => {
  const paths = [
    join(here, '../app/(tabs)/post-ad.tsx'),
    join(here, '../app/post/listing.tsx'),
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
  for (const source of sources) {
    assert.match(source, /getListingVideoExportOptions\(Platform\.OS,\s*ImagePicker\.VideoExportPreset\.H264_1920x1080\)/);
  }
});

test('profile and listing submission expose a My Properties route action', async () => {
  const [profile, listingForm] = await Promise.all([
    readFile(join(here, '../app/(tabs)/profile.tsx'), 'utf8'),
    readFile(join(here, '../app/post/listing.tsx'), 'utf8'),
  ]);
  assert.match(profile, /router\.push\('\/my-properties' as any\)/);
  assert.match(listingForm, /Alert\.alert\([\s\S]*?My Properties[\s\S]*?router\.push\('\/my-properties' as any\)/);
});

test('My Properties has an allowed top-level route outside the role-hidden tab', async () => {
  const [route, layout] = await Promise.all([
    readFile(join(here, '../app/my-properties.tsx'), 'utf8'),
    readFile(join(here, '../app/_layout.tsx'), 'utf8'),
  ]);
  assert.match(route, /from '\.\/\(tabs\)\/listings'/);
  assert.match(layout, /'announcements',\s*'my-properties'/);
  assert.match(layout, /Stack\.Screen name="my-properties"/);
});
