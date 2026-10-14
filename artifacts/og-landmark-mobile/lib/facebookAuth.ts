import { useCallback, useState } from 'react';
import { ResponseType } from 'expo-auth-session';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() || '';
const facebookRedirectUri =
  process.env.EXPO_PUBLIC_FACEBOOK_REDIRECT_URI?.trim() ||
  'og-land-mobile://oauthredirect';

export type SocialLoginResult = {
  success: boolean;
  error?: string;
};

export function useFacebookAuth(
  onAccessToken: (accessToken: string) => Promise<SocialLoginResult>,
) {
  const [request, , promptAsync] = Facebook.useAuthRequest(
    {
      clientId: facebookAppId || 'facebook-not-configured',
      responseType: ResponseType.Token,
      scopes: ['public_profile', 'email'],
      ...(facebookRedirectUri ? { redirectUri: facebookRedirectUri } : {}),
    },
    { scheme: 'og-land-mobile' },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = useCallback(async () => {
    if (!facebookAppId) {
      setError('Facebook login is not configured yet. Please use email login.');
      return;
    }
    if (!request) {
      setError('Facebook login is still loading. Please try again.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') {
        setError('Facebook login was not completed. Please try again.');
        return;
      }
      const accessToken = result.authentication?.accessToken || result.params?.access_token;
      if (!accessToken) {
        setError('Facebook did not return a valid login token.');
        return;
      }
      const loginResult = await onAccessToken(accessToken);
      if (!loginResult.success) {
        setError(loginResult.error || 'Facebook login failed. Please try again.');
      }
    } catch (authError) {
      console.error('Facebook login error:', authError);
      setError('Unable to connect to Facebook. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onAccessToken, promptAsync, request]);

  return { signIn, loading, error };
}
