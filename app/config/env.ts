import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 開発環境用の WebSocket URL を取得
 * - Android エミュレータ: 10.0.2.2
 * - それ以外 (iOS シミュレータ / 物理端末 / Expo Go): Metro ホスト IP
 * 本番環境では wss プロトコルを返す
 */
export const getDevWsBaseUrl = (): string => {
  // 本番ビルドの場合
  if (!__DEV__) {
    return 'wss://api.talknote.app/api/v1/stt/stream';
  }

  // Android エミュレータ
  if (Platform.OS === 'android') {
    return 'ws://10.0.2.2:8000/api/v1/stt/stream';
  }

  // Expo Go / iOS シミュレータ / 物理端末
  // Expo SDK 50+: Constants.expoConfig?.hostUri が undefined の場合があるため、
  // 旧 manifest データの debuggerHost もフォールバックとして参照する
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    'localhost:8081';
  const host = hostUri.split(':')[0];
  
  // 物理デバイスの場合、ローカルIPアドレスを使用
  const wsUrl = `ws://${host}:8000/api/v1/stt/stream`;
  
  // デバッグログ
  console.log(`[ENV] WebSocket URL: ${wsUrl}`);
  console.log(`[ENV] hostUri: ${hostUri}, host: ${host}`);
  console.log(`[ENV] expoConfig?.hostUri: ${Constants.expoConfig?.hostUri}`);
  console.log(`[ENV] manifest?.debuggerHost: ${(Constants as any).manifest?.debuggerHost}`);
  
  return wsUrl;
};

// 旧コード互換のためのエイリアス
export const getWsUrl = getDevWsBaseUrl;

/**
 * 開発環境用の API ベース URL を取得
 */
export const getApiBaseUrl = (): string => {
  // 本番ビルドの場合
  if (!__DEV__) {
    return 'https://api.talknote.app';
  }

  // Android エミュレータ
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  // Expo Go / iOS シミュレータ / 物理端末
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    'localhost:8081';
  const host = hostUri.split(':')[0];
  
  // デバッグログ
  const apiUrl = `http://${host}:8000`;
  console.log(`[ENV] API URL: ${apiUrl}`);
  
  return apiUrl;
};

export default {
  getDevWsBaseUrl,
  getWsUrl,
  getApiBaseUrl,
};