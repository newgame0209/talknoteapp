import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Linking, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AudioRecorder } from '../../utils/audioHelpers';
import { Audio } from 'expo-av';
import { getWsUrl } from '../../config/env';
import { STTSocket, STTResult } from '../../services/sttSocket'; // Ensure named import
import { auth } from '../../services/firebase';
import { saveRecording, generateAITitle, getAllNotes } from '../../services/database';
import { mediaApi } from '../../services/api';
import axios from 'axios';
import { getCurrentIdToken } from '../../services/auth';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import api from '../../services/api';

/**
 * 録音画面
 * 音声録音と文字起こし機能を提供
 * Figmaデザインに合わせて実装
 */
const RecordScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'processing'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [interimTranscription, setInterimTranscription] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  // 🆕 ノート作成処理用ローディング状態
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const audioRecorder = useRef(new AudioRecorder()).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sttSocketRef = useRef<STTSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // 波形アニメーション用
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef<Animated.CompositeAnimation | null>(null);
  // 波形の高さをランダムに生成（より自然な波に見せるため）
  const waveHeights = useRef(Array.from({ length: 40 }, () => Math.random())).current;

  // WebSocket接続を初期化
  const initializeSTTSocket = async () => {
    try {
      // 🚨 強制デバッグ: STTSocket初期化詳細
      console.log('🚨 [initializeSTTSocket] 初期化開始');
      console.log('[RecordScreen] STTSocket初期化開始');
      setIsConnecting(true);
      
      // 既存の接続があれば閉じる
      if (sttSocketRef.current) {
        console.log('🚨 [initializeSTTSocket] 既存接続をクローズ');
        console.log('[RecordScreen] 既存のWebSocket接続を閉じます');
        sttSocketRef.current.closeConnection(); // disconnect() から closeConnection() に変更
      }
      
      // 🚨 強制デバッグ: WebSocket URL取得
      console.log('🚨 [initializeSTTSocket] WebSocket URL取得中...');
      const wsUrl = getWsUrl(); // WebSocket URLを取得
      console.log('🚨 [initializeSTTSocket] 取得したWebSocket URL:', wsUrl);
      // 🚨 強制デバッグ: 認証情報取得
      console.log('🚨 [initializeSTTSocket] 認証情報取得中...');
      const currentUser = auth.currentUser;
      console.log('🚨 [initializeSTTSocket] currentUser:', currentUser ? 'あり' : 'なし');
      let idToken: string | null = null;

      if (!currentUser) {
        console.warn('🚨 [initializeSTTSocket] ユーザー未認証 - デモモード');
        console.warn('[RecordScreen] ユーザーが認証されていません。デモモードで続行します。');
        idToken = 'demo_token_for_development'; // デモトークン
      } else {
        console.log('🚨 [initializeSTTSocket] IDトークン取得中...');
        console.log('[RecordScreen] 認証済みユーザーのIDトークンを取得中');
        idToken = await currentUser.getIdToken();
        console.log('🚨 [initializeSTTSocket] IDトークン取得:', idToken ? '成功' : '失敗');
      }

      const sttConfig = {
        sample_rate_hertz: 16000, // 適切なサンプルレートに設定
        language_code: 'ja-JP',
        enable_automatic_punctuation: true,
        interim_results: true, // 中間結果を有効化（リアルタイム表示のため）
      };

      // 🚨 強制デバッグ: STTSocket作成
      console.log('🚨 [initializeSTTSocket] STTSocket作成開始');
      console.log('🚨 [initializeSTTSocket] 設定:', sttConfig);
      console.log('[RecordScreen] 新しいSTTSocket接続を作成');
      
      // 🚨 強制デバッグ: 作成前パラメータ確認
      console.log('🚨 [initializeSTTSocket] 作成パラメータ:');
      console.log('🚨   - URL:', wsUrl);
      console.log('🚨   - Token長:', idToken ? idToken.length : 0);
      console.log('🚨   - Config:', JSON.stringify(sttConfig));
      
      sttSocketRef.current = new STTSocket(
        wsUrl, 
        idToken,
        sttConfig,
        // Callbacks
        () => { // onOpen
          console.log('[RecordScreen] STT WebSocket接続完了');
          setIsConnecting(false);
        },
        (result) => { // onMessage
          console.log('[RecordScreen] 文字起こし結果を受信:', result);
          
          if (result.text) {
            if (result.isFinal) {
              // 最終結果の場合、確定テキストに追加して中間結果をクリア
              console.log('[RecordScreen] 最終結果を追加:', result.text);
            setTranscription(prev => {
              const newText = result.text.trim();
                // 前のテキストがある場合はスペースで区切る
                if (prev.length > 0) {
                return prev + ' ' + newText;
              } else {
                  return newText;
              }
            });
              // 中間結果をクリア
              setInterimTranscription('');
            } else {
              // 中間結果の場合、中間結果を更新
              console.log('[RecordScreen] 中間結果を更新:', result.text);
              setInterimTranscription(result.text);
            }
            
            // スクロールを最下部に
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        },
        (error) => { // onError
          console.error('[RecordScreen] STT WebSocketエラー:', error);
          setIsConnecting(false);
          Alert.alert('エラー', '文字起こしサーバーに接続できませんでした。');
        },
        () => { // onClose
          console.log('[RecordScreen] STT WebSocket接続終了');
          setIsConnecting(false);
        }
      );
      
      // 🚨 強制デバッグ: 接続開始判定
      console.log('🚨 [initializeSTTSocket] 接続開始判定:', idToken ? 'トークンあり' : 'トークンなし');
      
      if (idToken) {
        console.log('🚨 [initializeSTTSocket] STTSocket.connect()呼び出し中...');
        console.log(`[RecordScreen] WebSocket接続を開始 (URL: ${wsUrl}, Token: ${idToken ? 'あり' : 'なし'})`);
        
        // 🚨 強制デバッグ: connect()実行直前
        console.log('🚨 [initializeSTTSocket] sttSocketRef.current:', sttSocketRef.current ? 'あり' : 'なし');
        
        sttSocketRef.current.connect(); // 引数なしでconnectを呼び出し
        console.log('🚨 [initializeSTTSocket] STTSocket.connect()呼び出し完了');
      } else {
        // トークンがない場合はエラー処理またはデモモードの継続など
        console.error('🚨 [initializeSTTSocket] IDトークンなし - 接続中止');
        console.error('[RecordScreen] IDトークンが取得できませんでした。接続を開始できません。');
        setIsConnecting(false);
        Alert.alert('エラー', '認証情報が取得できず、サーバーに接続できません。');
      }

    } catch (error) {
      console.error('[RecordScreen] STTSocket初期化または接続エラー:', error);
      setIsConnecting(false);
      Alert.alert('エラー', '文字起こしサービスの初期化に失敗しました。');
    }
  };
  
  // オーディオデータ送信用コールバック
  const handleAudioData = (data: ArrayBuffer) => {
    console.log(`[RecordScreen] オーディオデータ受信: ${data.byteLength} バイト`);
    if (sttSocketRef.current) {
      console.log('[RecordScreen] WebSocketでオーディオデータを送信');
      sttSocketRef.current.sendAudioData(data);
    } else {
      console.warn('[RecordScreen] STT WebSocketが存在しないためデータ送信をスキップ');
    }
  };
  
  // 録音開始
  const startRecording = async () => {
    try {
      console.log('[RecordScreen] 録音開始処理を開始');
      // 文字起こし初期化
      setTranscription('');
      setInterimTranscription('');
      
      // マイク権限の確認
      console.log('[RecordScreen] マイク権限をリクエスト中...');
      const { status } = await Audio.requestPermissionsAsync();
      console.log(`[RecordScreen] マイク権限ステータス: ${status}`);
      
      // WebSocket接続を初期化
      console.log('[RecordScreen] WebSocket接続を初期化中...');
      await initializeSTTSocket();
      
      // 録音開始（オーディオデータコールバックを設定）
      console.log('[RecordScreen] 録音を開始中...');
      await audioRecorder.startRecording(handleAudioData);
      audioRecorder.setDataUpdateInterval(250); // 500ms → 250ms に変更（よりリアルタイムに）
      console.log('[RecordScreen] 録音開始完了');
      
      setRecordingState('recording');
      setRecordingTime(0);
      
      // タイマー開始
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 波形アニメーション開始
      startWaveAnimation();
    } catch (error) {
      console.error('録音開始エラー:', error);
      Alert.alert('エラー', '録音の開始に失敗しました。');
    }
  };

  // 録音一時停止
  const pauseRecording = async () => {
    if (recordingState === 'recording') {
      try {
        await audioRecorder.pauseRecording();
        setRecordingState('paused');
        
        // タイマー停止
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // 波形アニメーション停止
        stopWaveAnimation();
      } catch (error) {
        console.error('録音一時停止エラー:', error);
      }
    } else if (recordingState === 'paused') {
      try {
        // 録音再開
        await audioRecorder.resumeRecording();
        setRecordingState('recording');
        
        // タイマー再開
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        
        // 波形アニメーション再開
        startWaveAnimation();
      } catch (error) {
        console.error('録音再開エラー:', error);
      }
    }
  };

  // 録音停止
  const stopRecording = async () => {
    try {
      const fileUri = await audioRecorder.stopRecording();
      
      // 🆕 処理中状態に変更
      setRecordingState('processing');
      setIsCreatingNote(true);
      setProcessingStatus('録音を保存しています...');
      
      // タイマー停止
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // 波形アニメーション停止
      stopWaveAnimation();
      
      // WebSocketに終了を通知して切断
      if (sttSocketRef.current) {
        sttSocketRef.current.sendEndOfStream();
        sttSocketRef.current.closeConnection();
        sttSocketRef.current = null;
      }
      
      // 録音データをデータベースに保存
      const recordingId = Crypto.randomUUID();
      const rawTranscription = transcription + (interimTranscription ? ' ' + interimTranscription : '');
      
      // 🆕 AI文章整形処理
      let finalTranscription = rawTranscription;
      if (rawTranscription.length > 0) {
        console.log('🔍 録音文字起こしのAI整形処理開始...');
        setProcessingStatus('AIが文章を整形しています...');
        try {
          const enhancedText = await enhanceTranscriptionWithAI(rawTranscription);
          finalTranscription = enhancedText;
          console.log('✅ 録音文字起こしのAI整形完了:', {
            originalLength: rawTranscription.length,
            enhancedLength: enhancedText.length
          });
        } catch (error) {
          console.error('⚠️ 録音文字起こしのAI整形エラー:', error);
          // エラー時は元のテキストを使用
          finalTranscription = rawTranscription;
        }
      }
      
      // タイトル生成：文字起こしがある場合はAI生成、ない場合は日付ベース
      let title: string;
      if (finalTranscription.length > 0) {
      // AIタイトル生成のために仮タイトルをセット
        title = "AIがタイトルを生成中…";
      } else {
        // 文字起こしがない場合は日付ベースのタイトルを生成（重複チェック付き）
        const today = new Date();
        const baseTitleDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const baseTitle = `録音 ${baseTitleDate}`;
        
        try {
          // 既存のノートを取得して重複チェック
          const existingNotes = await getAllNotes();
          const existingTitles = existingNotes.map(note => note.title);
          
          title = baseTitle;
          let counter = 1;
          
          // 同じベースタイトルが存在する場合は連番を付ける
          while (existingTitles.includes(title)) {
            title = `${baseTitle}（${counter}）`;
            counter++;
          }
          
          console.log('📝 録音タイトル重複チェック完了:', { baseTitle, finalTitle: title, existingCount: counter - 1 });
        } catch (titleCheckError) {
          console.log('⚠️ 録音タイトル重複チェックでエラー（デフォルトタイトル使用）:', titleCheckError);
          title = `録音 ${new Date().toLocaleString('ja-JP')}`;
        }
      }
      
      try {
        setProcessingStatus('ノートを保存しています...');
        await saveRecording(
          recordingId,
          title,
          recordingTime,
          fileUri,
          finalTranscription
        );
        console.log('録音データをデータベースに保存しました');
        
        // 文字起こしがある場合は即座にAIタイトル生成を開始
        if (finalTranscription.length > 0) {
          console.log('[Record] 録音完了後のAIタイトル生成開始');
          setProcessingStatus('AIがタイトルを生成しています...');
          // 非同期でAIタイトル生成を実行（UIをブロックしない）
          generateAITitle(recordingId, finalTranscription).catch((error) => {
            console.error('[Record] AIタイトル生成エラー:', error);
          });
        }
        
        // Cloud Storageへのアップロード処理を開始
        uploadToCloudStorage(fileUri, title, recordingId);
        
        // 🆕 処理完了後に状態をリセット
        setProcessingStatus('完了しました！');
        setTimeout(() => {
          setIsCreatingNote(false);
          setRecordingState('idle');
          setProcessingStatus('');
        // ダッシュボードに戻る
        navigation.goBack();
        }, 1000);
      
        // 成功メッセージを表示（オプション）
        // Alert.alert('保存完了', 'ノートが作成されました');
      } catch (dbError) {
        console.error('データベース保存エラー:', dbError);
        // 🆕 エラー時も状態をリセット
        setIsCreatingNote(false);
        setRecordingState('idle');
        setProcessingStatus('');
        Alert.alert('エラー', '録音データの保存に失敗しました。');
      }
      
    } catch (error) {
      console.error('録音停止エラー:', error);
      // 🆕 エラー時の状態リセット
      setIsCreatingNote(false);
      setRecordingState('idle');
      setProcessingStatus('');
      Alert.alert('エラー', '録音の停止に失敗しました。');
    }
  };

  // Cloud Storageへのアップロード処理
  const uploadToCloudStorage = async (fileUri: string, title: string, recordingId: string) => {
    try {
      console.log('Cloud Storageへのアップロードを開始:', fileUri);
      // ファイル情報を取得
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('録音ファイルが見つかりません');
      }
      const fileType = 'audio/wav';
      // Expo Go対応: FormDataでアップロード
      const uploadResult = await mediaApi.uploadFile(fileUri, fileType);
      console.log('アップロード結果:', uploadResult);
      // STT処理の開始（バックグラウンドで実行）
      // 必要に応じてpollMediaStatusなどを呼び出す
    } catch (error) {
      console.error('Cloud Storageアップロードエラー:', error);
      // エラーはログに記録するが、ユーザーには通知しない（ローカル保存は成功しているため）
    }
  };

  // メディア処理状況のポーリング
  const pollMediaStatus = async (mediaId: string, recordingId: string) => {
    try {
      const maxAttempts = 30; // 最大5分間（10秒間隔）
      let attempts = 0;
      
      const checkStatus = async () => {
        try {
          attempts++;
          const statusResponse = await mediaApi.getStatus(mediaId);
          
          console.log(`STT処理状況 (${attempts}/${maxAttempts}):`, statusResponse.status);
          
          if (statusResponse.status === 'completed') {
            console.log('STT処理完了:', statusResponse.result);
            // 必要に応じてローカルデータベースを更新
            // await updateRecordingTranscription(recordingId, statusResponse.result.transcript);
          } else if (statusResponse.status === 'error') {
            console.error('STT処理エラー:', statusResponse.error);
          } else if (attempts < maxAttempts) {
            // まだ処理中の場合は10秒後に再チェック
            setTimeout(checkStatus, 10000);
          } else {
            console.warn('STT処理のタイムアウト');
          }
        } catch (error) {
          console.error('ステータスチェックエラー:', error);
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 10000);
          }
        }
      };
      
      // 初回チェックは5秒後に実行
      setTimeout(checkStatus, 5000);
      
    } catch (error) {
      console.error('ポーリング開始エラー:', error);
    }
  };

  // 波形アニメーション開始
  const startWaveAnimation = () => {
    waveAnim.setValue(0);
    waveAnimation.current = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000, // よりスムーズなアニメーションにするために長く
        easing: Easing.inOut(Easing.sin), // 波のような動きにするために正弦波関数を使用
        useNativeDriver: false,
      })
    );
    waveAnimation.current.start();
  };

  // 波形アニメーション停止
  const stopWaveAnimation = () => {
    if (waveAnimation.current) {
      waveAnimation.current.stop();
      waveAnimation.current = null;
    }
  };

  // マイク権限の確認と要求
  const requestMicrophonePermission = async () => {
    try {
      // startRecordingに処理を委譲（内部でマイク権限チェックを行う）
      startRecording();
    } catch (error) {
      console.error('マイク権限の確認エラー:', error);
      Alert.alert('エラー', 'マイクの権限確認中にエラーが発生しました。');
    }
  };

  // Audioセッションの初期化とマイク権限の確認
  useEffect(() => {
    // Audioセッションの設定
    const setupAudio = async () => {
      try {
        // interruptionModelOSエラーを避けるための設定
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          // 以下の値は数値で指定（Audio定数が見つからないため）
          interruptionModeIOS: 1, // DO_NOT_MIX相当
          interruptionModeAndroid: 1, // DO_NOT_MIX相当
        });
      } catch (error) {
        console.error('Audioセッション設定エラー:', error);
      }
    };
    
    setupAudio();

    // 画面を離れるときにRecordingを必ず解放
  return () => {
    audioRecorder.cancelRecording(); // pause 状態でも確実に解放
    
    // WebSocket接続を閉じる
    if (sttSocketRef.current) {
        sttSocketRef.current.closeConnection();
      sttSocketRef.current = null;
    }
    
    // 音楽アプリ干渉防止のためにオーディオモードをリセット
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(err => console.log('オーディオモードリセットエラー:', err));
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopWaveAnimation();
  };
  }, []);

  // 録音時間のフォーマット (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 🆕 録音文字起こしのAI整形関数
  const enhanceTranscriptionWithAI = async (rawText: string): Promise<string> => {
    try {
      console.log('🔍 録音文字起こしのAI整形開始:', { textLength: rawText.length });
      
      // 共通 API クライアントと環境変数ユーティリティを使用してリクエストを送信
      // API ベース URL は `app/config/env.ts` の getApiBaseUrl で一元管理されています
      const response = await api.post('/api/v1/ai/enhance-scanned-text', {
        text: rawText,
        analyze_structure: true,          // 文章構造解析
        correct_grammar: true,            // 文法修正
        improve_readability: true,        // 読みやすさ向上
        format_style: 'speech_to_text',   // 🆕 音声文字起こし専用スタイル
        language: 'ja',                   // 日本語
        // 🆕 音声文字起こし専用の高度な整形オプション
        add_natural_breaks: true,         // 自然な改行・段落分け
        improve_flow: true,               // 文章の流れを改善
        remove_filler_words: true,        // 「えー」「あのー」等の除去
        add_punctuation: true,            // 適切な句読点の追加
        organize_content: true,           // 内容の論理的整理
        enhance_clarity: true,            // 明瞭性の向上
        preserve_speaker_intent: true     // 話者の意図を保持
      }, {
        // 30 秒タイムアウト。必要に応じて調整可能。
        timeout: 30000,
      });
      
      if (response.data && response.data.enhanced_text) {
        console.log('✅ 録音文字起こしAI整形完了:', {
          originalLength: rawText.length,
          enhancedLength: response.data.enhanced_text.length
        });
        return response.data.enhanced_text;
      } else {
        console.warn('⚠️ AI整形APIレスポンスが空です');
        return rawText; // フォールバック
      }
    } catch (error) {
      console.error('❌ 録音文字起こしAI整形エラー:', error);
      return rawText; // エラー時は元のテキストを返す
    }
  };

  // 🆕 ローディング画面の条件付きレンダリング
  if (isCreatingNote) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        
        {/* ローディング画面 */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            {/* ローディングアニメーション */}
            <View style={styles.loadingSpinner}>
              <Ionicons name="musical-notes" size={60} color="#4F46E5" />
            </View>
            
            {/* ローディングメッセージ */}
            <Text style={styles.loadingTitle}>ノートを作成中</Text>
            <Text style={styles.loadingMessage}>
              {processingStatus || 'しばらくお待ちください...'}
            </Text>
            
            {/* プログレスバー */}
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* ステータスバー分の余白 */}
      <View style={styles.statusBarSpace} />
      
      {/* 戻るボタン - ローディング中は無効化 */}
      <TouchableOpacity 
        style={[styles.backButton, recordingState === 'processing' && styles.disabledButton]}
        onPress={() => recordingState !== 'processing' && navigation.goBack()}
        disabled={recordingState === 'processing'}
      >
        <Ionicons name="chevron-back" size={24} color={recordingState === 'processing' ? "#ccc" : "#000"} />
      </TouchableOpacity>
      
      {/* メインコンテンツ */}
      <View style={styles.content}>
        {/* タイトル上のライン */}
        <View style={styles.dividerLine} />
        
        {/* タイトル部分 - 白背景、左寄せ、下線付きペンアイコン */}
        <View style={styles.titleContainer}>
          <View style={styles.titleWithIcon}>
            <Text style={styles.contentTitle}>新規録音</Text>
            <TouchableOpacity style={styles.editButton}>
              <FontAwesome5 name="pen" size={18} color="#4F46E5" />
              <View style={styles.penUnderline} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* タイトル下のライン */}
        <View style={styles.dividerLine} />
        
        {/* 録音情報 */}
        <View style={styles.recordingInfo}>
          {recordingState !== 'idle' && (
            <View style={styles.timeContainer}>
              {/* ピンク色の人のアイコン */}
              <View style={styles.recordingIcon}>
                <FontAwesome5 name="user" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.timeText}>{formatTime(recordingTime)}</Text>
            </View>
          )}
          
          {/* 文字起こしエリア - 録音前はガイダンスとイラスト、録音中は文字起こしを表示 */}
          {recordingState === 'idle' ? (
            <>
              {/* ガイダンステキスト */}
              <Text style={styles.guidanceText}>
                静かな環境でマイクに向かってはっきりと話してください。{'\n'}
                そうすると、高品質な文字起こしが表示されます！
              </Text>
              <View style={styles.illustrationContainer}>
                <FontAwesome5 name="microphone-alt" size={50} color="#4F46E5" />
              </View>
            </>
          ) : (
            <>
              {isConnecting && (
                <Text style={styles.connectingText}>文字起こしサーバーに接続中...</Text>
              )}
              <ScrollView 
                ref={scrollViewRef}
                style={styles.transcriptionScrollView}
                contentContainerStyle={styles.transcriptionContainer}
              >
                <Text style={styles.transcriptionText}>
                  {transcription}
                  {interimTranscription && (
                    <Text style={styles.interimText}> {interimTranscription}</Text>
                  )}
                </Text>
              </ScrollView>
            </>
          )}
        </View>
      </View>
      
      {/* 波形表示 - 録音中のみ表示、Figmaデザインの青い波形に合わせる */}
      {recordingState !== 'idle' && (
        <View style={styles.waveformContainer}>
          {Array.from({ length: 40 }).map((_, index) => {
            // ランダムな波形の高さを生成
            const baseHeight = waveHeights[index % waveHeights.length] * 20;
            
            // 波形の高さをアニメーションで変化させる
            const barHeight = waveAnim.interpolate({
              inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
              outputRange: [
                baseHeight * 0.3, 
                baseHeight * 0.8, 
                baseHeight * 0.5,
                baseHeight * 1.0,
                baseHeight * 0.6,
                baseHeight * 0.3
              ],
              extrapolate: 'clamp',
            });
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  { height: barHeight }
                ]}
              />
            );
          })}
        </View>
      )}
      
      {/* 録音コントロール - Figmaデザインに完全に合わせる */}
      <View style={[styles.controlsContainer, { paddingBottom: insets.bottom || 16 }]}>
        {recordingState === 'idle' ? (
          // 非録音時：青色のマイクボタンのみ表示
          <TouchableOpacity
            style={styles.recordButton}
            onPress={requestMicrophonePermission}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="microphone" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          // 録音中：Figmaデザイン通りの3つのコントロールボタンを表示
          <View style={styles.activeControls}>
            {/* 停止ボタン - 赤色の四角ボタン */}
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopRecording}
                activeOpacity={0.7}
              >
                <View style={styles.stopIcon} />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>録音停止</Text>
            </View>
            
            {/* 一時停止/再開ボタン - 青色の円形ボタン */}
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={pauseRecording}
                activeOpacity={0.7}
              >
                {recordingState === 'recording' ? (
                  <Ionicons name="pause" size={30} color="#FFFFFF" />
                ) : (
                  <Ionicons name="play" size={30} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <Text style={styles.controlTimeLabel}>{formatTime(recordingTime)}</Text>
            </View>
            
            {/* 設定ボタン - 青色の円形ボタン */}
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={styles.settingsButton}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>設定</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb', // Figmaデザインに合わせて背景色を変更
  },
  // ステータスバー分の余白
  statusBarSpace: {
    height: 50, // iPhoneのステータスバーの高さより少し余裕を持たせる
  },
  // 戻るボタン
  backButton: {
    position: 'absolute',
    top: 50,
    left: 10,
    zIndex: 10,
    padding: 8,
  },
  // ヘッダー関連のスタイルを削除しました
  // コンテンツスタイル - 全体を下げるためpaddingTopを増やす
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 50, // 全体をさらに下げる
  },
  // タイトルコンテナ - 白背景、左寄せに変更
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // 左寄せに変更
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF', // 背景色を白に変更
  },
  // タイトルとアイコンをまとめるコンテナ
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: 'normal', // 太字を解除
    color: '#111827',
  },
  editButton: {
    padding: 4,
    marginLeft: 8, // アイコンをテキストに近づける
  },
  // ペンアイコンの下線
  penUnderline: {
    height: 1,
    backgroundColor: '#dbdbdb',
    width: '100%',
    marginTop: 2,
  },
  // 区切り線
  dividerLine: {
    height: 1,
    backgroundColor: '#dbdbdb',
    width: '100%',
  },
  // 録音情報スタイル - 背景を削除し、余白を調整
  recordingInfo: {
    padding: 16,
    marginTop: 20, // 上の余白を増やす
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF4081', // Figmaデザインのピンク色
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
  },
  transcriptionScrollView: {
    maxHeight: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 10,
  },
  transcriptionContainer: {
    padding: 16,
    minHeight: 150,
  },
  transcriptionText: {
    fontSize: 18,
    color: '#111827',
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  connectingText: {
    fontSize: 14,
    color: '#4F46E5',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  guidanceText: {
    fontSize: 18,
    color: '#111827',
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  waveformContainer: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 'auto',
    marginBottom: 16,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  controlsContainer: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  recordButton: {
    width: 72,
    height: 72,
    backgroundColor: '#3B82F6',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginVertical: 16,
  },
  activeControls: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },
  controlGroup: {
    alignItems: 'center',
    width: '33%',
  },
  stopButton: {
    width: 64,
    height: 64,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  stopIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  pauseButton: {
    width: 64,
    height: 64,
    backgroundColor: '#3B82F6',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  controlTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  settingsButton: {
    width: 64,
    height: 64,
    backgroundColor: '#3B82F6',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  controlLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    marginTop: 8,
  },
  interimText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  // 🆕 ローディング画面のスタイル
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f6f7fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingSpinner: {
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    width: '60%', // アニメーションできるようにしたい場合は後で調整
    borderRadius: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default RecordScreen;