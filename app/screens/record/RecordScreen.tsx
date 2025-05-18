import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import { AudioRecorder } from '../../utils/audioHelpers';

/**
 * 録音画面
 * 音声録音と文字起こし機能を提供
 */
const RecordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const audioRecorder = useRef(new AudioRecorder()).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 波形アニメーション用
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef<Animated.CompositeAnimation | null>(null);

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
      
      // 録音完了後の処理（例：編集画面への遷移）
      // navigation.navigate('EditNote', { audioUri: fileUri, transcription });
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
        duration: 1500,
        easing: Easing.linear,
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

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingState !== 'idle') {
        audioRecorder.cancelRecording();
      }
      stopWaveAnimation();
    };
  }, [recordingState]);

  // 録音時間のフォーマット (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新規録音</Text>
        <TouchableOpacity style={styles.editButton}>
          <FontAwesome5 name="pen" size={16} color="#4F46E5" />
        </TouchableOpacity>
      </View>
      
      {/* 録音コンテンツ */}
      <View style={styles.content}>
        {/* 録音情報 */}
        <View style={styles.recordingInfo}>
          <View style={styles.timeContainer}>
            <View style={styles.recordingIcon}>
              <FontAwesome5 
                name="microphone" 
                size={16} 
                color={recordingState === 'recording' ? '#EF4444' : '#6B7280'} 
              />
            </View>
            <Text style={styles.timeText}>{formatTime(recordingTime)}</Text>
          </View>
          
          {/* 文字起こし表示エリア */}
          <View style={styles.transcriptionContainer}>
            <Text style={styles.transcriptionText}>
              {transcription || 'ここに録音している自分や誰かの声が文字起こしされます。'}
            </Text>
          </View>
        </View>
      </View>
      
      {/* 波形表示 */}
      <View style={styles.waveformContainer}>
        {/* 波形アニメーション（簡易版） */}
        {Array.from({ length: 30 }).map((_, index) => {
          // 波の高さをアニメーション
          const barHeight = waveAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [
              3 + Math.random() * 10, 
              10 + Math.random() * 20, 
              3 + Math.random() * 10
            ],
            extrapolate: 'clamp',
          });
          
          return (
            <Animated.View
              key={index}
              style={[
                styles.waveBar,
                { 
                  height: recordingState !== 'idle' ? barHeight : 3,
                  backgroundColor: recordingState === 'idle' ? '#D1D5DB' : '#4F46E5'
                }
              ]}
            />
          );
        })}
      </View>
      
      {/* 録音コントロール */}
      <View style={styles.controls}>
        {recordingState === 'idle' ? (
          <TouchableOpacity
            style={[styles.controlButton, styles.recordButton]}
            onPress={startRecording}
          >
            <FontAwesome5 name="microphone" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.activeControls}>
            {/* 停止ボタン */}
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopRecording}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
            
            {/* 一時停止/再開ボタン */}
            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={pauseRecording}
            >
              {recordingState === 'recording' ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <FontAwesome5 name="play" size={20} color="#4F46E5" />
              )}
            </TouchableOpacity>
            
            {/* 設定ボタン */}
            <TouchableOpacity
              style={[styles.controlButton, styles.settingsButton]}
            >
              <FontAwesome5 name="cog" size={20} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  recordingInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  transcriptionContainer: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    minHeight: 80,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  waveformContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#4F46E5',
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  controls: {
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordButton: {
    width: 64,
    height: 64,
    backgroundColor: '#4F46E5',
  },
  activeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 56,
    height: 56,
    backgroundColor: '#EF4444',
    marginRight: 16,
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  pauseButton: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  pauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  pauseBar: {
    width: 4,
    height: 16,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  settingsButton: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    marginLeft: 16,
  },
});

export default RecordScreen;