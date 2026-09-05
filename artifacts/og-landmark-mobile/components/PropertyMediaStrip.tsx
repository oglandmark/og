/**
 * PropertyMediaStrip
 *
 * Horizontal thumbnail row placed directly below the hero image on the
 * property detail page. Shows up to 4 image thumbnails + a "Video" tile,
 * exactly like the reference screenshot.
 *
 * Tapping a thumbnail selects it (highlighted border) and scrolls the
 * hero gallery to that image. Tapping Video opens the fullscreen player.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable,
  ScrollView, StatusBar, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { setAudioModeAsync } from 'expo-audio';
import { VideoView, useVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { propertyImages, type Property } from '@/lib/properties';
import { useColors } from '@/hooks/useColors';
import { VideoWatermark } from '@/components/VideoWatermark';

// ─── Constants ─────────────────────────────────────────────────────────────────
const THUMB_SIZE  = 52;   // square thumbnail size
const THUMB_RADIUS = 8;
const STRIP_H     = THUMB_SIZE + 18; // strip total height (padding included)
const MAX_THUMBS  = 5;    // max image thumbnails to show
// Keep a playable local tour available even when an API property has no
// uploaded video or its remote URL is temporarily unreachable.
const DEFAULT_PROPERTY_VIDEO = require('@/assets/videos/property-tour-2.mp4') as number;

function PropertyFullscreenVideo({
  source, muted, onPlayerReady, onBufferingChange, onPlayingChange, onError, onFinished,
}: {
  source: VideoSource;
  muted: boolean;
  onPlayerReady: (player: VideoPlayer) => void;
  onBufferingChange: (buffering: boolean) => void;
  onPlayingChange: (playing: boolean) => void;
  onError: () => void;
  onFinished: () => void;
}) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = muted;
    videoPlayer.volume = 1;
    videoPlayer.play();
  });

  React.useEffect(() => {
    onPlayerReady(player);
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      onBufferingChange(status === 'loading');
      if (status === 'error') onError();
    });
    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      onPlayingChange(isPlaying);
    });
    const completionSubscription = player.addListener('playToEnd', onFinished);
    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      completionSubscription.remove();
    };
  }, [onBufferingChange, onError, onFinished, onPlayerReady, onPlayingChange, player]);

  React.useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return <VideoView player={player} style={fs.video} contentFit="contain" nativeControls={false} />;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function PropertyMediaStrip({
  property,
  activeIndex,
  onSelect,
}: {
  property: Property;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const colors = useColors();
  const [videoVisible,  setVideoVisible]  = useState(false);
  const [isBuffering,   setIsBuffering]   = useState(true);
  const [hasError,      setHasError]      = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const videoPlayerRef = useRef<VideoPlayer | null>(null);
  const stripRef = useRef<ScrollView>(null);
  const [stripOffset, setStripOffset] = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [stripContentWidth, setStripContentWidth] = useState(0);

  const images     = propertyImages(property);
  const thumbs     = images.slice(0, MAX_THUMBS);

  // Prefer bundled asset; fall back to remote URI
  const videoSource: { uri: string } | number | null =
    property.videoAsset != null
      ? property.videoAsset
      : property.videoUrl
      ? { uri: property.videoUrl }
      : DEFAULT_PROPERTY_VIDEO;
  const hasVideo = videoSource !== null;
  const canScrollLeft = stripOffset > 4;
  const canScrollRight = stripOffset < stripContentWidth - stripWidth - 4;

  function moveStrip(direction: -1 | 1) {
    const step = (THUMB_SIZE + 8) * 2;
    const nextOffset = Math.max(
      0,
      Math.min(stripOffset + direction * step, Math.max(0, stripContentWidth - stripWidth)),
    );
    stripRef.current?.scrollTo({ x: nextOffset, animated: true });
    setStripOffset(nextOffset);
  }

  async function openVideo() {
    // Enable audio on iOS even in silent mode
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
      });
    } catch {}
    setIsBuffering(true);
    setHasError(false);
    setIsPlaying(true);
    setVideoVisible(true);
  }
  function closeVideo() {
    videoPlayerRef.current?.pause();
    if (videoPlayerRef.current) videoPlayerRef.current.currentTime = 0;
    setIsPlaying(false);
    setVideoVisible(false);
  }
  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    if (videoPlayerRef.current) videoPlayerRef.current.muted = next;
  }
  function togglePlay() {
    if (isPlaying) {
      videoPlayerRef.current?.pause();
    } else {
      videoPlayerRef.current?.play();
    }
    setIsPlaying((p) => !p);
  }

  return (
    <>
      {/* ── Thumbnail Strip ─────────────────────────────────────────── */}
      <View style={[s.strip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView
          ref={stripRef}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          scrollEventThrottle={16}
          onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}
          onContentSizeChange={(width) => setStripContentWidth(width)}
          onScroll={(event) => setStripOffset(event.nativeEvent.contentOffset.x)}
        >
          {thumbs.map((src, i) => {
            const selected = i === activeIndex;
            return (
              <Pressable
                key={i}
                onPress={() => onSelect(i)}
                style={[s.thumb, selected && s.thumbSelected]}
                accessibilityLabel={`Property image ${i + 1}`}
              >
                <Image source={src} style={s.thumbImg} resizeMode="cover" />
                {/* Selected overlay tint */}
                {selected && <View style={s.thumbOverlay} />}
              </Pressable>
            );
          })}

          {/* Video tile */}
          <Pressable
            onPress={hasVideo ? openVideo : undefined}
            style={[s.videoTile, !hasVideo && s.videoTileDim]}
            accessibilityLabel="Play property video tour"
          >
            {/* Blurred background from first image */}
            {images[0] && (
              <Image
                source={images[0]}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                blurRadius={8}
              />
            )}
            {/* Dark scrim */}
            <View style={s.videoScrim} />
            {/* Play button */}
            <View style={s.playBtn}>
              <Feather name="play" size={14} color="#c8a45a" />
            </View>
            <Text style={s.videoLabel}>Video</Text>
          </Pressable>
        </ScrollView>
        {canScrollLeft && (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              moveStrip(-1);
            }}
            style={[s.stripArrow, s.stripArrowLeft]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Scroll property images left"
          >
            <Feather name="chevron-left" size={15} color="#ffffff" />
          </Pressable>
        )}
        {canScrollRight && (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              moveStrip(1);
            }}
            style={[s.stripArrow, s.stripArrowRight]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Scroll property images right"
          >
            <Feather name="chevron-right" size={15} color="#ffffff" />
          </Pressable>
        )}
      </View>

      {/* ── Fullscreen Video Player ──────────────────────────────────── */}
      <Modal
        visible={videoVisible}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={closeVideo}
      >
        <StatusBar hidden />
        <View style={fs.container}>

          {/* Close */}
          <Pressable style={fs.closeBtn} onPress={closeVideo} hitSlop={14}>
            <View style={fs.closeBtnInner}>
              <Feather name="x" size={20} color="#fff" />
            </View>
          </Pressable>

          {hasError ? (
            <View style={fs.errorBox}>
              <Feather name="alert-circle" size={36} color="#c8a45a" />
              <Text style={fs.errorText}>Video load nahi ho saka</Text>
              <Pressable onPress={closeVideo} style={fs.errorClose}>
                <Text style={fs.errorCloseText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Video — unmuted by default, no native controls */}
              <Pressable style={fs.videoWrap} onPress={togglePlay}>
                <PropertyFullscreenVideo
                  source={videoSource!}
                  muted={isMuted}
                  onPlayerReady={(player) => { videoPlayerRef.current = player; }}
                  onBufferingChange={setIsBuffering}
                  onPlayingChange={setIsPlaying}
                  onError={() => setHasError(true)}
                  onFinished={closeVideo}
                />
                <VideoWatermark />
              </Pressable>

              {/* Buffering spinner */}
              {isBuffering && (
                <View style={fs.bufferOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color="#c8a45a" />
                </View>
              )}

              {/* Play/Pause centre indicator (shows briefly on tap) */}
              {!isPlaying && !isBuffering && (
                <View style={fs.pauseIcon} pointerEvents="none">
                  <Feather name="play" size={38} color="#fff" />
                </View>
              )}

              {/* ── Custom Controls Bar ── */}
              <View style={fs.controlBar}>
                {/* Mute / Unmute button */}
                <TouchableOpacity
                  onPress={toggleMute}
                  style={fs.muteBtn}
                  activeOpacity={0.8}
                  accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
                >
                  <Feather
                    name={isMuted ? 'volume-x' : 'volume-2'}
                    size={18}
                    color={isMuted ? '#888' : '#c8a45a'}
                  />
                  <Text style={[fs.muteBtnLabel, { color: isMuted ? '#888' : '#c8a45a' }]}>
                    {isMuted ? 'Unmute' : 'Sound On'}
                  </Text>
                </TouchableOpacity>

                {/* Property title */}
                <View style={fs.titleWrap}>
                  <Feather name="video" size={12} color="#c8a45a" />
                  <Text style={fs.titleText} numberOfLines={1}>{property.title}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

// ─── Strip styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  strip: {
    height: STRIP_H,
    backgroundColor: '#0b1d2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,164,90,0.15)',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  stripArrow: {
    position: 'absolute',
    top: 22,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(7,21,33,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(216,184,108,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  stripArrowLeft: { left: 4 },
  stripArrowRight: { right: 4 },

  /* Image thumbnails */
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelected: {
    borderColor: '#c8a45a',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(200,164,90,0.15)',
  },

  /* Video tile */
  videoTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1e3a55',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e2236',
    gap: 4,
  },
  videoTileDim: {
    opacity: 0.5,
  },
  videoScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,20,35,0.62)',
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(14,34,54,0.85)',
    borderWidth: 1.5,
    borderColor: '#c8a45a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    zIndex: 1,
  },
});

// ─── Fullscreen styles ──────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  /* Video fills the screen; tap to play/pause */
  videoWrap: { ...StyleSheet.absoluteFill },
  video:     { flex: 1 },

  /* Close button — top right */
  closeBtn: { position: 'absolute', top: 48, right: 16, zIndex: 30 },
  closeBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Buffering */
  bufferOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },

  /* Pause icon shown in centre when paused */
  pauseIcon: {
    position: 'absolute', alignSelf: 'center',
    top: '50%', marginTop: -30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },

  /* Bottom control bar */
  controlBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 32, paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
    gap: 12,
  },

  /* Mute / Unmute pill button */
  muteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(200,164,90,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(200,164,90,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  muteBtnLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.3,
  },

  /* Title area */
  titleWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'flex-end',
  },
  titleText: {
    color: '#fff', fontWeight: '600', fontSize: 12,
    flex: 1, textAlign: 'right', opacity: 0.85,
  },

  /* Error state */
  errorBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorText:      { color: '#c8a45a', fontWeight: '700', fontSize: 15 },
  errorClose:     { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#c8a45a', borderRadius: 10 },
  errorCloseText: { color: '#102a43', fontWeight: '700', fontSize: 13 },
});
