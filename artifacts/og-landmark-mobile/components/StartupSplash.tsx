import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import { prepareSplashHtml } from '@/lib/splashHtml';

const splashHtmlAsset = Asset.fromModule(
  require('@/assets/splash/og-landmark-intro.html'),
);

export function StartupSplash({
  colors,
  overlay = false,
}: {
  colors: ReturnType<typeof useColors>;
  overlay?: boolean;
  fontsReady?: boolean;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSplash = async () => {
      try {
        await splashHtmlAsset.downloadAsync();
        const source = Platform.OS === 'web'
          ? await (await fetch(splashHtmlAsset.uri)).text()
          : await FileSystem.readAsStringAsync(
              splashHtmlAsset.localUri ?? splashHtmlAsset.uri,
            );
        if (active) setHtml(prepareSplashHtml(source));
      } catch (error) {
        console.error('[splash] Could not load the branded intro.', error);
        if (active) setLoadFailed(true);
      }
    };

    void loadSplash();
    return () => {
      active = false;
    };
  }, []);

  const rootStyle = [
    styles.root,
    overlay && styles.overlay,
    { backgroundColor: colors.splashBackground },
  ];

  return (
    <View style={rootStyle}>
      <StatusBar style="light" />
      {html && Platform.OS === 'web'
        ? React.createElement('iframe' as never, {
            title: 'OG Landmark animated splash',
            srcDoc: html,
            allow: 'autoplay; fullscreen',
            frameBorder: '0',
            style: {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
            },
          })
        : html
          ? (
              <WebView
                source={{ html }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                scrollEnabled={false}
                bounces={false}
                style={styles.webView}
              />
            )
          : loadFailed
            ? (
                <View style={styles.fallback}>
                  <Text style={[styles.fallbackName, { color: colors.splashWhite }]}>
                    OG LANDMARK
                  </Text>
                  <ActivityIndicator color={colors.splashTeal} size="small" />
                </View>
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
