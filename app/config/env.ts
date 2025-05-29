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

  // 開発環境では実機用IPアドレスを使用
  const wsUrl = 'ws://192.168.0.46:8002/api/v1/stt/stream';
  
  // デバッグログ
  console.log(`[ENV] WebSocket URL: ${wsUrl}`);
  
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

  // 開発環境では実機用IPアドレスを使用
  const apiUrl = 'http://192.168.0.46:8000';
  console.log(`[ENV] API URL: ${apiUrl}`);
  
  return apiUrl;
};

export default {
  getDevWsBaseUrl,
  getWsUrl,
  getApiBaseUrl,
};