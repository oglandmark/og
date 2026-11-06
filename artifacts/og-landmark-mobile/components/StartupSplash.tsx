import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import {
  prepareSplashHtml,
  resolveSplashAssetUri,
  STARTUP_SPLASH_ANIMATION_DURATION_MS,
} from '@/lib/splashHtml';

const splashHtmlAsset = Asset.fromModule(
  require('@/assets/splash/og-landmark-intro.html'),
);

export function StartupSplash({
  colors,
  overlay = false,
  onAnimationReady,
}: {
  colors: ReturnType<typeof useColors>;
  overlay?: boolean;
  fontsReady?: boolean;
  onAnimationReady?: (animated: boolean) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const readyReported = useRef(false);
  const loadWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportAnimationReady = useCallback((animated: boolean) => {
    if (readyReported.current) return;
    readyReported.current = true;
    if (loadWatchdog.current) {
      clearTimeout(loadWatchdog.current);
      loadWatchdog.current = null;
    }
    onAnimationReady?.(animated);
  }, [onAnimationReady]);

  useEffect(() => {
    let active = true;
    const watchdog = setTimeout(() => {
      if (!active) return;
      console.error('[splash] Intro did not become ready; keeping the branded fallback.');
      setHtml(null);
      reportAnimationReady(false);
    }, STARTUP_SPLASH_ANIMATION_DURATION_MS);
    loadWatchdog.current = watchdog;

    const loadSplash = async () => {
      let sourceUri = splashHtmlAsset.uri;
      try {
        await splashHtmlAsset.downloadAsync();
        let source: string;
        if (Platform.OS === 'web') {
          sourceUri = resolveSplashAssetUri(splashHtmlAsset.uri, window.location.origin);
          const response = await fetch(sourceUri);
          if (!response.ok) {
            throw new Error(`Splash asset request failed (${response.status}).`);
          }
          source = await response.text();
        } else {
          sourceUri = splashHtmlAsset.localUri ?? splashHtmlAsset.uri;
          source = await FileSystem.readAsStringAsync(sourceUri);
        }
        if (active && !readyReported.current) setHtml(prepareSplashHtml(source));
      } catch (error) {
        console.error('[splash] Could not load the branded intro.', { sourceUri, error });
        if (active) reportAnimationReady(false);
      }
    };

    void loadSplash();
    return () => {
      active = false;
      clearTimeout(watchdog);
      if (loadWatchdog.current === watchdog) loadWatchdog.current = null;
    };
  }, [reportAnimationReady]);

  const rootStyle = [
    styles.root,
    overlay && styles.overlay,
    { backgroundColor: colors.splashBackground },
  ];

  return (
    <View style={rootStyle}>
      <StatusBar style="light" />
      {html
        ? Platform.OS === 'web'
          ? React.createElement('iframe' as never, {
            title: 'OG Landmark animated splash',
            srcDoc: html,
            allow: 'fullscreen',
            frameBorder: '0',
            onLoad: () => reportAnimationReady(true),
            onError: () => reportAnimationReady(false),
            style: {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
            },
          })
          : (
              <WebView
                source={{ html }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction
                allowsInlineMediaPlayback
                scrollEnabled={false}
                bounces={false}
                onLoadEnd={() => reportAnimationReady(true)}
                onError={() => reportAnimationReady(false)}
                style={styles.webView}
              />
            )
        : (
            <View style={styles.fallback}>
              <Text style={[styles.fallbackName, { color: colors.splashWhite }]}>
                OG LANDMARK
              </Text>
              <ActivityIndicator color={colors.splashTeal} size="small" />
            </View>
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    elevation: 200,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  fallbackName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
