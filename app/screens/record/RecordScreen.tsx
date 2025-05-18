import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AudioRecorder } from '../../utils/audioHelpers';
import { Audio } from 'expo-av';

/**
 * 録音画面
 * 音声録音と文字起こし機能を提供
 * Figmaデザインに合わせて実装
 */
const RecordScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const audioRecorder = useRef(new AudioRecorder()).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 波形アニメーション用
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef<Animated.CompositeAnimation | null>(null);
  // 波形の高さをランダムに生成（より自然な波に見せるため）
  const waveHeights = useRef(Array.from({ length: 40 }, () => Math.random())).current;

  // 録音開始
  const startRecording = async () => {
    try {
      await audioRecorder.startRecording();
      setRecordingState('recording');
      setRecordingTime(0);
      
      // タイマー開始
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 波形アニメーション開始
      startWaveAnimation();
      
      // 仮の文字起こし（実際はWebSocketで受信）
      setTimeout(() => {
        setTranscription('ここに録音している自分や誰かの声が文字起こしされます。');
      }, 2000);
    } catch (error) {
      console.error('録音開始エラー:', error);
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
      setRecordingState('idle');
      
      // タイマー停止
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // 波形アニメーション停止
      stopWaveAnimation();
      
      // ここで録音ファイルをアップロードするロジックを追加
      console.log('録音ファイル:', fileUri);
      
      // 録音完了後、ダッシュボードに自動的に戻る
      navigation.goBack();
    } catch (error) {
      console.error('録音停止エラー:', error);
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
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        // 権限が付与された場合、録音を開始
        startRecording();
      } else {
        // 権限が拒否された場合
        Alert.alert(
          'マイクの権限が必要です',
          '録音機能を使用するには、マイクへのアクセスを許可してください。',
          [
            { text: 'キャンセル', onPress: () => navigation.goBack() },
            { text: '設定を開く', onPress: () => Linking.openSettings() }
          ]
        );
      }
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
        
        // 権限確認と録音開始
        requestMicrophonePermission();
      } catch (error) {
        console.error('Audioセッション設定エラー:', error);
      }
    };
    
    setupAudio();
    
    // 画面から離れるときに録音を停止
    return () => {
      if (recordingState !== 'idle') {
        stopRecording();
      }
    };
  }, []);

  // 録音時間のフォーマット (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* ステータスバー分の余白 */}
      <View style={styles.statusBarSpace} />
      
      {/* 戻るボタン */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color="#000" />
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
          <View style={styles.timeContainer}>
            {/* ピンク色の人のアイコン */}
            <View style={styles.recordingIcon}>
              <FontAwesome5 name="user" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.timeText}>{formatTime(recordingTime)}</Text>
          </View>
          
          {/* 文字起こしエリア - 録音前はガイダンスとイラスト、録音中は文字起こしを表示 */}
          {recordingTime === 0 ? (
            <>
              {/* ガイダンステキストを背景なしでそのまま表示 */}
              <Text style={styles.guidanceText}>
                高品質な文字起こし結果を得るために、静かな環境でマイクに向かってはっきりと話してください。
              </Text>
              {/* マイクのイラストのみ表示 */}
              <View style={styles.illustrationContainer}>
                <FontAwesome5 name="microphone-alt" size={50} color="#4F46E5" />
              </View>
            </>
          ) : (
            <Text style={styles.transcriptionText}>
              {transcription || 'ここに録音している自分や誰かの声が文字起こしされます。'}
            </Text>
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
            onPress={startRecording}
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
            
            {/* 一時停止/再開ボタン - 青枠の円形ボタン */}
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={pauseRecording}
                activeOpacity={0.7}
              >
                {recordingState === 'recording' ? (
                  <Ionicons name="pause" size={30} color="#3B82F6" />
                ) : (
                  <Ionicons name="play" size={30} color="#3B82F6" />
                )}
              </TouchableOpacity>
              <Text style={styles.controlTimeLabel}>{formatTime(recordingTime)}</Text>
            </View>
            
            {/* 設定ボタン - 青枠の円形ボタン */}
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={styles.settingsButton}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={24} color="#3B82F6" />
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
    fontSize: 24,
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
  transcriptionContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 60,
  },
  transcriptionText: {
    fontSize: 18, // ディスレクシアの方にも読みやすいサイズ
    color: '#111827', // コントラストを高めるために色を濃く
    lineHeight: 28, // 行間を広げて読みやすく
    fontWeight: '400',
    letterSpacing: 0.5, // 文字間隔を広げて読みやすく
  },
  // 録音前のガイダンステキスト
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
  // イラストのコンテナ
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  // 波形表示スタイル - Figmaデザインに合わせて青色の波形を表示
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
    backgroundColor: '#3B82F6', // 青色
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  // コントロールコンテナ
  controlsContainer: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  // 録音ボタン　- Figmaデザインに合わせて青色円形ボタン
  recordButton: {
    width: 72,
    height: 72,
    backgroundColor: '#3B82F6', // 青色
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
  // 録音中コントロール
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
  // 停止ボタン - Figmaデザインの赤色四角ボタン
  stopButton: {
    width: 56,
    height: 56,
    backgroundColor: '#EF4444', // 赤色
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  stopIcon: {
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  // 一時停止/再開ボタン - Figmaデザインの青枠円形ボタン
  pauseButton: {
    width: 72,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6', // 青色
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // 時間表示ラベル - Figmaデザインに合わせてボタン下に表示
  controlTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  // 設定ボタン - Figmaデザインの青枠円形ボタン
  settingsButton: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6', // 青色
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // コントロールラベル - Figmaデザインに合わせてボタン下に表示
  controlLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
});

export default RecordScreen;