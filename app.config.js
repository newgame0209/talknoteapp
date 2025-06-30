export default ({ config }) => ({
  ...config,
  name: 'しゃべるノート',
  slug: 'talknote',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'com.talknote.app',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['assets/**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.talknote.app',
    jsEngine: 'jsc',
    infoPlist: {
      NSMicrophoneUsageDescription: '録音機能を利用するためにマイクへのアクセスを許可してください。',
      NSCameraUsageDescription: '写真スキャン機能を利用するためにカメラへのアクセスを許可してください。',
      ITSAppUsesNonExemptEncryption: false,
      },

  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.talknote.app',
    jsEngine: 'jsc',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-video',
    'expo-web-browser',
    'expo-dev-client',
    'expo-apple-authentication',
    [
      'expo-build-properties',
      {
        ios: {
          infoPlist: {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: true,
              NSAllowsLocalNetworking: true,
              NSExceptionDomains: {
                '192.168.0.46': {
                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                  NSIncludesSubdomains: true,
                  NSExceptionAllowsInsecureHTTPLoads: true,
                  NSExceptionRequiresForwardSecrecy: false,
                },
                'localhost': {
                  NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                  NSIncludesSubdomains: true,
                  NSExceptionAllowsInsecureHTTPLoads: true,
                },
              },
            },
          },
        },
      },
    ],
    // './plugins/withDigitalInk', // 一時的に無効化（ML Kit用）
  ],
  extra: {
    eas: {
      projectId: '289c2b35-e74b-4c11-abc4-d0c7e2f9df79',
    },
  },
  sdkVersion: '53.0.0',
}); 