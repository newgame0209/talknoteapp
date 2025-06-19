export default ({ config }) => ({
  ...config,
  name: 'しゃべるノート',
  slug: 'talknote',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yumishijikken.talknote',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.yumishijikken.talknote',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    // './plugins/withDigitalInk', // 一時的に無効化（ML Kit用）
  ],
  extra: {
    eas: {
      projectId: '289c2b35-e74b-4c11-abc4-d0c7e2f9df79',
    },
  },
  sdkVersion: '53.0.0',
}); 