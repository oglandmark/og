import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHomeBannerAutoplayMode,
  HOME_BANNER_IMAGE_AUTOPLAY_MS,
  HOME_BANNER_VIDEO_MUTED,
  HOME_BANNER_VIDEO_PLAYBACK_RATE,
  shouldShowHomeBannerCopy,
} from '../lib/homeBannerPlayback';

test('video banners play at normal real-time speed', () => {
  assert.equal(HOME_BANNER_VIDEO_PLAYBACK_RATE, 1.0);
  assert.equal(HOME_BANNER_VIDEO_MUTED, false);
});

test('video banners advance on playback completion rather than the image timer', () => {
  assert.equal(
    getHomeBannerAutoplayMode({
      isVisible: true,
      reduceMotion: false,
      slideCount: 3,
      isVideo: true,
    }),
    'video-end',
  );
  assert.equal(HOME_BANNER_IMAGE_AUTOPLAY_MS, 5600);
});

test('image banners keep their timed advance', () => {
  assert.equal(
    getHomeBannerAutoplayMode({
      isVisible: true,
      reduceMotion: false,
      slideCount: 3,
      isVideo: false,
    }),
    'timer',
  );
});

test('video banners hide all overlaid copy while image banners retain it', () => {
  assert.equal(shouldShowHomeBannerCopy('https://cdn.example.com/banner.mp4'), false);
  assert.equal(shouldShowHomeBannerCopy('   '), true);
  assert.equal(shouldShowHomeBannerCopy(undefined), true);
});

test('hidden, single-slide, and reduced-motion carousels do not advance automatically', () => {
  const base = { reduceMotion: false, slideCount: 3, isVideo: false };
  assert.equal(getHomeBannerAutoplayMode({ ...base, isVisible: false }), 'paused');
  assert.equal(
    getHomeBannerAutoplayMode({ ...base, isVisible: true, slideCount: 1 }),
    'paused',
  );
  assert.equal(
    getHomeBannerAutoplayMode({ ...base, isVisible: true, reduceMotion: true }),
    'paused',
  );
});
