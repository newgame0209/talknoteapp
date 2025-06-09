import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 開発環境用の WebSocket URL を取得
 * - 環境変数 EXPO_PUBLIC_STT_BASE_URL から自動取得
 * - 本番環境では wss プロトコルを返す
 */
export const getDevWsBaseUrl = (): string => {
  // 本番ビルドの場合
  if (!__DEV__) {
    return 'wss://api.talknote.app/api/v1/stt/stream';
  }

  // 開発環境では環境変数から取得
  const sttBaseUrl = process.env.EXPO_PUBLIC_STT_BASE_URL || 'http://192.168.0.46:8002';
  const wsUrl = sttBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/v1/stt/stream';
  
  // デバッグログ
  console.log(`[ENV] STT Base URL: ${sttBaseUrl}`);
  console.log(`[ENV] WebSocket URL: ${wsUrl}`);
  
  return wsUrl;
};

// 旧コード互換のためのエイリアス
export const getWsUrl = getDevWsBaseUrl;

/**
 * 開発環境用の API ベース URL を取得
 * - 環境変数 EXPO_PUBLIC_API_URL から自動取得
 */
export const getApiBaseUrl = (): string => {
  // 本番ビルドの場合
  if (!__DEV__) {
    return 'https://api.talknote.app';
  }

  // 開発環境では環境変数から取得
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.46:8000';
  console.log(`[ENV] API URL: ${apiUrl}`);
  
  return apiUrl;
};

export default {
  getDevWsBaseUrl,
  getWsUrl,
  getApiBaseUrl,
};