import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import {
  prepareSplashHtml,
  resolveSplashAssetUri,
  STARTUP_SPLASH_LOAD_TIMEOUT_MS,
} from '@/lib/splashHtml';

const splashHtmlAsset = Asset.fromModule(
  require('@/assets/splash/og-landmark-intro.html'),
);

async function fetchSplashHtml(uri: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(uri, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Splash asset request failed (${response.status}).`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

const splashHtmlPromise = (async () => {
  let sourceUri = splashHtmlAsset.uri;
  try {
    let source: string;
    if (Platform.OS === 'web') {
      sourceUri = resolveSplashAssetUri(splashHtmlAsset.uri, window.location.origin);
      source = await fetchSplashHtml(sourceUri);
    } else {
      if (!splashHtmlAsset.localUri) await splashHtmlAsset.downloadAsync();
      sourceUri = splashHtmlAsset.localUri ?? splashHtmlAsset.uri;
      source = await FileSystem.readAsStringAsync(sourceUri);
    }
    return { html: prepareSplashHtml(source), sourceUri };
  } catch (error) {
    return { error, sourceUri };
  }
})();

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<WebView<{}>>(null);
  const readyReported = useRef(false);
  const loadWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeSplashHidePromise = useRef<Promise<void> | null>(null);

  const hideNativeSplash = useCallback(() => {
    if (!nativeSplashHidePromise.current) {
      nativeSplashHidePromise.current = SplashScreen.hideAsync().catch(() => undefined);
    }
    return nativeSplashHidePromise.current;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    let restoreNavigationBar: (() => void) | null = null;

    // Keep this native module out of the app's eager import graph. If it is
    // unavailable in a Play build, the startup splash must still render.
    void import('expo-navigation-bar')
      .then(async ({ setVisibilityAsync }) => {
        if (!active) return;
        try {
          await setVisibilityAsync('hidden');
          restoreNavigationBar = () => {
            try {
              void setVisibilityAsync('visible').catch(() => undefined);
            } catch {
              // The navigation bar is best-effort; never block app startup.
            }
          };
          if (!active) restoreNavigationBar();
        } catch {
          // Unsupported device/navigation mode must not prevent app startup.
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      restoreNavigationBar?.();
    };
  }, []);

  const startSplashAnimation = useCallback(() => {
    if (Platform.OS === 'web') {
      const frameWindow = iframeRef.current?.contentWindow as
        | (Window & { startSplashAnimation?: () => void })
        | null;
      frameWindow?.startSplashAnimation?.();
      return;
    }
    webViewRef.current?.injectJavaScript('window.startSplashAnimation?.(); true;');
  }, []);

  const reportAnimationReady = useCallback((animated: boolean) => {
    if (readyReported.current) return;
    readyReported.current = true;
    if (loadWatchdog.current) {
      clearTimeout(loadWatchdog.current);
      loadWatchdog.current = null;
    }
    void hideNativeSplash().then(() => {
      if (animated) startSplashAnimation();
      onAnimationReady?.(animated);
    });
  }, [hideNativeSplash, onAnimationReady, startSplashAnimation]);

  useEffect(() => {
    let active = true;
    const watchdog = setTimeout(() => {
      if (!active) return;
      console.error('[splash] Intro did not become ready; continuing without a loading indicator.');
      setHtml(null);
      reportAnimationReady(false);
    }, STARTUP_SPLASH_LOAD_TIMEOUT_MS);
    loadWatchdog.current = watchdog;

    void splashHtmlPromise.then((result) => {
      if (!active || readyReported.current) return;
      if ('error' in result) {
        console.error('[splash] Could not load the branded intro.', result);
        reportAnimationReady(false);
        return;
      }
      setHtml(result.html);
    });
    return () => {
      active = false;
      clearTimeout(watchdog);
      if (loadWatchdog.current === watchdog) loadWatchdog.current = null;
    };
  }, [reportAnimationReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !html) return;
    let active = true;
    let readyCheck: ReturnType<typeof setTimeout>;
    const checkFrameReady = () => {
      if (!active || readyReported.current) return;
      try {
        const frame = iframeRef.current;
        const readyState = frame?.contentDocument?.readyState;
        if (readyState && readyState !== 'loading') {
          requestAnimationFrame(() => reportAnimationReady(true));
          return;
        }
      } catch {
        // srcDoc is same-origin in Expo Web, but keep the native/browser
        // fallback path working if a browser restricts frame inspection.
      }
      readyCheck = setTimeout(checkFrameReady, 16);
    };
    readyCheck = setTimeout(checkFrameReady, 0);
    return () => {
      active = false;
      clearTimeout(readyCheck);
    };
  }, [html, reportAnimationReady]);

  const rootStyle = [
    styles.root,
    overlay && styles.overlay,
    { backgroundColor: colors.splashBackground },
  ];

  return (
    <View style={rootStyle}>
      <StatusBar style="light" hidden={Platform.OS !== 'web'} />
      {html
        ? Platform.OS === 'web'
          ? React.createElement('iframe' as never, {
            title: 'OG Landmark animated splash',
            ref: iframeRef,
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
              <WebView<{}>
                ref={webViewRef}
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
        : null}
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
});
