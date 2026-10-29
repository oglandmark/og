export type HomeBannerAutoplayMode = 'paused' | 'timer' | 'video-end';

export function getHomeBannerAutoplayMode({
  isVisible,
  reduceMotion,
  slideCount,
  isVideo,
}: {
  isVisible: boolean;
  reduceMotion: boolean;
  slideCount: number;
  isVideo: boolean;
}): HomeBannerAutoplayMode {
  if (!isVisible || reduceMotion || slideCount < 2) return 'paused';
  return isVideo ? 'video-end' : 'timer';
}

export const HOME_BANNER_IMAGE_AUTOPLAY_MS = 5600;
