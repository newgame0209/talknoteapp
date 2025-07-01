import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 🚨 緊急デバッグ: 強制的に環境情報を出力
 */
const debugEnvironment = () => {
  console.log('🚨 ===== 環境デバッグ情報 =====');
  console.log(`__DEV__: ${__DEV__}`);
  console.log(`Platform.OS: ${Platform.OS}`);
  console.log(`process.env.NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`EXPO_PUBLIC_STT_BASE_URL: ${process.env.EXPO_PUBLIC_STT_BASE_URL || 'undefined'}`);
  console.log(`EXPO_PUBLIC_API_BASE_URL: ${process.env.EXPO_PUBLIC_API_BASE_URL || 'undefined'}`);
  console.log(`EXPO_PUBLIC_API_URL: ${process.env.EXPO_PUBLIC_API_URL || 'undefined'}`);
  console.log(`EXPO_PUBLIC_TTS_BASE_URL: ${process.env.EXPO_PUBLIC_TTS_BASE_URL || 'undefined'}`);
  console.log('🚨 ========================');
};

// 強制実行（アプリ起動時に必ず出力）
debugEnvironment();

/**
 * 開発環境用の WebSocket URL を取得
 * - 環境変数 EXPO_PUBLIC_STT_BASE_URL から自動取得
 */
export const getDevWsBaseUrl = (): string => {
  // 🚨 強制デバッグ: WebSocket URL生成過程
  console.log('🚨 [getDevWsBaseUrl] 実行開始');
  
  // 環境変数から取得（本番判定削除）
  const rawSttBaseUrl = process.env.EXPO_PUBLIC_STT_BASE_URL;
  const sttBaseUrl = rawSttBaseUrl || 'http://192.168.0.92:8002';
  const wsUrl = sttBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/v1/stt/stream';
  
  // 🚨 強制デバッグ: 詳細情報
  console.log('🚨 [getDevWsBaseUrl] 環境変数 EXPO_PUBLIC_STT_BASE_URL:', rawSttBaseUrl);
  console.log('🚨 [getDevWsBaseUrl] 使用するSTT Base URL:', sttBaseUrl);
  console.log('🚨 [getDevWsBaseUrl] 最終WebSocket URL:', wsUrl);
  
  // 旧ログ（互換性）
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
  // 🚨 強制デバッグ: API URL生成過程
  console.log('🚨 [getApiBaseUrl] 実行開始');
  
  // 環境変数から取得（本番判定削除）
  const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const apiUrl = rawApiUrl || rawApiBaseUrl || 'http://192.168.0.92:8000';
  
  // 🚨 強制デバッグ: 詳細情報
  console.log('🚨 [getApiBaseUrl] 環境変数 EXPO_PUBLIC_API_URL:', rawApiUrl);
  console.log('🚨 [getApiBaseUrl] 環境変数 EXPO_PUBLIC_API_BASE_URL:', rawApiBaseUrl);
  console.log('🚨 [getApiBaseUrl] 最終API URL:', apiUrl);
  
  // 旧ログ（互換性）
  console.log(`[ENV] API URL: ${apiUrl}`);
  
  return apiUrl;
};

export default {
  getDevWsBaseUrl,
  getWsUrl,
  getApiBaseUrl,
};