import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, SafeAreaView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ScrollView, Keyboard, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useDatabaseStore } from '../store/databaseStore';
import { notebooksApi, pagesApi } from '../services/api';
import DrawingCanvas, { DrawingPath, DrawingCanvasHandle } from '../components/DrawingCanvas';
import AIChatWidget from '../components/AIChatWidget';
import Ruler from '../components/Ruler'; // 📏 定規コンポーネントをインポート
import database, { 
  Recording, 
  ManualNote,
  PhotoScan,
  saveRecording, 
  saveManualNote,
  updateNote, 
  updateCanvasData,
  updateNoteTitle,
  updateManualNoteTitle,
  getPhotoScans,
  getManualNotes,
  generateManualNoteAITitle,
  getDatabase
} from '../services/database';
  import { useAutoSave, ToolbarFunction } from '../hooks/useAutoSave';
  import { UniversalNoteService } from '../services/UniversalNoteService';
  import { UniversalNote, NoteType } from '../types/UniversalNote';

  // 🎤 TTS関連のimport追加
  import { TTSAudioPlayer } from '../utils/audioHelpers';
  import { TTSClient } from '../services/TTSClient';
  import { splitIntoSentencesWithDetails } from '../utils/textSplitter';
  // expo-av を直接ラップした独自 AudioPlayer クラスを使用
  import { AudioPlayer } from '../utils/audioHelpers';
  import HandwritingTTSClient from '../services/HandwritingTTSClient';
import { preprocessTextForTTS } from '../utils/ttsPreprocessor';
  // 📱 デバイス判定ユーティリティ
  import { isTablet, isIPad, getDeviceInfo } from '../utils/deviceUtils';

  // 🎤 リアルタイム文字起こし機能のimport追加
  import { AudioRecorder } from '../utils/audioHelpers';
  import { STTSocket, STTResult } from '../services/sttSocket';

  // 🎤 TTS関連の型定義追加
  interface TTSSentence {
    text: string;
    start_time: number;
    end_time: number;
    start_index: number;
    end_index: number;
  }

  interface TTSPlaybackState {
    isPlaying: boolean;
    currentPosition: number;
    duration: number;
    currentSentenceIndex: number;
    sentences: TTSSentence[];
  }

  // 画面遷移の型定義
type RootStackParamList = {
  CanvasEditor: { 
    noteId: string; 
    isNewNote?: boolean;
  };
};

type CanvasEditorRouteProp = RouteProp<RootStackParamList, 'CanvasEditor'>;
type CanvasEditorNavigationProp = StackNavigationProp<RootStackParamList, 'CanvasEditor'>;

// ツールの種類定義
type ToolType = 'pen' | 'keyboard' | 'voice' | null;
type PenToolType = 'pen' | 'pencil' | 'eraser' | 'marker' | null;
// キーボードツール用の型定義を追加
type KeyboardToolType = 'textType' | 'font' | 'size' | 'color' | 'bold' | 'spacing' | null;
type TextType = 'heading1' | 'heading2' | 'heading3' | 'body';
type FontType = 'standard' | 'dyslexia' | 'serif' | 'gothic'; // フォントタイプの型を拡張

interface CanvasEditorProps {}

const CanvasEditor: React.FC<CanvasEditorProps> = () => {
  const route = useRoute<CanvasEditorRouteProp>();
  const navigation = useNavigation<CanvasEditorNavigationProp>();
  const { noteId, isNewNote } = route.params;
  const { getNoteById, updateNote, saveRecording } = useDatabaseStore();
  
  // 🔧 Safe Area設定：ステータスバーとの重なりを防ぐ
  const insets = useSafeAreaInsets();

  // ノートブック・ページ管理用の状態
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [initialTitle, setInitialTitle] = useState<string | null>(null);
  const [newNoteId, setNewNoteId] = useState<string | null>(null); // 新規作成時のノートID
  // 実際に使用するノートIDを動的に決定
  const actualNoteId = isNewNote ? newNoteId : noteId;

  // 📸 写真スキャンノート判定と関連状態
  const [isPhotoScanNote, setIsPhotoScanNote] = useState<boolean>(false);

  // 📱 デバイス判定状態管理（iPad版対応）
  const deviceInfo = getDeviceInfo();
  const isTabletDevice = deviceInfo.isTablet;
  const isIPadDevice = deviceInfo.isIPad;

  // 🎵 Phase 4: 音声プレイヤー表示状態管理（全ノート共通）
  const [showAudioPlayer, setShowAudioPlayer] = useState<boolean>(false);
  const [audioPlayState, setAudioPlayState] = useState<'playing' | 'paused'>('paused');
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);

  // 🔍 Phase 5: OCR処理状態管理



  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isCanvasIconsVisible, setIsCanvasIconsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // ✨ 選択テキスト管理
  const [textSelection, setTextSelection] = useState<{start: number, end: number}>({start: 0, end: 0});
  
  // ツール選択状態管理
  const [selectedTool, setSelectedTool] = useState<ToolType>(null);
  // ペンツール内の選択状態管理
  const [selectedPenTool, setSelectedPenTool] = useState<PenToolType>(null);
  // キーボードツール内の選択状態管理
  const [selectedKeyboardTool, setSelectedKeyboardTool] = useState<KeyboardToolType>(null);
  
  // 📏 線の太さとカラー設定の詳細表示状態
  const [showStrokeSettings, setShowStrokeSettings] = useState<boolean>(false);
  const [showColorSettings, setShowColorSettings] = useState<boolean>(false);
  
  // テキストタイプの状態管理
  const [selectedTextType, setSelectedTextType] = useState<TextType>('body');
  // フォントタイプの状態管理
  const [selectedFont, setSelectedFont] = useState<FontType>('standard'); // 型を更新
  // テキストサイズ設定
  const [fontSize, setFontSize] = useState<number>(16);
  // テキストカラー設定
  const [textColor, setTextColor] = useState<string>('#000000');
  // 太字設定
  const [isBold, setIsBold] = useState<boolean>(false);
  // 行間・文字間隔設定
  const [lineSpacing, setLineSpacing] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  // 選択された色
  const [selectedColor, setSelectedColor] = useState<string>('#000000');

  // 音声録音状態管理
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0); // 秒単位
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎤 リアルタイム文字起こし機能のインスタンス
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const sttSocketRef = useRef<STTSocket | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>(''); // 確定した文字起こし結果
  const [interimText, setInterimText] = useState<string>(''); // 中間結果（リアルタイム表示用）
  const transcribedTextRef = useRef<string>(''); // 🔧 最新のtranscribedTextを参照するためのRef

  // 🎤 リアルタイム文字起こし機能の初期化
  useEffect(() => {
    // AudioRecorderの初期化
    audioRecorderRef.current = new AudioRecorder();
    // 250ms間隔でデータ送信するように設定（stt.mdcの仕様）
    audioRecorderRef.current.setDataUpdateInterval(250);

    // STTSocketの初期化
    const sttBaseUrl = process.env.EXPO_PUBLIC_STT_BASE_URL || 'http://192.168.0.92:8002';
    const wsUrl = sttBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/v1/stt/stream';
    
    const sttConfig = {
      sample_rate_hertz: 16000,
      language_code: 'ja-JP',
      enable_automatic_punctuation: true,
      interim_results: true
    };

    sttSocketRef.current = new STTSocket(
      wsUrl,
      null, // 開発環境ではtokenなし
      sttConfig,
      () => console.log('🎤 STT WebSocket接続成功'),
      (result: STTResult) => {
        // リアルタイム文字起こし結果を受信
        console.log('🎤 文字起こし結果:', result);
        if (result.isFinal) {
          // 確定結果の場合は蓄積
          setTranscribedText(prev => {
            const newText = prev + result.text;
            transcribedTextRef.current = newText; // 🔧 Refも同期更新
            return newText;
          });
          // 中間結果をクリア
          setInterimText('');
        } else {
          // 中間結果はリアルタイム表示
          setInterimText(result.text);
          console.log('🎤 中間結果:', result.text);
        }
      },
      (error) => console.error('🎤 STT WebSocketエラー:', error),
      () => console.log('🎤 STT WebSocket接続終了')
    );

    // クリーンアップ
    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancelRecording().catch(console.error);
      }
      if (sttSocketRef.current) {
        sttSocketRef.current.closeConnection();
      }
    };
  }, []);

  // 描画関連の状態管理
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[]>([]); // 削除されたパスを保存
  const [strokeWidth, setStrokeWidth] = useState<number>(2); // デフォルト線の太さ（細め）

  // 🚨 保存競合防止用フラグ
  const [isSaving, setIsSaving] = useState(false);

  // ✨ シンプルな自動保存タイマー（5秒間隔）
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 📊 Step 1: 文字数カウント機能（デバッグ用）
  const [characterCount, setCharacterCount] = useState<number>(0);
  const [showCharacterCount, setShowCharacterCount] = useState<boolean>(false); // 🔧 本番用に非表示

  // 📊 文字数カウント関数（テキストのみ、手書きパス除外）
  const getTextCharacterCount = useCallback((text: string): number => {
    // 純粋なテキスト文字数をカウント（改行・空白も含む）
    return text.length;
  }, []);

  // 📊 文字数リアルタイム監視
  useEffect(() => {
    const charCount = getTextCharacterCount(content);
    setCharacterCount(charCount);
    
    if (__DEV__) {
      console.log(`📝 現在の文字数: ${charCount}/2000`);
    }
  }, [content, getTextCharacterCount]);

  // 📊 Step 2: 分割検知機能
  const [needsSplit, setNeedsSplit] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(0);

  // 📊 分割位置を決定する関数
  const findSplitPosition = useCallback((text: string, maxLength: number = 2000): number => {
    if (text.length <= maxLength) {
      return -1; // 分割不要
    }

    // 「1文字残して」強制分割するためのハードリミット
    const hardLimit = maxLength - 1; // 1999文字目
    const searchStart = Math.max(0, hardLimit - 100);
    
    // 改行優先で探索（1999〜1899文字目まで）
    for (let i = hardLimit; i >= searchStart; i--) {
      if (text[i] === '\n') {
        console.log(`📄 改行での分割位置発見 - ${i}文字目`);
        return i + 1; // 改行直後で分割
      }
    }
    
    // 改行が無ければ1999文字目で強制分割
    console.log(`📄 強制分割位置 - ${hardLimit}文字目`);
    return hardLimit;
  }, []);

  // 📊 分割検知ロジック
  const checkSplitNeeded = useCallback((text: string) => {
    const splitPos = findSplitPosition(text);
    
    if (splitPos > 0) {
      setNeedsSplit(true);
      setSplitPosition(splitPos);
      console.log(`📄 Step 2: 分割が必要です - 位置: ${splitPos}, 文字数: ${text.length}`);
      return true;
    } else {
      setNeedsSplit(false);
      setSplitPosition(0);
      return false;
    }
  }, [findSplitPosition]);

  // 🚨 削除：重複useEffectを除去（分割実行useEffectに統一）

  // 🆕 ノートタイプ判定関数（早期定義）
  const determineNoteType = (): NoteType => {
    // 🚨 写真スキャンノートの判定を最優先に
    if (noteId?.includes('photo_scan') || noteId?.startsWith('photo_scan_')) {
      return 'photo_scan';
    }
    if (recordingState !== 'idle') {
      return 'recording';
    }
    if (noteId?.includes('import')) {
      return 'import';
    }
    return 'manual';
  };

  // 🎯 新しい統一自動保存Hook
  const { 
    markChanged, 
    performSave,
    flushSave, // 🆕 確実な保存関数を追加
    hasUnsavedChanges: autoSaveHasUnsavedChanges, 
    isSaving: autoSaveIsSaving 
  } = useAutoSave({
    noteId: actualNoteId || newNoteId || noteId || '',
    noteType: determineNoteType(),
    getCurrentCanvasData: () => {
      // 🆕 現在のページデータを最新状態に同期
      const currentPageData = {
        type: 'canvas' as const,
        version: '1.0' as const,
        content: content,
        drawingPaths: drawingPaths,
        textElements: [],
        canvasSettings: {
          selectedTool,
          selectedPenTool,
          selectedColor,
          strokeWidth,
          textSettings: {
            fontSize,
            textColor,
            selectedFont,
            selectedTextType,
            isBold,
            lineSpacing,
            letterSpacing
          }
        },
        contentLength: content.length,
        pathsCount: drawingPaths.length,
        elementsCount: 0
      };

      // 🆕 マルチページ対応: 現在のページデータを配列に反映
      if (pages.length > 0) {
        const updatedPages = [...pages];
        if (updatedPages[currentPageIndex]) {
          updatedPages[currentPageIndex] = {
            ...updatedPages[currentPageIndex],
            content: content,
            drawingPaths: drawingPaths,
            canvasData: currentPageData
          };
        }
        
        // 🔥 CRITICAL: ページ削除反映のため、最新のページ配列を確実に保存
        console.log('📄 getCurrentCanvasData - マルチページ保存:', {
          pagesLength: updatedPages.length,
          currentPageIndex,
          totalPages
        });
        
        // マルチページデータを含むキャンバスデータを返す
        return {
          ...currentPageData,
          // 🆕 マルチページ情報を追加（削除後の最新状態を反映）
          multiPageData: {
            pages: updatedPages,
            currentPageIndex: currentPageIndex,
            totalPages: updatedPages.length // totalPagesも実際のページ数に同期
          }
        };
      }
      
      // 単一ページの場合は従来通り
      return currentPageData;
    },
    getTitle: () => title,
    debugMode: true
  });

  // 📏 線の太さの定義（3段階）
  const strokeOptions = {
    thin: { value: 2, label: '細め' },
    medium: { value: 6, label: '普通' },
    thick: { value: 12, label: '太字' }
  };

  // 📏 現在の線の太さタイプを取得
  const getCurrentStrokeType = (): 'thin' | 'medium' | 'thick' => {
    if (strokeWidth <= 2) return 'thin';
    if (strokeWidth <= 6) return 'medium';
    return 'thick';
  };

  // 🔍 drawingPaths状態の変化を監視（デバッグ用）
  useEffect(() => {
    // console.log('🎨 CanvasEditor: drawingPaths state changed', {
    //   pathsLength: drawingPaths.length,
    //   paths: drawingPaths.map((p, i) => ({ 
    //     index: i, 
    //     tool: p.tool, 
    //     color: p.color, 
    //     timestamp: p.timestamp,
    //     pathLength: p.path.length
    //   }))
    // });
  }, [drawingPaths]);



  // カラーパレット定義
  const getColorPalette = () => {
    if (selectedPenTool === 'marker') {
      // マーカー用カラーパレット（明るい色メイン）
      return ['#FFFF00', '#FFD700', '#FFA500', '#FF69B4', '#00FFFF', '#90EE90', '#FF6347', '#DDA0DD', '#F0E68C', '#FFB6C1', '#87CEFA'];
    } else if (selectedPenTool === 'pencil') {
      // 鉛筆用カラーパレット（濃い色メイン）
      return ['#000000', '#333333', '#666666', '#999999', '#8B4513', '#2F4F4F', '#800000', '#000080', '#006400', '#4B0082', '#8B0000'];
    } else {
      // ペン用カラーパレット（基本11色）
      return ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080', '#FFD700', '#FF69B4', '#00FFFF', '#A52A2A', '#808080'];
      }
    };

  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  
  // 🎯 Phase 2: 自動スクロール機能用のref
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 🎯 Phase 2: 自動スクロール機能用の状態
  const lineCoordinates = useRef<Record<number, number>>({});
  const lastManualScrollTime = useRef<number>(0);
  const AUTO_SCROLL_DELAY = 5000; // 5秒間は自動スクロール停止

  // 📝 ノートブック・ページの初期化（新規作成）
  useEffect(() => {
    const initializeNotebookAndPage = async () => {
      if (notebookId && pageId) return; // 既に初期化済み
      
      // 新規作成の場合、ローカル用のダミーノートを作成
      if (isNewNote) {
              try {
        
          // デフォルトタイトル生成（ノート2025-06-04形式）
          const today = new Date();
          const baseTitleDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const baseTitle = `ノート${baseTitleDate}`;
          
          // 重複チェックと連番付与
          let finalTitle = baseTitle;
          let counter = 1;
          
          try {
            // 既存のノートを取得して重複チェック
            const existingNotes = await database.getAllNotes();
            const existingTitles = existingNotes.map(note => note.title);
        
            // 同じベースタイトルが存在する場合は連番を付ける
            while (existingTitles.includes(finalTitle)) {
              finalTitle = `${baseTitle}（${counter}）`;
              counter++;
            }
            
            // タイトル重複チェック完了
          } catch (titleCheckError) {
            console.log('⚠️ タイトル重複チェックでエラー（デフォルトタイトル使用）:', titleCheckError);
            finalTitle = baseTitle;
      }
          
          setTitle(finalTitle);

          // ローカルのダミーノートを作成（手書きノート用のsaveManualNote関数を利用）
          // ここでキャンバス用のローカルノートを確実に保存
          const newNoteId = `manual_${Date.now()}`;
          
                  // 🔥 CRITICAL: 先にステートへ保存して以降の処理で確実に参照できるようにする
        setNewNoteId(newNoteId);
          
          // DB へ初期レコードを登録
          await saveManualNote(
            newNoteId,
            finalTitle,
            '', // content: 空のコンテンツ（キャンバス用）
            {
              type: 'canvas',
              version: '1.0',
              content: '',
              drawingPaths: [],
              canvasSettings: {
                selectedTool: 'pen',
                selectedPenTool: 'pen',
                selectedColor: '#000000',
                strokeWidth: 2,
                textSettings: {
                  fontSize: 16,
                  textColor: '#000000',
                  selectedFont: 'standard',
                  selectedTextType: 'body',
                  isBold: false,
                  lineSpacing: 1.5,
                  letterSpacing: 0
                }
              }
            }
          );
          
                  // 新規手書きノート作成完了
        
      } catch (error) {
          console.log('⚠️ ローカル新規ノート作成中にエラー:', error);
          // エラーでもローカル編集は継続
          const today = new Date();
          const baseTitleDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const defaultTitle = `ノート${baseTitleDate}`;
          setTitle(defaultTitle);
        }
        
        setContent(''); // 初期コンテンツは空
        return;
    }
  };
  
    if (isNewNote) {
      initializeNotebookAndPage();
    }
  }, [isNewNote, notebookId, pageId, saveManualNote]);

  // 📝 既存ノート読み込み（新規作成でない場合）
  useEffect(() => {
    // 🔧 修正: 新規ノートの場合のみ罫線アイコンを表示
    if (isNewNote) {
      setIsCanvasIconsVisible(true);
      return;
    }
    
    // 既存ノートの場合は罫線アイコンを非表示
    setIsCanvasIconsVisible(false);
    
    const loadNote = async () => {
      try {
        // 📸 Step1: 写真スキャンノート判定（noteIdがphoto_scan_で始まる場合）
        if (noteId.startsWith('photo_scan_')) {
          console.log('📸 写真スキャンノート検出:', noteId);
          
          try {
            // 写真スキャンデータを取得
            const photoScans = await getPhotoScans();
            const targetPhotoScan = photoScans.find(scan => scan.id === noteId);
            
            if (targetPhotoScan) {
              setIsPhotoScanNote(true);
              setTitle(targetPhotoScan.title);
              
              // 🔥 CRITICAL: Step1でもキャンバス設定復元を追加
              const firstPhoto = targetPhotoScan.photos?.[0];
              
              // まずcanvasDataがあるかチェック（設定復元）
              if (firstPhoto?.canvasData) {
                console.log('📸 Step1 - キャンバス設定復元開始:', {
                  hasCanvasData: !!firstPhoto.canvasData,
                  canvasDataType: typeof firstPhoto.canvasData
                });
                
                try {
                  const canvasData = typeof firstPhoto.canvasData === 'string' 
                    ? JSON.parse(firstPhoto.canvasData) 
                    : firstPhoto.canvasData;
                  
                  if (canvasData && typeof canvasData === 'object' && canvasData.type === 'canvas') {
                    // コンテンツ復元
                    if (canvasData.content) {
                      setContent(canvasData.content);
                      console.log('📸 Step1 - コンテンツ復元完了:', canvasData.content.substring(0, 50) + '...');
                    }
                    
                    // 手書きデータ復元
                    if (canvasData.drawingPaths && Array.isArray(canvasData.drawingPaths)) {
                      setDrawingPaths(canvasData.drawingPaths);
                      console.log('📸 Step1 - 描画パス復元完了:', canvasData.drawingPaths.length);
                    }
                    
                    // 🔥 CRITICAL: キャンバス設定復元
                    if (canvasData.canvasSettings) {
                      const settings = canvasData.canvasSettings;
                      console.log('🔍🔍🔍 Step1 - 写真スキャン設定復元:', settings);
                      
                      // ツール設定復元（🚫 ツールバー選択状態は復元しない）
                      // if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                      // if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                      if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                      if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                      
                      // テキスト設定復元
                      if (settings.textSettings) {
                        const textSettings = settings.textSettings;
                        console.log('🔍🔍🔍 Step1 - textSettings復元:', textSettings);
                        
                        if (textSettings.fontSize) {
                          console.log('📏 Step1 - フォントサイズ復元:', { 前: fontSize, 復元値: textSettings.fontSize });
                          setFontSize(textSettings.fontSize);
                        }
                        if (textSettings.textColor) setTextColor(textSettings.textColor);
                        if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                        if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                        if (typeof textSettings.isBold === 'boolean') {
                          console.log('💪 Step1 - 太字設定復元:', { 前: isBold, 復元値: textSettings.isBold });
                          setIsBold(textSettings.isBold);
                        }
                        if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                        if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                      }
                      
                      console.log('✅ Step1 - キャンバス設定復元完了');
                    }
                    
                    return; // キャンバスデータがある場合は処理完了
                  }
                } catch (canvasError) {
                  console.log('⚠️ Step1 - キャンバスデータ解析エラー:', canvasError);
                }
              }
              
              // フォールバック：AI整形済みテキストまたは通常のOCRテキストを使用
              let displayText = '';
              
              if (firstPhoto?.ocrResult?.enhancedText) {
                displayText = firstPhoto.ocrResult.enhancedText;
                console.log('✅ Step1 - AI整形済みテキスト読み込み:', {
                  id: targetPhotoScan.id,
                  title: targetPhotoScan.title,
                  textLength: displayText.length
                });
              } else if (targetPhotoScan.photos && targetPhotoScan.photos.length > 0) {
                // フォールバック：通常のOCRテキストを結合
                const ocrTexts: string[] = [];
                for (const [index, photo] of targetPhotoScan.photos.entries()) {
                  if (photo.ocrResult?.text) {
                    if (targetPhotoScan.photos.length > 1) {
                      ocrTexts.push(`=== Page ${index + 1} ===\n\n${photo.ocrResult.text}`);
                    } else {
                      ocrTexts.push(photo.ocrResult.text);
                    }
                  }
                }
                displayText = ocrTexts.join('\n\n');
                console.log('⚠️ Step1 - 通常のOCRテキストを使用:', {
                  id: targetPhotoScan.id,
                  photosCount: targetPhotoScan.photos.length,
                  textLength: displayText.length
                });
              }
              
              if (displayText.trim()) {
                setContent(displayText);
              } else {
                setContent('テキストの解析中です...\n\n写真から文字を検出し、AI解析で読みやすく整形しています。しばらくお待ちください。');
                console.log('⚠️ 写真スキャンテキストが空です');
              }
              
              return; // 写真スキャンノートの場合は通常のloadNote処理をスキップ
            } else {
              console.warn('⚠️ 写真スキャンデータが見つかりません:', noteId);
            }
          } catch (photoError) {
            console.error('❌ 写真スキャンデータ読み込みエラー:', photoError);
          }
        }

        // 📝 Step2: 通常のノート読み込み処理
        // ノート検索開始
        const note = await getNoteById(noteId);
        
        // ノート検出状況を確認
        
        // 🆕 Step2.1: 手動作成ノートの処理 - ManualNoteテーブルのノートを判定
        const isManualNote = note && 'canvas_data' in note && !('transcription' in note);
        
        if (noteId === 'new' || isManualNote) {
          console.log('📝 通常ノート（manual）検出:', { noteId, note: !!note });
          
          try {
            const db = getDatabase();
            
            // 新規ノートまたは既存の通常ノートを処理
            let manualNote: ManualNote | null = null;
            
            if (noteId === 'new') {
              // 新規ノート作成時は空のManualNoteを作成
              const newNoteId = `manual_${Date.now()}`;
              await saveManualNote(newNoteId, "無題のノート", "");
              manualNote = await db.getFirstAsync<ManualNote>(
                'SELECT * FROM manual_notes WHERE id = ?;',
                [newNoteId]
              );
              
              // noteIdを更新（次回からの読み込み用）
              setNewNoteId(newNoteId);
              console.log('📝 新規通常ノート作成完了:', { oldNoteId: noteId, newNoteId });
            } else {
              // 既存の通常ノートを読み込み
              manualNote = await db.getFirstAsync<ManualNote>(
                'SELECT * FROM manual_notes WHERE id = ?;',
                [noteId]
              );
            }
            
            if (manualNote) {
              setTitle(manualNote.title);
              
              // キャンバスデータの復元処理
              if (manualNote.canvas_data) {
                try {
                  const canvasData = typeof manualNote.canvas_data === 'string' 
                    ? JSON.parse(manualNote.canvas_data) 
                    : manualNote.canvas_data;
                  
                  if (canvasData && typeof canvasData === 'object' && canvasData.type === 'canvas') {
                    // 🆕 マルチページデータの復元処理を最優先で実行
                    if (canvasData.multiPageData && canvasData.multiPageData.pages && Array.isArray(canvasData.multiPageData.pages)) {
                      console.log('🔍 ManualNote - multiPageData復元開始:', {
                        pagesCount: canvasData.multiPageData.pages.length,
                        currentPageIndex: canvasData.multiPageData.currentPageIndex,
                        totalPages: canvasData.multiPageData.totalPages
                      });
                      
                      // マルチページデータ復元処理
                      
                      // 複数ページデータを復元
                      setPages(canvasData.multiPageData.pages);
                      setCurrentPageIndex(canvasData.multiPageData.currentPageIndex || 0);
                      setTotalPages(canvasData.multiPageData.totalPages || canvasData.multiPageData.pages.length);
                      
                      // 現在のページのデータを復元
                      const currentPage = canvasData.multiPageData.pages[canvasData.multiPageData.currentPageIndex || 0];
                      if (currentPage) {
                        setContent(currentPage.content || '');
                        setDrawingPaths(currentPage.drawingPaths || []);
                        console.log('✅ ManualNote - 複数ページ復元完了:', {
                          currentPageContent: currentPage.content?.substring(0, 50) + '...',
                          currentPagePaths: currentPage.drawingPaths?.length || 0
                        });
                      }
                    } else {
                      // 🔄 従来の単一ページ復元処理（後方互換性）
                      console.log('🔄 ManualNote - 単一ページ復元処理');
                      
                      // コンテンツ復元
                      if (canvasData.content) {
                        setContent(canvasData.content);
                        console.log('✅ 通常ノート - コンテンツ復元完了:', canvasData.content.substring(0, 50) + '...');
                      }
                      
                      // 手書きデータ復元
                      if (canvasData.drawingPaths && Array.isArray(canvasData.drawingPaths)) {
                        setDrawingPaths(canvasData.drawingPaths);
                        console.log('✅ 通常ノート - 描画パス復元完了:', canvasData.drawingPaths.length);
                      }
                    }
                    
                    // 🔥 通常ノートのキャンバス設定復元
                    if (canvasData.canvasSettings) {
                      const settings = canvasData.canvasSettings;
                      console.log('✅ 通常ノート - キャンバス設定復元開始:', settings);
                      
                      // ツール設定復元（🚫 ツールバー選択状態は復元しない）
                      // if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                      // if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                      if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                      if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                      
                      // テキスト設定復元
                      if (settings.textSettings) {
                        const textSettings = settings.textSettings;
                        console.log('✅ 通常ノート - textSettings復元:', textSettings);
                        
                        if (textSettings.fontSize) {
                          console.log('📏 通常ノート - フォントサイズ復元:', { 前: fontSize, 復元値: textSettings.fontSize });
                          setFontSize(textSettings.fontSize);
                        }
                        if (textSettings.textColor) setTextColor(textSettings.textColor);
                        if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                        if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                        if (typeof textSettings.isBold === 'boolean') {
                          console.log('💪 通常ノート - 太字設定復元:', { 前: isBold, 復元値: textSettings.isBold });
                          setIsBold(textSettings.isBold);
                        }
                        if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                        if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                      }
                      
                      console.log('✅ 通常ノート - 全設定復元完了');
                    }
                  }
                } catch (canvasError) {
                  console.log('⚠️ 通常ノート - キャンバスデータ解析エラー:', canvasError);
                }
              } else {
                // 初期化時のデフォルトコンテンツ
                setContent(manualNote.content || '');
              }
              
              return; // 通常ノート処理完了
            }
          } catch (manualError) {
            console.error('❌ 通常ノート読み込みエラー:', manualError);
          }
        }
        
        if (note) {
          console.log('🔍🔍🔍 ノートデータ構造確認:', {
            hasTranscription: 'transcription' in note,
            hasContent: !!note.content,
            contentType: typeof note.content,
            noteKeys: Object.keys(note),
            title: note.title,
            filePath: note.file_path  // ノートタイプ判定用
          });
          
          // ノート読み込み開始
          
          setTitle(note.title);
          
          // ✨ 改善されたキャンバスデータ復元処理 - ノートタイプ判定を追加
          if (note.file_path === 'photo_scan') {
            console.log('📸 写真スキャンノートの復元処理');
            // 写真スキャンノートの場合、transcriptionには写真データが入っている
            const transcriptionText = note.transcription || '';
            
            try {
              // 写真データのJSON解析
              const photosData = JSON.parse(transcriptionText);
              
              // 最初の写真のcanvasDataを確認
              if (Array.isArray(photosData) && photosData.length > 0 && photosData[0].canvasData) {
                const canvasData = photosData[0].canvasData;
                console.log('✅ 写真スキャンのキャンバスデータ復元開始:', {
                  type: canvasData.type,
                  hasCanvasSettings: !!canvasData.canvasSettings
                });
                
                if (canvasData && typeof canvasData === 'object' && canvasData.type === 'canvas') {
                  setContent(canvasData.content || '');
                  
                  // 手書きデータの復元
                  if (canvasData.drawingPaths && Array.isArray(canvasData.drawingPaths)) {
                    setDrawingPaths(canvasData.drawingPaths);
                    console.log('✅ 写真スキャン手書きデータ復元完了:', { pathsCount: canvasData.drawingPaths.length });
                  }
                  
                  // ✨ 写真スキャンでもキャンバス設定を復元
                  if (canvasData.canvasSettings) {
                    const settings = canvasData.canvasSettings;
                    console.log('🔍🔍🔍 写真スキャン設定データ詳細:', settings);
                    
                    // ツール設定復元（🚫 ツールバー選択状態は復元しない）
                    // if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                    // if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                    if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                    if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                    
                    // テキスト設定復元
                    if (settings.textSettings) {
                      const textSettings = settings.textSettings;
                      console.log('🔍🔍🔍 写真スキャン textSettings詳細:', textSettings);
                      
                      if (textSettings.fontSize) {
                        console.log('📏 写真スキャン フォントサイズ復元:', { 前: fontSize, 復元値: textSettings.fontSize });
                        setFontSize(textSettings.fontSize);
                      }
                      if (textSettings.textColor) setTextColor(textSettings.textColor);
                      if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                      if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                      if (typeof textSettings.isBold === 'boolean') {
                        console.log('💪 写真スキャン 太字設定復元:', { 前: isBold, 復元値: textSettings.isBold });
                        setIsBold(textSettings.isBold);
                      }
                      if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                      if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                    }
                    
                    console.log('✅ 写真スキャンキャンバス設定復元完了');
                  } else {
                    console.log('⚠️ 写真スキャンにcanvasSettingsが存在しません');
                  }
                } else {
                  // 古い形式の写真スキャンデータ
                  console.log('📸 古い形式の写真スキャンデータ - AIテキスト使用');
                  if (photosData[0] && photosData[0].ocrResult && photosData[0].ocrResult.enhancedText) {
                    setContent(photosData[0].ocrResult.enhancedText);
                  } else if (photosData[0] && photosData[0].ocrResult && photosData[0].ocrResult.text) {
                    setContent(photosData[0].ocrResult.text);
                  }
                }
              } else {
                console.log('📸 写真データにcanvasDataが存在しません');
                setContent('');
              }
            } catch (parseError) {
              console.log('❌ 写真データJSON解析エラー:', parseError);
              setContent('');
            }
          } else if ('transcription' in note && note.transcription) {
            console.log('🎤 録音データからの復元処理');
            // 録音データからの文字起こし結果
            const transcriptionText = note.transcription || '';
            
            try {
              // 録音データもJSON構造の可能性がある
              const transcriptionData = JSON.parse(transcriptionText);
              if (transcriptionData && typeof transcriptionData === 'object' && transcriptionData.type === 'canvas') {
                
                // 🆕 マルチページデータの復元処理を最優先で実行
                if (transcriptionData.multiPageData && transcriptionData.multiPageData.pages && transcriptionData.multiPageData.pages.length > 0) {
                  const multiPageData = transcriptionData.multiPageData;
                  
                  // 複数ページ状態を復元
                  setPages(multiPageData.pages);
                  setCurrentPageIndex(multiPageData.currentPageIndex || 0);
                  setTotalPages(multiPageData.pages.length);
                  
                  // 現在のページのデータを復元
                  const currentPage = multiPageData.pages[multiPageData.currentPageIndex || 0];
                  if (currentPage) {
                    setContent(currentPage.content || '');
                    setDrawingPaths(currentPage.drawingPaths || []);
                  }
                  
                  // マルチページ復元完了
                  console.log('✅ 録音ノート - マルチページデータ復元完了:', multiPageData.pages.length);
                } else {
                  // 従来の単一ページ復元処理
                  setContent(transcriptionData.content || '');
                  if (transcriptionData.drawingPaths && Array.isArray(transcriptionData.drawingPaths)) {
                    setDrawingPaths(transcriptionData.drawingPaths);
                    console.log('✅ 録音データのキャンバス復元完了:', { pathsCount: transcriptionData.drawingPaths.length });
                  }
                }
                
                // ✨ 録音ノートでもキャンバス設定を復元
                if (transcriptionData.canvasSettings) {
                  const settings = transcriptionData.canvasSettings;
                  console.log('🔍🔍🔍 録音設定データ詳細:', settings);
                  
                  // ツール設定復元（🚫 ツールバー選択状態は復元しない）
                  // if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                  // if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                  if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                  if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                  
                  // テキスト設定復元
                  if (settings.textSettings) {
                    const textSettings = settings.textSettings;
                    console.log('🔍🔍🔍 録音 textSettings詳細:', textSettings);
                    
                    if (textSettings.fontSize) {
                      console.log('📏 録音 フォントサイズ復元:', { 前: fontSize, 復元値: textSettings.fontSize });
                      setFontSize(textSettings.fontSize);
                    }
                    if (textSettings.textColor) setTextColor(textSettings.textColor);
                    if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                    if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                    if (typeof textSettings.isBold === 'boolean') {
                      console.log('💪 録音 太字設定復元:', { 前: isBold, 復元値: textSettings.isBold });
                      setIsBold(textSettings.isBold);
                    }
                    if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                    if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                  }
                  
                  console.log('✅ 録音キャンバス設定復元完了');
                }
              } else {
                // 通常のテキスト
                setContent(transcriptionText);
              }
            } catch {
              // JSONパースエラーの場合は通常のテキストとして扱う
              setContent(transcriptionText);
            }
          } else if (note.content) {
            console.log('📝 note.contentからの復元処理開始:', {
              contentLength: note.content.length,
              contentPreview: note.content.substring(0, 100) + '...'
            });
            try {
              // JSONとして保存されたキャンバスデータを復元
              const canvasData = JSON.parse(note.content);
              console.log('✅ JSON解析成功:', {
                type: canvasData.type,
                hasCanvasSettings: !!canvasData.canvasSettings,
                canvasSettingsKeys: canvasData.canvasSettings ? Object.keys(canvasData.canvasSettings) : []
              });
              if (canvasData && typeof canvasData === 'object' && canvasData.type === 'canvas') {
                // ✨ 新しいキャンバスデータ構造での復元
                setContent(canvasData.content || '');
                
                // 手書きデータの復元
                if (canvasData.drawingPaths && Array.isArray(canvasData.drawingPaths)) {
                  setDrawingPaths(canvasData.drawingPaths);
                  console.log('✅ 手書きデータ復元完了:', { pathsCount: canvasData.drawingPaths.length });
                }
                
                // 🆕 複数ページデータの復元
                if (canvasData.multiPageData) {
                  const multiPageData = canvasData.multiPageData;
                  console.log('🔍 複数ページデータ復元開始:', {
                    pagesCount: multiPageData.pages?.length || 0,
                    currentPageIndex: multiPageData.currentPageIndex,
                    totalPages: multiPageData.totalPages,
                    allPagesData: multiPageData.pages?.map((page, index) => ({
                      index,
                      id: page.id,
                      title: page.title,
                      contentLength: page.content?.length || 0,
                      pathsCount: page.drawingPaths?.length || 0
                    })) || []
                  });
                  
                  if (multiPageData.pages && Array.isArray(multiPageData.pages) && multiPageData.pages.length > 0) {
                    // 複数ページデータを復元
                    setPages(multiPageData.pages);
                    setCurrentPageIndex(multiPageData.currentPageIndex || 0);
                    setTotalPages(multiPageData.totalPages || multiPageData.pages.length);
                    
                    // 現在のページのデータを復元
                    const currentPageIndex = multiPageData.currentPageIndex || 0;
                    const currentPage = multiPageData.pages[currentPageIndex];
                    if (currentPage) {
                      setContent(currentPage.content || '');
                      setDrawingPaths(currentPage.drawingPaths || []);
                      console.log('✅ 複数ページデータ復元完了:', {
                        currentPageIndex,
                        currentPageContent: currentPage.content?.substring(0, 50) + '...',
                        currentPageDrawingPaths: currentPage.drawingPaths?.length || 0
                      });
                      
                      // 復元完了
                    }
                  }
                } else {
                  console.log('⚠️ multiPageDataが存在しません - 単一ページとして処理');
                  // 単一ページとして処理
                }
                
                // ✨ キャンバス設定の復元
                console.log('🔍🔍🔍 canvasData.canvasSettings確認:', canvasData.canvasSettings);
                
                if (canvasData.canvasSettings) {
                  const settings = canvasData.canvasSettings;
                  console.log('🔍🔍🔍 設定データ詳細:', settings);
                  
                  // ツール設定復元（🚫 ツールバー選択状態は復元しない）
                  // if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                  // if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                  if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                  if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                  
                  // テキスト設定復元
                  if (settings.textSettings) {
                    const textSettings = settings.textSettings;
                    console.log('🔍🔍🔍 textSettings詳細:', textSettings);
                    
                    if (textSettings.fontSize) {
                      console.log('📏 フォントサイズ復元:', { 前: fontSize, 復元値: textSettings.fontSize });
                      setFontSize(textSettings.fontSize);
                    }
                    if (textSettings.textColor) setTextColor(textSettings.textColor);
                    if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                    if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                    if (typeof textSettings.isBold === 'boolean') {
                      console.log('💪 太字設定復元:', { 前: isBold, 復元値: textSettings.isBold });
                      setIsBold(textSettings.isBold);
                    }
                    if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                    if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                  } else {
                    console.log('⚠️⚠️⚠️ textSettingsが存在しません！');
                  }
                  
                  console.log('✅ キャンバス設定復元完了:', {
                    tool: settings.selectedTool,
                    penTool: settings.selectedPenTool,
                    hasTextSettings: !!settings.textSettings
                  });
                } else {
                  console.log('⚠️⚠️⚠️ canvasSettingsが存在しません！');
                }
              } else {
                // 古い形式または通常のテキストデータとして扱う
                setContent(note.content);
              }
            } catch (parseError) {
              // JSONパースエラーの場合は通常のテキストとして扱う
              console.log('❌ JSON解析エラー - 通常のテキストとして読み込み:', {
                error: parseError,
                contentLength: note.content.length,
                contentPreview: note.content.substring(0, 50)
              });
              setContent(note.content);
            }
          } else {
            setContent('');
          }
        } else {
          Alert.alert('エラー', 'ノートが見つかりませんでした。');
          navigation.goBack();
        }
      } catch (error) {
        Alert.alert('エラー', 'ノートの読み込みに失敗しました。');
        navigation.goBack();
      }
    };
    
    // 既存ノートの場合のみ読み込み実行
    const initializeNote = async () => {
      await loadNote();
    };
    
    initializeNote();
  }, [noteId, isNewNote, getNoteById, navigation]);

  // 💾 ダッシュボード戻り時の最終保存
  const handleGoBack = useCallback(async () => {
    console.log('🔙 戻るボタン押下 - 確実な保存実行');
    
    try {
      // 🆕 確実な保存を実行してから戻る
      await flushSave();
      console.log('✅ 確実な保存完了 - ダッシュボードに戻る');
      navigation.goBack();
    } catch (error) {
      console.error('❌ 保存エラー:', error);
      // エラーでも戻る（データ損失を防ぐため警告表示）
      Alert.alert(
        '保存エラー',
        '保存に失敗しましたが、ダッシュボードに戻ります。',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [flushSave, navigation]);

  // 🔥 修正: 自動保存のuseEffect - 最新状態を参照
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    console.log('🕒 自動保存タイマー再開始: 5秒間隔');
    autoSaveTimerRef.current = setInterval(async () => {
      console.log('⏰ 自動保存タイマー実行');
      await performAutoSave();
    }, 5000);
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, isSaving, title, content, drawingPaths, actualNoteId, newNoteId, noteId]);



  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる際にタイマーをクリア
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, []);

  // タイトル編集の保存
  const handleTitleSave = async () => {
    try {
      setIsEditingTitle(false);
      markAsChanged(); // 変更フラグのみ
    } catch (error) {
      console.log('⚠️ タイトル保存エラー（ローカル編集継続）:', error);
      setIsEditingTitle(false);
    }
  };

  // 本文編集の保存（自動保存）
  const handleContentSave = async () => {
    markAsChanged(); // 変更フラグのみ
  };

  // ✨ 新規追加：手書きデータの自動保存関数
  const handleCanvasSave = async () => {
    // 🚨 既に保存中の場合はスキップ
    if (isSaving) {
      console.log('⏳ 保存処理中のためスキップ');
      return;
    }

    try {
      setIsSaving(true); // 保存開始フラグ
      
      const noteIdToUse = actualNoteId || newNoteId || noteId;
      if (noteIdToUse) {
        const canvasData = {
          type: 'canvas',
          version: '1.0',
          title: title,
          content: content,
          drawingPaths: drawingPaths,
          canvasSettings: {
            selectedTool,
            selectedPenTool,
            selectedColor,
            strokeWidth,
            textSettings: {
              fontSize,
              textColor,
              selectedFont,
              selectedTextType,
              isBold,
              lineSpacing,
              letterSpacing
            }
          },
          lastModified: new Date().toISOString()
        };
        
        await updateCanvasData(noteIdToUse, canvasData);
        console.log('✅ キャンバス自動保存完了（改善版）:', { pathsCount: drawingPaths.length });
      }
    } catch (error) {
      console.log('⚠️ キャンバス保存エラー:', error);
    } finally {
      setIsSaving(false); // 保存完了フラグ
    }
  };

  // キャンバスをタップした時のハンドラ（テキスト編集開始）
  const handleCanvasPress = () => {
    setIsEditing(true);
    // ✅ 修正: キャンバスタッチで罫線アイコン非表示、テキスト編集開始で音声プレイヤー非表示
    setIsCanvasIconsVisible(false);
    setShowAudioPlayer(false); // テキスト編集開始時は音声プレイヤーを非表示
    markAsChanged(); // 🔥 追加: キャンバスタッチ時も変更フラグを立てる
  };

  // キャンバス以外をタップした時のハンドラ（アイコン非表示・編集解除）
  const handleOutsidePress = () => {
    setIsCanvasIconsVisible(false);
    setIsEditing(false);
    setIsEditingTitle(false);
    
    // ✨ フォーカス解除時に変更フラグのみ
    markAsChanged();
  };

  // 🔍 検索アイコンタップ時のハンドラ（検索機能開始）
  const handleToolbarIconPress = () => {
    handleSearchToggle();
  };



  // ページ設定ハンドラ  
  const handlePageSettings = () => {
    console.log('ページ設定実行');
    // TODO: ページ設定の実装
    markAsChanged('template_select', { action: 'page_settings_opened' }); // 🎯 統一自動保存
  };

  // その他設定ハンドラ
  const handleMoreSettings = () => {
    console.log('その他設定実行');
    // TODO: その他設定の実装
    markAsChanged('background_change', { action: 'more_settings_opened' }); // 🎯 統一自動保存
  };

  // 画像アップロードハンドラ
  // 定規機能ハンドラ
  // 📏 定規機能のハンドラー（既存機能への影響なし）
  const handleRulerTool = () => {
    try {
      console.log('📏 定規機能実行 - 表示切り替え');
      
      // 定規表示/非表示を切り替え
      setRulerState(prev => ({
        ...prev,
        isVisible: !prev.isVisible,
        // 初回表示時はキャンバスサイズに合わせて長さを設定
        length: !prev.isVisible ? 500 : prev.length // 固定値に変更（Dimensionsエラー回避）
      }));
      
      // 統一自動保存システムに変更を通知（既存機能）
      markAsChanged('ruler', { 
        action: 'ruler_toggled', 
        isVisible: !rulerState.isVisible 
      });
      
      console.log('📏 定規状態更新:', {
        isVisible: !rulerState.isVisible,
        position: { x: rulerState.x, y: rulerState.y },
        rotation: rulerState.rotation
      });
      
    } catch (error) {
      console.error('⚠️ 定規機能エラー（既存機能には影響なし）:', error);
    }
  };

  // 📏 定規移動のハンドラー
  const handleRulerMove = (x: number, y: number) => {
    try {
      setRulerState(prev => ({ ...prev, x, y }));
      console.log('📏 定規移動:', { x, y });
    } catch (error) {
      console.error('⚠️ 定規移動エラー（既存機能には影響なし）:', error);
    }
  };

  // 📏 定規角度調整のハンドラー
  const handleRulerAngleAdjust = () => {
    try {
      // 角度入力ダイアログを表示（簡単な実装）
      Alert.prompt(
        '角度設定',
        '定規の角度を入力してください（0-360度）',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '設定',
            onPress: (value) => {
              const angle = parseInt(value || '0', 10);
              if (!isNaN(angle) && angle >= 0 && angle <= 360) {
                setRulerState(prev => ({ ...prev, rotation: angle }));
                console.log('📏 定規角度変更:', angle);
              }
            }
          }
        ],
        'plain-text',
        rulerState.rotation.toString()
      );
    } catch (error) {
      console.error('⚠️ 定規角度調整エラー（既存機能には影響なし）:', error);
    }
  };

  // 🆕 編集制御ヘルパー関数
  const checkEditingAllowed = (actionName: string): boolean => {
    if (isTTSPlaying) {
      Alert.alert(
        '編集制限',
        `音声再生中は${actionName}できません。\n一時停止してから編集してください。`,
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    }
    return true;
  };

  // ペンツール選択ハンドラ
  const handlePenToolPress = () => {
    if (!checkEditingAllowed('ペンツールの使用は')) return;
    
    // 🆕 TTS再生中はサブツールバーを表示しない
    if (isTTSPlaying) {
      return;
    }
    
    const newSelectedTool = selectedTool === 'pen' ? null : 'pen';
    setSelectedTool(newSelectedTool);
    
    // ペンツールが選択された時、デフォルトでペンを選択
    if (newSelectedTool === 'pen') {
      setSelectedPenTool('pen');
    } else {
      setSelectedPenTool(null);
    }
    
    // ペンツール選択時に色・太さ設定を閉じる
    setShowColorSettings(false);
    setShowStrokeSettings(false);
    
    // ✅ 修正: ツールバータッチで罫線アイコン非表示（音声プレイヤーは音声読み上げボタン専用）
    setIsCanvasIconsVisible(false);
  };

  // キーボードツール選択ハンドラ
  const handleKeyboardToolPress = () => {
    if (!checkEditingAllowed('キーボードツールの使用は')) return;
    
    // 🆕 TTS再生中はサブツールバーを表示しない
    if (isTTSPlaying) {
      return;
    }
    
    const newSelectedTool = selectedTool === 'keyboard' ? null : 'keyboard';
    setSelectedTool(newSelectedTool);
    
    // キーボードツールを解除した場合、サブツールもリセット
    if (newSelectedTool === null) {
      setSelectedKeyboardTool(null);
    }
    
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    // ✅ 修正: ツールバータッチで罫線アイコン非表示（音声プレイヤーは音声読み上げボタン専用）
    setIsCanvasIconsVisible(false);
  };

  // キーボードツール内の選択ハンドラ
  const handleKeyboardToolSelect = (tool: KeyboardToolType) => {
    setSelectedKeyboardTool(selectedKeyboardTool === tool ? null : tool);
    markAsChanged(); // 🔥 追加: キーボードツール選択時に変更フラグを立てる
  };

  // テキストタイプ選択ハンドラ（選択テキストまたは全文に適用）
  const handleTextTypeSelect = (type: TextType) => {
    setSelectedTextType(type);
    
    // ✨ 選択されたテキストがある場合のみ、そのテキストにマークダウンスタイルを適用
    if (textSelection.start !== textSelection.end) {
      const selectedText = content.substring(textSelection.start, textSelection.end);
      let styledText = '';
      
      switch (type) {
        case 'heading1':
          styledText = `# ${selectedText}`;
          break;
        case 'heading2':
          styledText = `## ${selectedText}`;
          break;
        case 'heading3':
          styledText = `### ${selectedText}`;
          break;
        case 'body':
        default:
          // 見出しマークを削除（既にある場合）
          styledText = selectedText.replace(/^#+\s*/, '');
          break;
      }
      
      // 選択範囲のテキストを置き換え
      const newContent = content.substring(0, textSelection.start) + 
                        styledText + 
                        content.substring(textSelection.end);
      setContent(newContent);
    }
    
    markAsChanged('heading_change', { textType: type }); // 🎯 統一自動保存
  };

  // フォント選択ハンドラ
  const handleFontSelect = (font: FontType) => { // 型を更新
    setSelectedFont(font);
    markAsChanged('font_change', { font: font }); // 🎯 統一自動保存
  };

  // テキストカラー選択ハンドラ
  const handleTextColorSelect = (color: string) => {
    setTextColor(color);
    markAsChanged('text_color', { textColor: color }); // 🎯 統一自動保存
  };

  // 音声ツール選択ハンドラ
  const handleVoiceToolPress = () => {
    if (!checkEditingAllowed('音声ツールの使用は')) return;
    
    // 🆕 TTS再生中はサブツールバーを表示しない
    if (isTTSPlaying) {
      return;
    }
    
    setSelectedTool(selectedTool === 'voice' ? null : 'voice');
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    // ✅ 修正: ツールバータッチで罫線アイコン非表示（音声プレイヤーは音声読み上げボタン専用）
    setIsCanvasIconsVisible(false);
    markAsChanged(); // 🔥 追加: 音声ツール選択時に変更フラグを立てる
  };

  // 🎵 音声読み上げボタン専用のハンドラー
  const handleTTSButtonPress = () => {
    console.log('🎵 音声読み上げボタンがタップされました');
    
    // 編集中の場合は編集状態を解除
    if (isEditing) {
      setIsEditing(false);
      // TextInputのフォーカスを解除
      if (contentInputRef.current) {
        contentInputRef.current.blur();
      }
      console.log('📝 編集状態を解除しました');
    }
    
    // 音声プレイヤーの表示・非表示をトグル
    const newShowAudioPlayer = !showAudioPlayer;
    setShowAudioPlayer(newShowAudioPlayer);
    
    if (newShowAudioPlayer) {
      console.log('🔊 音声プレイヤーを表示しました');
    } else {
      console.log('🔇 音声プレイヤーを非表示にしました');
    }
    
    // 他のサブメニューを閉じる
    setSelectedTool(null);
    setSelectedPenTool(null);
    setSelectedKeyboardTool(null);
    setShowColorSettings(false);
    setShowStrokeSettings(false);
    setIsCanvasIconsVisible(false);
    
    markAsChanged(); // 音声読み上げボタン押下
  };

  // キャンバスアイコンタップ時のハンドラ（アイコン非表示）
  const handleCanvasIconPress = () => {
    setIsCanvasIconsVisible(false);
  };

  // 本文エリアをタップした時のハンドラ（テキスト編集開始）
  const handleContentAreaPress = () => {
    if (!checkEditingAllowed('テキスト編集は')) return;
    // ✅ 修正: 本文エリアタッチで罫線アイコン非表示、テキスト編集開始で音声プレイヤー非表示
    setIsCanvasIconsVisible(false);
    setShowAudioPlayer(false); // テキスト編集開始時は音声プレイヤーを非表示
    setIsEditing(true);
  };

  // ペンツール選択ハンドラ
  const handlePenToolSelect = (tool: PenToolType) => {
    setSelectedPenTool(tool);
    markAsChanged(); // 🔥 追加
  };

  // 色選択ハンドラ
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    markAsChanged(); // 🔥 追加
  };

  // 色設定が必要なツールかどうかを判定
  const needsColorSettings = (tool: PenToolType): boolean => {
    return tool === 'pen' || tool === 'pencil' || tool === 'marker';
  };


  
  // 利用可能なフォント一覧（更新版）
  const availableFonts = [
    { key: 'dyslexia', label: 'UDフォント（読みやすい）' },
    { key: 'standard', label: '標準フォント' },
    { key: 'serif', label: '明朝体' },
    { key: 'gothic', label: 'ゴシック体' }
  ];



  // 録音時間をフォーマットする関数（MM:SS形式）
  const formatRecordingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 録音開始ハンドラー
  const handleStartRecording = async () => {
    console.log('🎤 録音開始');
    
    try {
      // 録音状態をリセット
      setTranscribedText('');
      setInterimText('');
      transcribedTextRef.current = ''; // 🔧 Refもリセット
      setRecordingState('recording');
      setRecordingTime(0);
      markAsChanged(); // 🔥 録音開始時に変更フラグを立てる
      
      // STT WebSocket接続開始
      if (sttSocketRef.current) {
        await sttSocketRef.current.connect();
      }
      
      // AudioRecorder設定とデータ送信コールバック
      if (audioRecorderRef.current) {
        // 録音開始（コールバックで音声データをSTTに送信）
        await audioRecorderRef.current.startRecording((audioData: ArrayBuffer) => {
          if (sttSocketRef.current && sttSocketRef.current.getReadyState() === 'OPEN') {
            sttSocketRef.current.sendAudioData(audioData);
          }
        });
      }
      
      // 1秒ごとに時間を更新
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // 60秒で自動停止
          if (newTime >= 60) {
            // 🔧 自動停止時は最新のtranscribedTextを使って停止処理
            handleAutoStopRecording();
            return 60;
          }
          return newTime;
        });
      }, 1000);
      
    } catch (error) {
      console.error('🎤 録音開始エラー:', error);
      Alert.alert('録音エラー', '録音を開始できませんでした。');
      setRecordingState('idle');
    }
  };

  // 🔧 自動停止専用ハンドラー（最新のtranscribedTextを使用）
  const handleAutoStopRecording = async () => {
    console.log('🎤 60秒自動停止');
    
    try {
      setRecordingState('idle');
      setRecordingTime(0);
      markAsChanged(); // 🔥 録音停止時に変更フラグを立てる
      
      // タイマー停止
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // 録音停止
      if (audioRecorderRef.current) {
        await audioRecorderRef.current.stopRecording();
      }
      
      // STTストリーム終了
      if (sttSocketRef.current && sttSocketRef.current.getReadyState() === 'OPEN') {
        sttSocketRef.current.sendEndOfStream();
        sttSocketRef.current.closeConnection();
      }
      
      // 🔧 最新の文字起こし結果をキャンバスに挿入（Refから取得）
      const latestTranscribedText = transcribedTextRef.current;
      if (latestTranscribedText.trim()) {
        const currentText = content;
        const updatedText = currentText + (currentText ? '\n' : '') + latestTranscribedText;
        setContent(updatedText);
        markAsChanged();
        console.log('🎤 自動停止：文字起こし結果をキャンバスに挿入:', latestTranscribedText);
      }
      
      // リセット
      setTranscribedText('');
      setInterimText('');
      transcribedTextRef.current = '';
      
    } catch (error) {
      console.error('🎤 自動停止エラー:', error);
      setRecordingState('idle');
    }
  };

  // 録音停止ハンドラー（手動停止用）
  const handleStopRecording = async () => {
    console.log('🎤 手動録音停止');
    
    try {
      setRecordingState('idle');
      setRecordingTime(0);
      markAsChanged(); // 🔥 録音停止時に変更フラグを立てる
      
      // タイマー停止
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // 録音停止
      if (audioRecorderRef.current) {
        await audioRecorderRef.current.stopRecording();
      }
      
      // STTストリーム終了
      if (sttSocketRef.current && sttSocketRef.current.getReadyState() === 'OPEN') {
        sttSocketRef.current.sendEndOfStream();
        sttSocketRef.current.closeConnection();
      }
      
      // 文字起こし結果をキャンバスに挿入（stt.mdcの仕様）
      if (transcribedText.trim()) {
        const currentText = content;
        const updatedText = currentText + (currentText ? '\n' : '') + transcribedText;
        setContent(updatedText);
        markAsChanged();
        console.log('🎤 手動停止：文字起こし結果をキャンバスに挿入:', transcribedText);
      }
      
      // リセット
      setTranscribedText('');
      setInterimText('');
      transcribedTextRef.current = '';
      
    } catch (error) {
      console.error('🎤 録音停止エラー:', error);
      setRecordingState('idle');
    }
  };

  // 録音一時停止ハンドラー
  const handlePauseRecording = async () => {
    console.log('🎤 録音一時停止/再開');
    
    try {
      if (recordingState === 'recording') {
        // 録音中→一時停止
        setRecordingState('paused');
        markAsChanged(); // 🔥 録音一時停止時に変更フラグを立てる
        
        // タイマー停止
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // 録音一時停止
        if (audioRecorderRef.current) {
          await audioRecorderRef.current.pauseRecording();
        }
        
      } else if (recordingState === 'paused') {
        // 一時停止→録音再開
        setRecordingState('recording');
        markAsChanged(); // 🔥 録音再開時に変更フラグを立てる
        
        // 録音再開
        if (audioRecorderRef.current) {
          await audioRecorderRef.current.resumeRecording();
        }
        
        // タイマー再開
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            const newTime = prev + 1;
            if (newTime >= 60) {
              // 🔧 自動停止時は最新のtranscribedTextを使って停止処理
              handleAutoStopRecording();
              return 60;
            }
            return newTime;
          });
        }, 1000);
      }
      
    } catch (error) {
      console.error('🎤 録音一時停止/再開エラー:', error);
      setRecordingState('idle');
    }
  };

  // ✨ 手書きパスの変更をハンドリング
  const handlePathsChange = (newPaths: DrawingPath[]) => {
    setDrawingPaths(newPaths);
    setRedoStack([]); // 新しい手書きでRedoスタックをクリア
    setTTSAudioUrl(null); // 🆕 手書き変更時にTTS音声URLをリセット
    markAsChanged(); // 変更フラグのみ
  };

  // Undoハンドラー - 最後のパスを1つ削除
  const handleUndo = () => {
    if (drawingPaths.length > 0) {
      // 最後のパスを削除
      const lastPath = drawingPaths[drawingPaths.length - 1];
      const newPaths = drawingPaths.slice(0, -1);
      
      // Redo用に削除したパスを保存
      setRedoStack(prev => [...prev, lastPath]);
      
      // パスを更新
      setDrawingPaths(newPaths);
      setTTSAudioUrl(null); // 🆕 Undo時にもTTS音声URLをリセット
      markAsChanged(); // 🔥 追加: Undo時も変更フラグを立てる
      
      // console.log('🔙 Undo: Removed last path', {
      //   removedPath: {
      //     tool: lastPath.tool,
      //     color: lastPath.color,
      //     timestamp: lastPath.timestamp
      //   },
      //   remainingPaths: newPaths.length
      // });
    }
  };

  // Redoハンドラー - 最後に削除したパスを復元
  const handleRedo = () => {
    if (redoStack.length > 0) {
      // 最後に削除されたパスを取得
      const pathToRestore = redoStack[redoStack.length - 1];
      const newRedoStack = redoStack.slice(0, -1);
      
      // パスを復元
      const newPaths = [...drawingPaths, pathToRestore];
      
      // Redoスタックを更新
      setRedoStack(newRedoStack);
      
      // パスを更新
      setDrawingPaths(newPaths);
      setTTSAudioUrl(null); // 🆕 Redo時にもTTS音声URLをリセット
      markAsChanged(); // 🔥 追加: Redo時も変更フラグを立てる
      
      // console.log('🔜 Redo: Restored path', {
      //   restoredPath: {
      //     tool: pathToRestore.tool,
      //     color: pathToRestore.color,
      //     timestamp: pathToRestore.timestamp
      //   },
      //   totalPaths: newPaths.length
      // });
    }
  };

  // 線の太さ変更ハンドラー
  const handleStrokeWidthChange = (width: number) => {
    setStrokeWidth(width);
    markAsChanged(); // 🔥 追加
  };

  // 📏 線の太さ設定表示の切り替え
  const handleStrokeSettingsToggle = () => {
    setShowStrokeSettings(!showStrokeSettings);
    markAsChanged(); // 🔥 追加: 太さ設定表示切り替え時に変更フラグを立てる
  };

  // 🎨 カラー設定表示の切り替え
  const handleColorSettingsToggle = () => {
    setShowColorSettings(!showColorSettings);
    markAsChanged(); // 🔥 追加: 色設定表示切り替え時に変更フラグを立てる
  };

  // 📏 線の太さ選択ハンドラー
  const handleStrokeTypeSelect = (type: 'thin' | 'medium' | 'thick') => {
    setStrokeWidth(strokeOptions[type].value);
    markAsChanged(); // 🔥 追加
  };

  // テキストスタイルを動的に生成する関数を追加
  // ✨ 完全に新しいgetTextInputStyle関数 - フォントサイズ変更が確実に動作
  const getTextInputStyle = () => {
    const baseStyle = {
      flex: 1,
      padding: 0,
      margin: 0,
      textAlignVertical: 'top' as const,
    };

    // テキストタイプに応じたスタイル
    interface TypeStyle {
      fontSize: number;
      fontWeight?: 'normal' | 'bold';
    }
    
    let typeStyle: TypeStyle = { fontSize: fontSize }; // 初期値を設定
    switch (selectedTextType) {
      case 'heading1':
        typeStyle = { fontSize: 24, fontWeight: 'bold' as const };
        break;
      case 'heading2':
        typeStyle = { fontSize: 20, fontWeight: 'bold' as const };
        break;
      case 'heading3':
        typeStyle = { fontSize: 18, fontWeight: 'bold' as const };
        break;
      case 'body':
      default:
        typeStyle = { fontSize: fontSize };
        break;
    }

    // フォントファミリー設定
    let fontFamily = 'System'; // デフォルト
    switch (selectedFont) {
      case 'dyslexia':
        // UDフォント（ディスレクシア対応）
        if (Platform.OS === 'ios') {
          fontFamily = 'SF Pro Text'; // iOSの読みやすいフォント
        } else {
          fontFamily = 'Roboto'; // Androidの読みやすいフォント
        }
        break;
      case 'standard':
        fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
        break;
      case 'serif':
        fontFamily = Platform.OS === 'ios' ? 'Times New Roman' : 'serif';
        break;
      case 'gothic':
        fontFamily = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium';
        break;
      default:
        fontFamily = 'System';
        break;
    }

    const finalStyle = {
      ...baseStyle,
      ...typeStyle,
      fontFamily,
      color: textColor,
      fontWeight: isBold ? 'bold' as const : (typeStyle.fontWeight || 'normal' as const),
      // 🩹 行間調整機能を保持しつつ、iOS の下線表示を改善
      lineHeight: fontSize * lineSpacing, // 🔧 修正: iOSでも行間調整を有効化
      ...(Platform.OS === 'ios'
        ? {
            paddingVertical: 4,         // ← 下線が切れないよう余白を追加
          }
        : {}),
      letterSpacing: selectedFont === 'dyslexia' ? Math.max(letterSpacing, 0.5) : letterSpacing, // UDフォント時は最低0.5px間隔
    };
    
    // 🔥 デバッグ: 実際のスタイル値をログ出力
    console.log('🎨 getTextInputStyle実行結果:', {
      selectedTextType,
      fontSize,
      actualFontSize: finalStyle.fontSize,
      lineSpacing,
      actualLineHeight: finalStyle.lineHeight,
      letterSpacing: finalStyle.letterSpacing,
      fontWeight: finalStyle.fontWeight,
      color: finalStyle.color
    });
    
    return finalStyle;
  };



  // 太字トグルハンドラ
  const handleBoldToggle = () => {
    console.log('🔥🔥🔥 handleBoldToggle 実行開始!');
    const newBoldState = !isBold;
    console.log('🎯 太字切り替え:', { 前: isBold, 後: newBoldState });
    setIsBold(newBoldState);
    console.log('🔥🔥🔥 markAsChanged呼び出し直前');
    markAsChanged('bold_toggle', { isBold: newBoldState }); // 🎯 統一自動保存
    console.log('🔥🔥🔥 markAsChanged呼び出し完了');
  };

  // 🔥 超デバッグ版行間調整ハンドラ
  const handleLineSpacingChange = (spacing: number) => {
    console.log('🔥🔥🔥 行間調整ハンドラー実行!', { 
      現在の行間: lineSpacing, 
      新しい行間: spacing,
      範囲チェック: spacing >= 0.8 && spacing <= 2.0,
      実際に変更される: spacing !== lineSpacing
    });
    if (spacing >= 0.8 && spacing <= 2.0) {
      setLineSpacing(spacing);
      markAsChanged('spacing_adjust', { lineSpacing: spacing });
      
      // 🔥 デバッグ: setStateの後の状態を確認
      setTimeout(() => {
        console.log('⏰ setLineSpacing後の状態確認:', { lineSpacing: spacing });
      }, 100);
    } else {
      console.log('❌ 行間調整範囲外:', spacing);
    }
  };

  // 🔥 超デバッグ版文字間隔調整ハンドラ
  const handleLetterSpacingChange = (spacing: number) => {
    console.log('🔥🔥🔥 文字間隔調整ハンドラー実行!', { 
      現在の文字間隔: letterSpacing, 
      新しい文字間隔: spacing,
      範囲チェック: spacing >= -2 && spacing <= 5,
      実際に変更される: spacing !== letterSpacing
    });
    if (spacing >= -2 && spacing <= 5) {
      setLetterSpacing(spacing);
      markAsChanged('spacing_adjust', { letterSpacing: spacing });
      
      // 🔥 デバッグ: setStateの後の状態を確認
      setTimeout(() => {
        console.log('⏰ setLetterSpacing後の状態確認:', { letterSpacing: spacing });
      }, 100);
    } else {
      console.log('❌ 文字間隔調整範囲外:', spacing);
    }
  };

  // ✨ 変更フラグを立てる関数（AutoSaveDecorator統合版）
  const markAsChanged = (toolbarFunction?: ToolbarFunction, data?: any) => {
    console.log('🏷️ 変更フラグ設定:', { 
      toolbarFunction, 
      data, 
      hasUnsavedChanges: true 
    });
    setHasUnsavedChanges(true);
    
    // 🎤 テキスト変更時のTTS音声再生成
    if (toolbarFunction === 'text_input' || 
        toolbarFunction === 'heading_change' || 
        toolbarFunction === 'font_change' ||
        toolbarFunction === 'font_size' ||
        toolbarFunction === 'bold_toggle') {
      console.log('🎤 テキスト変更検知 - TTS音声再生成をスケジュール');
      // 既存のTTS音声をクリアして再生成を促す
      setTTSAudioUrl(null);
      
      // 現在再生中の場合は停止
      if (isTTSPlaying) {
        ttsAudioPlayer.pause();
        setIsTTSPlaying(false);
        setAudioPlayState('paused');
        console.log('🎤 テキスト変更により音声再生停止');
      }
    }
    
    // 🎯 新しい統一自動保存Hook経由
    if (toolbarFunction) {
      console.log('🚀 統一自動保存Hook実行:', toolbarFunction);
      markChanged(toolbarFunction, data);
    } else {
      // デフォルト機能として手動保存を指定
      console.log('🚀 デフォルト保存実行: manual_save');
      markChanged('manual_save', data);
    }
  };

  // ✨ シンプルな自動保存関数（5秒間隔）
  const performAutoSave = async () => {
    console.log('🔄 自動保存チェック:', { 
      isSaving, 
      hasUnsavedChanges, 
      noteId: actualNoteId || newNoteId || noteId,
      contentLength: content.length,
      pathsCount: drawingPaths.length 
    });
    
    if (isSaving) {
      console.log('⏳ 自動保存スキップ: 保存処理中');
      return;
    }
    
    if (!hasUnsavedChanges) {
      console.log('📝 自動保存スキップ: 未変更');
      return;
    }

    try {
      setIsSaving(true);
      
      const noteIdToUse = actualNoteId || newNoteId || noteId;
      if (noteIdToUse) {
        // 🔥 Phase 4.6: UniversalNoteService統合
        console.log('🚀 UniversalNoteService統一自動保存開始');
        
        // UniversalNote形式でデータ構築
        const determinedType = determineNoteType();
        console.log('🚨🚨🚨 CRITICAL performAutoSave noteType判定:', {
          noteId: noteIdToUse,
          determinedType,
          route_params: route.params,
          includesPhotoScan: noteIdToUse.includes('photo_scan'),
          startsWithPhotoScan: noteIdToUse.startsWith('photo_scan_')
        });
        
        const universalNote: UniversalNote = {
          id: noteIdToUse,
          type: determinedType,
          title: title,
          pages: [{
            pageId: `${noteIdToUse}_page_1`,
            pageNumber: 1,
            canvasData: {
              type: 'canvas',
              version: '1.0',
              content: content,
              drawingPaths: drawingPaths,
              textElements: [], // 現在は空配列（将来のテキスト要素対応）
              canvasSettings: {
                selectedTool,
                selectedPenTool,
                selectedColor,
                strokeWidth,
                textSettings: {
                  fontSize,
                  textColor,
                  selectedFont,
                  selectedTextType,
                  isBold,
                  lineSpacing,
                  letterSpacing
                }
              },
              // データサイズ情報
              contentLength: content.length,
              pathsCount: drawingPaths.length,
              elementsCount: 0 // 現在はテキスト要素なし
            },
            lastModified: new Date().toISOString(),
            pageMetadata: getPageMetadata()
          }],
          currentPageIndex: 0,
          metadata: getNoteMetadata(),
          lastModified: new Date().toISOString(),
          lastSaved: new Date().toISOString(),
          autoSaveEnabled: true
        };

        // 🎯 統一自動保存サービス呼び出し
        const universalNoteService = new UniversalNoteService({
          debugMode: true,
          enableValidation: true,
          enableRetry: true
        });

        const saveResult = await universalNoteService.saveUniversalNote(universalNote);
        
        if (saveResult.success) {
          setHasUnsavedChanges(false);
          console.log('✅ UniversalNoteService自動保存完了:', { 
            noteType: universalNote.type,
            pathsCount: drawingPaths.length, 
            contentLength: content.length,
            saveTime: saveResult.metrics?.saveTime
          });
        } else {
          console.error('❌ UniversalNoteService自動保存失敗:', saveResult.error);
          // フォールバック: legacy保存実行
          await updateCanvasData(noteIdToUse, universalNote.pages[0].canvasData);
          setHasUnsavedChanges(false);
          console.log('✅ フォールバック保存完了 (legacy)');
        }
      } else {
        console.log('⚠️ 自動保存スキップ: noteIdが見つかりません');
      }
    } catch (error) {
      console.error('⚠️ UniversalNoteService自動保存エラー:', error);
      // 緊急フォールバック
      try {
      const noteIdToUse = actualNoteId || newNoteId || noteId;
      if (noteIdToUse) {
        const canvasData = {
          type: 'canvas',
          version: '1.0',
          title: title,
          content: content,
          drawingPaths: drawingPaths,
          canvasSettings: {
            selectedTool,
            selectedPenTool,
            selectedColor,
            strokeWidth,
            textSettings: {
              fontSize,
              textColor,
              selectedFont,
              selectedTextType,
              isBold,
              lineSpacing,
              letterSpacing
            }
          },
          lastModified: new Date().toISOString()
        };
        await updateCanvasData(noteIdToUse, canvasData);
        setHasUnsavedChanges(false);
          console.log('✅ 緊急フォールバック保存完了');
      }
      } catch (fallbackError) {
        console.error('❌ 緊急フォールバック保存も失敗:', fallbackError);
      }
    } finally {
      setIsSaving(false);
    }
  };



  // 🆕 ページメタデータ取得関数
  const getPageMetadata = () => {
    const baseMetadata: any = {};
    
    if (recordingState !== 'idle') {
      baseMetadata.audioTimestamp = { start: 0, end: 0 };
      baseMetadata.transcriptText = content;
    }
    
    const noteType = determineNoteType();
    if (noteType === 'photo_scan') {
      baseMetadata.ocrResult = { text: content, confidence: 0.95 };
      baseMetadata.enhancedText = content;
    }
    
    if (noteType === 'import') {
      baseMetadata.sourceUri = route.params?.noteId;
      baseMetadata.sourceType = 'text';
    }
    
    return baseMetadata;
  };

  // 🆕 ノートメタデータ取得関数
  const getNoteMetadata = () => {
    const baseMetadata: any = {
      totalPages: 1,
      autoSplitEnabled: false,
      created_at: new Date().toISOString(),
      note_type: determineNoteType()
    };
    
    const noteType = determineNoteType();
    if (noteType === 'recording') {
      baseMetadata.recordingMetadata = {
        duration: 0,
        originalAudioUri: '',
        sttProvider: 'google',
        confidence: 0.95
      };
    }
    
    if (noteType === 'photo_scan') {
      baseMetadata.photoScanMetadata = {
        originalPhotoUris: [route.params?.noteId || ''],
        ocrProvider: 'google_vision',
        totalPhotos: 1
      };
    }
    
    if (noteType === 'import') {
      baseMetadata.importMetadata = {
        originalFormat: 'text',
        sourcePath: route.params?.noteId || '',
        fileSize: content.length
      };
    }
    
    return baseMetadata;
  };

  // 🔧 画面離脱時の確実な保存（beforeRemoveリスナー）
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      console.log(' beforeRemove: 画面離脱検知');

      if (!hasUnsavedChanges && !autoSaveHasUnsavedChanges) {
        console.log('📝 未保存の変更なし – そのまま離脱');
        return; // 何もせずにネイティブの戻るを許可
      }

      // ⚡️ ネイティブ側の画面遷移はブロックせず、非同期で保存のみ実行
      flushSave()
        .then(() => console.log('✅ beforeRemove: バックグラウンド保存完了'))
        .catch((err) => console.error('❌ beforeRemove: バックグラウンド保存失敗', err));
      // 戻り値を返さずそのまま離脱を続行
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, autoSaveHasUnsavedChanges, flushSave]);

  // 🛡️ 追加の安全策：コンポーネントアンマウント時の最終保存
  React.useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる直前に最終保存を試行
      if (hasUnsavedChanges) {
        console.log('🔄 コンポーネントアンマウント時の最終保存...');
        performAutoSave().catch((error) => {
          console.log('⚠️ アンマウント時の保存エラー:', error);
        });
      }
    };
  }, [hasUnsavedChanges, performAutoSave]);

  // 🎤 TTS音声再生の処理（既存のhandleAudioPlay関数を拡張）
  const handleAudioPlay = async () => {
    console.log('🎵🎵🎵 handleAudioPlay関数開始:', {
      isTTSPlaying,
      ttsAudioUrl,
      hasContent: !!content,
      contentLength: content?.length || 0
    });
    
    try {
      if (isTTSPlaying) {
        // 🎵 TTS再生中の場合：一時停止
        console.log('🎵 TTS一時停止処理開始');
        await ttsAudioPlayer.pause();
        setIsTTSPlaying(false);
        setAudioPlayState('paused');
        console.log('🎵 TTS一時停止完了');
      } else {
        // 🎵 TTS再生開始
        console.log('🎵 TTS再生開始処理:', { ttsAudioUrl: !!ttsAudioUrl });
        
        // 🆕 TTS再生開始時に全サブツールバーを強制的に閉じる
        console.log('🎵 TTS再生開始 - 全サブツールバー強制非表示');
        setSelectedTool(null);
        setSelectedPenTool(null);
        setSelectedKeyboardTool(null);
        setShowColorSettings(false);
        setShowStrokeSettings(false);
        setIsSearchVisible(false);
        console.log('🎵 サブツールバー強制非表示完了');
        
        let audioUrl = ttsAudioUrl;

        if (!audioUrl) {
          // 初回再生：TTS音声を生成
          console.log('🎤 TTS音声未生成 - 生成開始');
          audioUrl = await generateTTSAudio();
          console.log('🎤 TTS音声生成完了 - 再生開始');
        }

        // audioUrlが取得できたか確認
        if (audioUrl) {
          // state同期
          if (!ttsAudioUrl) {
            setTTSAudioUrl(audioUrl);
          }
          console.log('🎵 TTS音声URL確認済み - 再生開始:', audioUrl);
          
          // 🎯 一時停止からの再開の場合は現在位置から再生
          const currentState = ttsAudioPlayer.getPlaybackState();
          console.log('🎵 再生開始前の状態確認:', {
            currentPosition: currentState.currentPosition,
            isPlaying: currentState.isPlaying,
            duration: currentState.duration
          });
          
          if (currentState.currentPosition > 0) {
            console.log('🎵 一時停止位置から再開:', currentState.currentPosition);
            // 🎯 先に再生開始してから位置を設定（音声再ロードを防ぐ）
          await ttsAudioPlayer.play();
            await ttsAudioPlayer.seekTo(currentState.currentPosition);
          } else {
            console.log('🎵 最初から再生開始');
            await ttsAudioPlayer.play();
          }
          
          setIsTTSPlaying(true);
          setAudioPlayState('playing');
          console.log('🎵 TTS再生開始完了');
        } else {
          // 音声生成失敗時は既にgenerateTTSAudioでエラー処理済み
          console.log('🎵 音声生成失敗のため再生をスキップ');
        }
      }
      markAsChanged('voice_record', { playState: audioPlayState }); // 🎯 統一自動保存
    } catch (error) {
      console.error('🚨 TTS再生エラー:', error);
      Alert.alert('エラー', '音声の再生に失敗しました。');
      setIsTTSPlaying(false);
      setAudioPlayState('paused');
    }
  };

  const handleAudioPause = () => {
    setAudioPlayState('paused');
    console.log('⏸️ 音声再生一時停止');
    markAsChanged(); // 🔥 追加: 音声停止時に変更フラグを立てる
  };

  const handleAudioSeek = async (seconds: number) => {
    try {
      console.log('🎵🎵🎵 handleAudioSeek開始:', {
        seconds,
        hasTTSAudioUrl: !!ttsAudioUrl,
        hasTTSAudioPlayer: !!ttsAudioPlayer,
        isTTSPlaying,
        audioPlayState
      });
      
      if (ttsAudioUrl && ttsAudioPlayer) {
        const currentState = ttsAudioPlayer.getPlaybackState();
        console.log('🎵 シーク前の状態:', {
          currentPosition: currentState.currentPosition,
          duration: currentState.duration,
          isPlaying: currentState.isPlaying
        });
        
        if (seconds > 0) {
          // 10秒進む
          console.log('🎵 10秒進むボタン押下');
          await ttsAudioPlayer.seekForward();
          console.log('🎵 TTS 10秒進む完了');
        } else {
          // 10秒戻る
          console.log('🎵 10秒戻るボタン押下');
          await ttsAudioPlayer.seekBackward();
          console.log('🎵 TTS 10秒戻る完了');
        }
        
        const newState = ttsAudioPlayer.getPlaybackState();
        console.log('🎵 シーク後の状態:', {
          currentPosition: newState.currentPosition,
          duration: newState.duration,
          isPlaying: newState.isPlaying
        });
      } else {
        console.log('🎵 TTS音声未ロード - シーク無効:', {
          ttsAudioUrl: !!ttsAudioUrl,
          ttsAudioPlayer: !!ttsAudioPlayer
        });
      }
      markAsChanged(); // 🔥 追加: 音声シーク時に変更フラグを立てる
    } catch (error) {
      console.error('🚨 TTSシークエラー:', error);
    }
  };

  // 🎵 再生速度変更ハンドラー
  const handleSpeedChange = async () => {
    try {
      const newSpeed = audioSpeed === 1.0 ? 1.5 : audioSpeed === 1.5 ? 2.0 : 1.0;
      console.log('🎵 再生速度変更:', audioSpeed, '→', newSpeed);
      
      setAudioSpeed(newSpeed);
      
      // TTS音声プレイヤーに再生速度を設定
      if (ttsAudioPlayer) {
        await ttsAudioPlayer.setPlaybackRate(newSpeed);
        console.log('🎵 TTS再生速度設定完了:', newSpeed);
      }
      
      markAsChanged('voice_record', { playbackRate: newSpeed });
    } catch (error) {
      console.error('🚨 再生速度変更エラー:', error);
    }
  };



  // ✨ 超デバッグ版フォントサイズ変更ハンドラー
  // フォントサイズ変更ハンドラ
  const handleFontSizeChange = (newSize: number) => {
    if (newSize >= 8 && newSize <= 32) {
      setFontSize(newSize);
      markAsChanged('font_size', { fontSize: newSize });
    }
  };

  // フォントサイズ増加ハンドラ
  const handleFontSizeIncrease = () => {
    handleFontSizeChange(fontSize + 2);
  };

  // フォントサイズ減少ハンドラ
  const handleFontSizeDecrease = () => {
    handleFontSizeChange(fontSize - 2);
  };

  // 🎤 TTS関連の状態管理
  const [audioPlayer] = useState(() => new AudioPlayer()); // 独自AudioPlayerインスタンス作成
  const [ttsAudioPlayer] = useState(() => {
    const player = new TTSAudioPlayer();
    player.setAudioPlayer(audioPlayer); // expo-audioプレイヤーを設定
    // 再生位置更新用のコールバックを登録
    player.setOnStateChange((state) => {
      console.log('🎤 CanvasEditor: onStateChange受信:', {
        currentPosition: state.currentPosition,
        isPlaying: state.isPlaying
      });
      setAudioCurrentTime(state.currentPosition);
    });
    // 🆕 再生完了コールバックを登録
    player.setOnPlaybackComplete(() => {
      console.log('🎤 CanvasEditor: 再生完了コールバック受信');
      console.log('🎤 再生完了前の状態:', {
        isTTSPlaying,
        audioPlayState,
        currentSentenceIndex,
        audioCurrentTime,
        audioSpeed,
        highlightRangesCount: highlightRanges.length
      });
      
      setIsTTSPlaying(false);
      setAudioPlayState('paused');
      setCurrentSentenceIndex(0);
      setAudioCurrentTime(0);
      // ハイライトもリセット
      setHighlightRanges([]);
      // 🎵 再生速度もリセット（UIと実際の速度の不一致を防ぐ）
      setAudioSpeed(1.0);
      
      console.log('🎤 再生完了 - UI状態リセット完了:', {
        isTTSPlaying: false,
        audioPlayState: 'paused',
        currentSentenceIndex: 0,
        audioCurrentTime: 0,
        audioSpeed: 1.0,
        highlightRangesCount: 0
      });
    });
    return player;
  });
  const [ttsClient] = useState(() => new TTSClient()); // baseUrlは環境変数から自動取得
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [ttsAudioUrl, setTTSAudioUrl] = useState<string | null>(null);
  const [ttsSentences, setTTSSentences] = useState<TTSSentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [highlightRanges, setHighlightRanges] = useState<Array<{
    start: number;
    end: number;
    type: 'all' | 'current';
    color: string;
  }>>([]);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  
  // 🎤 TTS プロバイダー切り替え機能
  const [currentTTSProvider, setCurrentTTSProvider] = useState<'google' | 'minimax' | 'gemini'>('google');
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [availableTTSProviders] = useState<Array<{
    id: 'google' | 'minimax' | 'gemini';
    name: string;
    description: string;
  }>>([
    { id: 'google', name: 'Google TTS', description: '高品質・安定' },
    { id: 'minimax', name: 'MiniMax TTS', description: '自然な日本語' },
    { id: 'gemini', name: 'Gemini TTS', description: 'AI音声合成' },
  ]);

  // 🎨 文章ハイライト機能
  const updateHighlights = useCallback((text: string, currentIndex: number) => {
    const sentences = splitIntoSentencesWithDetails(text);
    const ranges = sentences.map((sentence, index) => ({
      start: sentence.startPosition,
      end: sentence.endPosition,
      type: (index === currentIndex ? 'current' : 'all') as 'all' | 'current',
      color: index === currentIndex ? '#629ff4' : '#a6bef8'
    }));
    setHighlightRanges(ranges);
  }, []);

  // 🎨 テキスト選択によるハイライト移動
  const handleTextSelection = useCallback((event: any) => {
    const { selection } = event.nativeEvent;
    const sentences = splitIntoSentencesWithDetails(content);
    
    // タップ位置から該当文を特定
    const targetSentence = sentences.findIndex(s => 
      selection.start >= s.startPosition && selection.start <= s.endPosition
    );
    
    if (targetSentence !== -1 && targetSentence !== currentSentenceIndex) {
      setCurrentSentenceIndex(targetSentence);
      updateHighlights(content, targetSentence);
      
      // TTS再生中の場合は該当文にジャンプ
      if (isTTSPlaying && ttsAudioPlayer) {
        ttsAudioPlayer.seekToSentence(targetSentence);
        console.log('🎯 文章タップ - TTS位置移動:', targetSentence);
      }
    }
  }, [content, currentSentenceIndex, isTTSPlaying, ttsAudioPlayer, updateHighlights]);

  // 🎯 Phase 2: 自動スクロール機能
  const handleTextLayout = useCallback((event: any) => {
    const { layout } = event.nativeEvent;
    console.log('📏 テキストレイアウト更新:', { 
      height: layout.height, 
      width: layout.width 
    });
    
    // テキストの高さから行数を推定（フォントサイズベース）
    const estimatedLineHeight = fontSize * lineSpacing;
    const estimatedLines = Math.ceil(layout.height / estimatedLineHeight);
    
    // 行ごとの座標を推定して保存
    for (let i = 0; i < estimatedLines; i++) {
      lineCoordinates.current[i] = i * estimatedLineHeight;
    }
  }, [fontSize, lineSpacing]);

  const handleManualScroll = useCallback(() => {
    lastManualScrollTime.current = Date.now();
    console.log('👆 手動スクロール検知 - 自動スクロール一時停止');
    
    // 🎯 Phase 2: 音声再生中は手動スクロールでもキャンバス選択処理を実行しない
    if (isTTSPlaying) {
      console.log('🎵 音声再生中のため、スクロールによるキャンバス選択をスキップ');
      return;
    }
  }, [isTTSPlaying]);

  const performAutoScroll = useCallback((sentenceIndex: number) => {
    const now = Date.now();
    if (now - lastManualScrollTime.current < AUTO_SCROLL_DELAY) {
      console.log('⏸️ 手動スクロール後のため自動スクロールをスキップ');
      return; // 手動スクロール後は一定時間停止
    }

    // 文章インデックスから対応する行を推定
    const sentences = splitIntoSentencesWithDetails(content);
    if (sentenceIndex >= 0 && sentenceIndex < sentences.length) {
      const sentence = sentences[sentenceIndex];
      const textBeforeSentence = content.substring(0, sentence.startPosition);
      const lineIndex = textBeforeSentence.split('\n').length - 1;
      
      const targetY = lineCoordinates.current[lineIndex];
      if (targetY !== undefined && scrollViewRef.current) {
        console.log('📜 自動スクロール実行:', {
          sentenceIndex,
          lineIndex,
          targetY,
          scrollTo: Math.max(0, targetY - 80)
        });
        
        scrollViewRef.current.scrollTo({
          y: Math.max(0, targetY - 80), // 80px上に余白
          animated: true
        });
      }
    }
  }, [content]);

  // 🎤 TTS プロバイダー切り替えハンドラー
  const handleTTSProviderChange = (providerId: 'google' | 'minimax' | 'gemini') => {
    setCurrentTTSProvider(providerId);
    setShowVoiceSettingsModal(false);
    
    // 現在再生中の音声があれば停止
    if (isTTSPlaying) {
      ttsAudioPlayer.pause();
      setIsTTSPlaying(false);
      setAudioPlayState('paused');
    }
    
    // 音声URLをクリアして再生成を促す
    setTTSAudioUrl(null);
    
    console.log('🎤 TTSプロバイダー変更:', providerId);
    markAsChanged('voice_record', { provider: providerId });
  };

  // 🎤 TTS音声生成関数
  const generateTTSAudio = async (): Promise<string | null> => {
    setTTSErrorShown(false); // 🎯 毎回初期化
    try {
      setIsTTSLoading(true);
      console.log('🎤🎤🎤 TTS音声生成開始 - generateTTSAudio関数実行中');
      
      // 🔍 詳細デバッグ: drawingPaths の状態を確認
      console.log('🔍 generateTTSAudio - drawingPaths詳細分析:', {
        pathsLength: drawingPaths?.length || 0,
        pathsExists: !!drawingPaths,
        canvasRefExists: !!drawingCanvasRef.current,
        pathsDetails: drawingPaths?.map((path, index) => ({
          index,
          tool: path.tool,
          color: path.color,
          strokeWidth: path.strokeWidth,
          timestamp: path.timestamp,
          pathLength: path.path.length,
          pathPreview: path.path.substring(0, 100) + '...'
        })) || []
      });

      // 1️⃣ まず手書きが存在するか判定
      if (drawingPaths && drawingPaths.length > 0 && drawingCanvasRef.current) {
        console.log('🖊️ 手書き検出: Handwriting OCR→TTS パスへ');
        console.log('🖊️ 手書きパス数:', drawingPaths.length);
        
        // 🔧 React Native Skiaのレンダリング完了を待機
        console.log('⏳ キャンバスレンダリング完了待機中...');
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ キャンバスレンダリング待機完了');
        
        const base64Img = drawingCanvasRef.current.captureHandwriting();
        console.log('🖊️ 画像キャプチャ結果:', base64Img ? `${base64Img.length}文字のBase64` : 'null');
        
        // 🔍 追加デバッグ: 画像サイズとパス数の関係を確認
        if (base64Img) {
          console.log('🔍 画像キャプチャ詳細分析:', {
            base64Length: base64Img.length,
            pathsCount: drawingPaths.length,
            expectedChange: '画像サイズがパス数に応じて変化しているか？',
            base64Preview: base64Img.substring(0, 100) + '...'
          });
        }
        if (base64Img) {
          try {
            console.log('🖊️ HandwritingTTSClient呼び出し開始...');
            const mp3Path = await handwritingTTSClient.synthesizeFromBase64(base64Img, {
              speakingRate: audioSpeed,
            });
            console.log('🖊️ 音声ファイル生成完了:', mp3Path);
            await ttsAudioPlayer.loadTTSAudio(mp3Path, []); // sentence timing未対応
            setTTSAudioUrl(mp3Path);
            console.log('✅ 手書き音声生成完了');
            return mp3Path;
          } catch (handErr) {
            // 手書き認識エラー時はログを出力せずにアラートのみ表示
            if (!ttsErrorShown) {
              Alert.alert('文字が認識できません！', 'もう一度書き直すかテキストを入力して音声にしてみてください！');
              setTTSErrorShown(true);
            }
            // 手書きエラー時は即座に終了（フォールバック処理をスキップ）
            return null;
          }
        } else {
          console.log('🖊️ 画像キャプチャ失敗 - テキストTTSにフォールバック');
        }
      }

      // 2️⃣ フォールバック: テキストTTS
      const rawText = content.trim();
      console.log('🔧 TTS前処理前のテキスト:', {
        rawTextLength: rawText.length,
        rawTextPreview: rawText.substring(0, 200) + (rawText.length > 200 ? '...' : ''),
        containsAsterisk: rawText.includes('*'),
        containsDoubleAsterisk: rawText.includes('**')
      });
      
      const textToSpeak = preprocessTextForTTS(rawText);
      console.log('🎤 テキスト確認（TTS前処理後）:', {
        originalLength: rawText.length,
        processedLength: textToSpeak.length,
        textPreview: textToSpeak.substring(0, 100) + (textToSpeak.length > 100 ? '...' : ''),
        hasText: !!textToSpeak,
        hasChanges: rawText !== textToSpeak
      });
      
      // 🧪 開発環境でのみデバッグ情報を表示
      if (__DEV__ && rawText !== textToSpeak) {
        console.log('🔧 TTS前処理詳細:', {
          originalText: rawText.substring(0, 200) + (rawText.length > 200 ? '...' : ''),
          processedText: textToSpeak.substring(0, 200) + (textToSpeak.length > 200 ? '...' : ''),
          removedCharacters: rawText.length - textToSpeak.length
      });
      }
      
      if (!textToSpeak) {
        console.warn('⚠️ 読み上げテキストが空です');
        if (!ttsErrorShown) {
        Alert.alert('エラー', '読み上げるテキストがありません。');
          setTTSErrorShown(true);
        }
        return null;
      }

      // 文章を句点で分割（正しいプロパティ名を使用）
      const sentenceDetails = splitIntoSentencesWithDetails(textToSpeak);
      setTTSSentences(sentenceDetails.map((detail, index) => ({
        text: detail.text,
        start_time: index * 3, // 仮の時間（実際はTTSプロバイダーから取得）
        end_time: (index + 1) * 3,
        start_index: detail.startPosition, // 正しいプロパティ名
        end_index: detail.endPosition,     // 正しいプロパティ名
      })));

      // TTSサービスで音声生成（現在選択されたプロバイダーを使用）
      console.log('🎤 TTS API呼び出し開始:', {
        textLength: textToSpeak.length,
        provider: currentTTSProvider
      });
      
      console.log('🎤 TTS API呼び出し直前:', {
        ttsClientExists: !!ttsClient,
        provider: currentTTSProvider,
        textLength: textToSpeak.length
      });
      
      const ttsResponse = await ttsClient.synthesize({
        text: textToSpeak,
        provider_name: currentTTSProvider, // 選択されたプロバイダーを使用
        audio_format: 'mp3',          // ストリーミング互換フォーマットに固定
      });
      
      console.log('🎤 TTS API呼び出し完了:', {
        responseExists: !!ttsResponse,
        responseType: typeof ttsResponse
      });
      
      console.log('🎤 generateTTSAudio レスポンス確認:', {
        hasAudioUrl: !!ttsResponse.audio_url,
        audioUrl: ttsResponse.audio_url,
        audioUrlType: typeof ttsResponse.audio_url,
        audioUrlLength: ttsResponse.audio_url?.length || 0,
        audioUrlStartsWith: ttsResponse.audio_url?.substring(0, 50) || 'N/A',
        hasSentences: !!ttsResponse.sentences,
        sentencesLength: ttsResponse.sentences?.length || 0,
        provider: ttsResponse.provider,
        duration: ttsResponse.duration
      });
      
      // 音声URLの詳細検証
      if (!ttsResponse.audio_url) {
        throw new Error('TTS APIから音声URLが返されませんでした');
      }
      
      if (typeof ttsResponse.audio_url !== 'string') {
        throw new Error(`音声URLの型が不正です: ${typeof ttsResponse.audio_url}`);
      }
      
      if (!ttsResponse.audio_url.startsWith('http://') && !ttsResponse.audio_url.startsWith('https://')) {
        throw new Error(`音声URLの形式が不正です: ${ttsResponse.audio_url.substring(0, 100)}`);
      }
      
      console.log('✅ 音声URL検証完了:', {
        url: ttsResponse.audio_url,
        isValidUrl: true
      });
      
      // TTSAudioPlayerに音声をロード（正しい引数で呼び出し）
      await ttsAudioPlayer.loadTTSAudio(ttsResponse.audio_url, ttsResponse.sentences);
      setTTSAudioUrl(ttsResponse.audio_url);

      console.log('✅ TTS音声生成完了:', { 
        textLength: textToSpeak.length,
        sentenceCount: sentenceDetails.length,
        audioUrl: ttsResponse.audio_url,
        duration: ttsResponse.duration,
        provider: ttsResponse.provider
      });

      // audio_urlを呼び出し元へ返却
      return ttsResponse.audio_url;

    } catch (error) {
      console.warn('⚠️ TTS音声生成エラー:', error);
      if (!ttsErrorShown) {
      Alert.alert('エラー', 'テキストの音声変換に失敗しました。');
        setTTSErrorShown(true);
      }
      setIsTTSLoading(false);
      return null;
    } finally {
      setIsTTSLoading(false);
    }
  };

  // 🎵 TTS再生中のハイライト同期
  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;

    if (isTTSPlaying && ttsAudioPlayer && ttsSentences.length > 0) {
      updateInterval = setInterval(() => {
        const playbackState = ttsAudioPlayer.getPlaybackState();
        const currentTime = playbackState.currentPosition;
        
        // 現在時刻に対応する文を特定
        const currentIndex = ttsSentences.findIndex(s => 
          currentTime >= s.start_time && currentTime <= s.end_time
        );
        
        if (currentIndex !== -1 && currentIndex !== currentSentenceIndex) {
          setCurrentSentenceIndex(currentIndex);
          updateHighlights(content, currentIndex);
          // 🎯 Phase 2: 自動スクロール実行
          performAutoScroll(currentIndex);
          console.log('🎵 TTS同期ハイライト更新 + 自動スクロール:', currentIndex);
        }
      }, 100); // 100ms間隔で更新
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [isTTSPlaying, ttsAudioPlayer, ttsSentences, content, currentSentenceIndex, updateHighlights]);

  // 🔍 検索機能の状態管理
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{
    type: 'text' | 'drawing' | 'ocr';
    index: number;
    text: string;
    startIndex: number;
    endIndex: number;
    confidence?: number;
  }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
  const searchInputRef = useRef<TextInput>(null);
  


  // 📏 定規機能の状態管理（新規追加 - 既存機能への影響なし）
  const [rulerState, setRulerState] = useState({
    isVisible: false,              // 表示/非表示
    x: 50,                        // X座標（デフォルト位置）
    y: 100,                       // Y座標（デフォルト位置）
    rotation: 0,                  // 角度（度数）
    length: 0                     // 長さ（動的計算）
  });

  // 🔍 検索機能ハンドラー
  const handleSearchToggle = () => {
    setIsSearchVisible(!isSearchVisible);
    if (!isSearchVisible) {
      // 検索を開いたときに入力欄にフォーカス
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // 検索を閉じたときにクリア
      handleSearchClear();
    }
    
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    setIsCanvasIconsVisible(false);
  };

  // 🔍 検索実行
  const performSearch = (query: string) => {
    console.log('🔍 検索開始:', { 
      query, 
      contentLength: content.length, 
      titleLength: title.length,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      title 
    });
    
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const results: Array<{
      type: 'text' | 'drawing' | 'ocr';
      index: number;
      text: string;
      startIndex: number;
      endIndex: number;
      confidence?: number;
    }> = [];

    // 1. メインテキスト内容を検索
    const contentText = content.toLowerCase();
    const searchTerm = query.toLowerCase();
    let startIndex = 0;
    
    console.log('🔍 コンテンツ検索:', { contentText: contentText.substring(0, 200), searchTerm });
    
    while (true) {
      const index = contentText.indexOf(searchTerm, startIndex);
      if (index === -1) break;
      
      results.push({
        type: 'text',
        index: results.length,
        text: content.substring(index, index + query.length),
        startIndex: index,
        endIndex: index + query.length,
      });
      
      console.log('🎯 コンテンツマッチ発見:', { index, matchText: content.substring(index, index + query.length) });
      startIndex = index + 1;
    }

    // 2. タイトルを検索
    const titleText = title.toLowerCase();
    console.log('🔍 タイトル検索:', { titleText, searchTerm, includes: titleText.includes(searchTerm) });
    
    if (titleText.includes(searchTerm)) {
      results.push({
        type: 'text',
        index: results.length,
        text: title,
        startIndex: 0,
        endIndex: title.length,
      });
      console.log('🎯 タイトルマッチ発見:', title);
    }

    // 3. OCRテキストがある場合は検索（写真スキャンノート）
    if (isPhotoScanNote) {
      console.log('📸 写真スキャンノート検索（今後実装予定）');
      // TODO: OCRテキストデータがcanvasDataに含まれる場合の検索実装
    }
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    
    console.log(`🔍 検索完了: "${query}" - ${results.length}件見つかりました`, { results });
  };

  // 🔍 検索クエリ変更時
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  // 🔍 次の検索結果へ移動
  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToSearchResult(nextIndex);
  };

  // 🔍 前の検索結果へ移動
  const handleSearchPrevious = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    scrollToSearchResult(prevIndex);
  };

  // 🔍 検索結果への自動スクロール
  const scrollToSearchResult = (index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    const result = searchResults[index];
    
    if (result.type === 'text') {
      // テキスト検索結果の場合、TextInputの該当位置にカーソルを移動
      // Note: React NativeのTextInputでは直接的なスクロール制御は限定的
      console.log(`📍 検索結果 ${index + 1}/${searchResults.length}: "${result.text}"`);
    }
  };

  // 🔍 検索クリア
  const handleSearchClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  // 🆕 ページ管理ハンドラー
  const handleAddPage = async () => {
    try {
      // 🆕 現在のページデータを保存してから新しいページを追加
      saveCurrentPageData();
      
      const newPageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newPage = {
        id: newPageId,
        title: `ページ ${totalPages + 1}`,
        content: '',
        drawingPaths: [],
        canvasData: {
          type: 'canvas',
          version: '1.0',
          content: '',
          drawingPaths: [],
          textElements: [],
          canvasSettings: {
            selectedTool: null,
            selectedPenTool: null,
            selectedColor: '#000000',
            strokeWidth: 2
          }
        }
      };

      setPages(prev => [...prev, newPage]);
      setTotalPages(prev => prev + 1);
      
      // 🆕 新しいページに移動して即座にUIをクリア
      const newPageIndex = totalPages;
      setCurrentPageIndex(newPageIndex);
      
      // 🚨 重要: UIを即座にクリアして新しいページの空の状態を反映
      setContent('');
      setDrawingPaths([]);
      
      console.log('📄 新しいページを追加してUIをクリア:', newPageId, 'インデックス:', newPageIndex);
      
      // 🚨 デバッグアラート: ページ追加時
      // ページ追加完了
      
      // 自動保存をトリガー
      markAsChanged();
      
    } catch (error) {
      console.error('❌ ページ追加エラー:', error);
      Alert.alert('エラー', 'ページの追加に失敗しました');
    }
  };

  const handleDeletePage = async () => {
    if (totalPages <= 1) {
      Alert.alert('エラー', '最後のページは削除できません');
      return;
    }

    Alert.alert(
      'ページの削除',
      `ページ ${currentPageIndex + 1} を削除しますか？この操作は元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('📄 ページ削除開始:', {
                deletingPageIndex: currentPageIndex,
                totalPagesBefore: totalPages,
                pagesDataBefore: pages.map((p, i) => ({ 
                  index: i, 
                  content: p.content?.slice(0, 10) || '', 
                  pathsCount: p.drawingPaths?.length || 0 
                }))
              });
              
              // 🆕 削除対象ページ以外のデータを保存（削除前に現在のデータを保存）
              if (currentPageIndex > 0) {
                saveCurrentPageData();
              }
              
              // ページを削除
              const newPages = pages.filter((_, index) => index !== currentPageIndex);
              setPages(newPages);
              setTotalPages(newPages.length);
              
              console.log('📄 ページ削除後の状態更新:', {
                deletedPageIndex: currentPageIndex,
                newPagesLength: newPages.length,
                oldTotalPages: totalPages
              });
              
              // 🆕 削除後のページインデックス調整
              let newIndex;
              if (currentPageIndex >= newPages.length) {
                // 最後のページを削除した場合は前のページに移動
                newIndex = Math.max(0, newPages.length - 1);
              } else {
                // 中間のページを削除した場合は同じインデックス（次のページが繰り上がる）
                newIndex = currentPageIndex;
              }
              
              setCurrentPageIndex(newIndex);
              
              // 🆕 移動先のページデータを即座に復元
              if (newPages[newIndex]) {
                setContent(newPages[newIndex].content || '');
                setDrawingPaths(newPages[newIndex].drawingPaths || []);
                console.log('📄 ページ削除後のデータ復元完了:', {
                  newIndex,
                  totalPagesAfter: newPages.length,
                  restoredContent: newPages[newIndex].content?.slice(0, 10) || '',
                  restoredPathsCount: newPages[newIndex].drawingPaths?.length || 0
                });
              }
              
              // 🔔 変更フラグを立てる
              markAsChanged();
              
              // 🔄 300ms 後に最新 pages で保存（状態更新の反映を待つ）
              setTimeout(() => {
                console.log('💾 ページ削除後の遅延自動保存');
                performAutoSave();
              }, 300);
              
            } catch (error) {
              console.error('❌ ページ削除エラー:', error);
              Alert.alert('エラー', 'ページの削除に失敗しました');
            }
          }
        }
      ]
    );
  };

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      // 🆕 現在のページデータを保存してから移動
      saveCurrentPageData();
      const newIndex = currentPageIndex - 1;
      setCurrentPageIndex(newIndex);
      
      // 🆕 即座に移動先のページデータを復元
      if (pages[newIndex]) {
        setContent(pages[newIndex].content || '');
        setDrawingPaths(pages[newIndex].drawingPaths || []);
        console.log('📄 前のページに移動・データ復元完了:', newIndex, {
          contentLength: pages[newIndex].content?.length || 0,
          pathsCount: pages[newIndex].drawingPaths?.length || 0
        });
      }
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      // 🆕 現在のページデータを保存してから移動
      saveCurrentPageData();
      const newIndex = currentPageIndex + 1;
      setCurrentPageIndex(newIndex);
      
      // 🆕 即座に移動先のページデータを復元
      if (pages[newIndex]) {
        setContent(pages[newIndex].content || '');
        setDrawingPaths(pages[newIndex].drawingPaths || []);
        console.log('📄 次のページに移動・データ復元完了:', newIndex, {
          contentLength: pages[newIndex].content?.length || 0,
          pathsCount: pages[newIndex].drawingPaths?.length || 0
        });
      }
    }
  };

  // 🆕 現在のページデータを取得
  const getCurrentPageData = () => {
    return pages[currentPageIndex] || pages[0];
  };

  // 🆕 現在のページデータを更新
  const updateCurrentPageData = (updates: Partial<typeof pages[0]>) => {
    setPages(prev => {
      const newPages = [...prev];
      if (newPages[currentPageIndex]) {
        newPages[currentPageIndex] = { ...newPages[currentPageIndex], ...updates };
      }
      return newPages;
    });
  };

  // 🆕 現在のページデータを保存
  const saveCurrentPageData = () => {
    if (pages.length > 0 && pages[currentPageIndex]) {
      const updatedPage = {
        ...pages[currentPageIndex],
        content: content,
        drawingPaths: drawingPaths,
        canvasData: {
          type: 'canvas' as const,
          version: '1.0' as const,
          content: content,
          drawingPaths: drawingPaths,
          textElements: [],
          canvasSettings: {
            selectedTool,
            selectedPenTool,
            selectedColor,
            strokeWidth,
            textSettings: {
              fontSize,
              textColor,
              selectedFont,
              selectedTextType,
              isBold,
              lineSpacing,
              letterSpacing
            }
          }
        }
      };
      
      setPages(prev => {
        const newPages = [...prev];
        newPages[currentPageIndex] = updatedPage;
        return newPages;
      });
      
      console.log('💾 現在のページデータを保存:', currentPageIndex);
    }
  };

  // 🆕 指定ページのデータを復元
  const loadPageData = (pageIndex: number) => {
    if (pages.length > 0 && pages[pageIndex]) {
      const pageData = pages[pageIndex];
      
      console.log('📄 ページデータ復元開始:', pageIndex, {
        pageId: pageData.id,
        contentLength: pageData.content?.length || 0,
        pathsCount: pageData.drawingPaths?.length || 0,
        hasCanvasData: !!pageData.canvasData
      });
      
      // 🆕 状態を非同期で順次更新（React batching対応）
      setTimeout(() => {
        // UIの状態を復元
        setContent(pageData.content || '');
        console.log('📄 テキストコンテンツ復元完了:', pageData.content?.substring(0, 50));
      }, 0);
      
      setTimeout(() => {
        // 描画データを復元
        setDrawingPaths(pageData.drawingPaths || []);
        console.log('📄 描画パス復元完了:', pageData.drawingPaths?.length || 0);
      }, 10);
      
      // キャンバス設定を復元
      if (pageData.canvasData?.canvasSettings) {
        const settings = pageData.canvasData.canvasSettings;
        setTimeout(() => {
          if (settings.selectedColor) setSelectedColor(settings.selectedColor);
          if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
          console.log('📄 基本設定復元完了:', { color: settings.selectedColor, strokeWidth: settings.strokeWidth });
        }, 20);
        
        if (settings.textSettings) {
          const textSettings = settings.textSettings;
          setTimeout(() => {
            if (textSettings.fontSize) setFontSize(textSettings.fontSize);
            if (textSettings.textColor) setTextColor(textSettings.textColor);
            if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
            if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
            if (textSettings.isBold !== undefined) setIsBold(textSettings.isBold);
            if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
            if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
            console.log('📄 テキスト設定復元完了:', textSettings);
          }, 30);
        }
      }
      
      console.log('📄 ページデータ復元処理完了:', pageIndex);
    } else {
      console.warn('📄 ページデータが見つかりません:', { pageIndex, pagesLength: pages.length });
    }
  };

  // 🚨 削除：旧checkAutoSplit関数を完全削除（performPageSplitに統一）

  // 🎵 画面遷移・アンマウント時に TTS を停止
  useEffect(() => {
    const stopAudio = async () => {
      try {
        // 🎤 再生中の場合のみ一時停止（位置を保持）
        if (isTTSPlaying) {
          console.log('🎤 ナビゲーション離脱時の音声一時停止');
          await ttsAudioPlayer.pause();
          setIsTTSPlaying(false);
        } else {
          console.log('🎤 ナビゲーション離脱時: 既に停止済み');
        }
      } catch (error) {
        console.warn('🎤 ナビゲーション離脱時の音声停止エラー:', error);
      }
    };

    const unsubscribeBlur = navigation.addListener('beforeRemove', stopAudio);

    return () => {
      stopAudio();
      unsubscribeBlur();
    };
  }, [navigation, isTTSPlaying, ttsAudioPlayer]);

  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);
  const [handwritingTTSClient] = useState(() => new HandwritingTTSClient());



  // 🚨 TTSエラーフラグ：同一操作中に複数回アラートを出さないため
  const [ttsErrorShown, setTTSErrorShown] = useState(false);

  // 🆕 マルチページ管理用の状態
  const [pages, setPages] = useState<Array<{
    id: string;
    title: string;
    content: string;
    drawingPaths: DrawingPath[];
    canvasData: any;
  }>>([{
    id: 'page_0',
    title: 'ページ 1',
    content: '',
    drawingPaths: [],
    canvasData: {}
  }]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // 📊 Step 3: ページ分割実行機能（完全修正版）
  const isSplittingRef = useRef(false); // 🚨 二重分割防止フラグ
  const performPageSplit = useCallback((rawText: string) => {
    // 🚨 二重分割防止ガード
    if (isSplittingRef.current) {
      console.log('📄 Step 3: 分割処理中のため、再実行をスキップ');
      return;
    }

    isSplittingRef.current = true; // 🚨 分割処理開始フラグ

    console.log(`📄 Step 3: ループ分割開始`, {
      originalLength: rawText.length,
      currentPageIndex
    });

    try {
      // 1. 現在のpagesをコピーして編集
      setPages(prevPages => {
        let pagesDraft = [...prevPages];
        let workingText = rawText;
        let pageIdx = currentPageIndex; // まずは「今開いているページ」
        let splitCount = 0;

        // while で "残り2000字未満" になるまで分割し続ける
        while (workingText.length > 2000) {
          const splitPos = findSplitPosition(workingText);
          if (splitPos <= 0) break; // 分割位置が見つからない場合は終了

          const currPageText = workingText.slice(0, splitPos);
          const overflowText = workingText.slice(splitPos);

          // 🔧 バグ修正: 空のcurrPageTextで分割を防ぐ安全ガード
          if (currPageText.length === 0) {
            console.warn('📄 空のcurrPageTextを検知、分割をスキップ');
            break;
          }

          console.log(`📄 ループ分割 ${splitCount + 1}回目`, {
            workingTextLength: workingText.length,
            splitPos,
            currPageLength: currPageText.length,
            overflowLength: overflowText.length
          });

          // a) 今のページ内容を確定保存
          if (pagesDraft[pageIdx]) {
            pagesDraft[pageIdx] = {
              ...pagesDraft[pageIdx],
              content: currPageText,
              canvasData: {
                ...pagesDraft[pageIdx].canvasData,
                content: currPageText
              }
            };
          }

          // b) 新ページを生成（overflowTextが2000文字未満になるまで）
          if (overflowText.length > 0) {
            const newPage = {
              id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              title: `ページ ${pagesDraft.length + 1}`,
              content: overflowText,
              drawingPaths: [],
              canvasData: {
                type: 'canvas' as const,
                version: '1.0' as const,
                content: overflowText,
                drawingPaths: [],
                textElements: [],
                canvasSettings: {
                  selectedTool: null,
                  selectedPenTool: null,
                  selectedColor: '#000000',
                  strokeWidth: 2
                }
              }
            };
            pagesDraft.push(newPage);
          }

          // 次に分割対象となる文字列を更新
          workingText = overflowText;
          pageIdx = pagesDraft.length - 1; // 追加したページが次のターゲット
          splitCount++;

          // 無限ループ防止（最大10回分割）
          if (splitCount >= 10) {
            console.warn('📄 分割回数が上限に達しました');
            break;
          }
        }

        console.log(`📄 ループ分割完了`, {
          splitCount,
          finalPagesLength: pagesDraft.length,
          lastPageContent: pagesDraft[pagesDraft.length - 1]?.content?.length || 0
        });

        // c) ステート確定（setPages後に実行）
        setTimeout(() => {
          setTotalPages(pagesDraft.length);
          setCurrentPageIndex(pagesDraft.length - 1);
          // 🚨 修正：setContentを削除（pages配列から自動反映）
          
          // 分割状態をリセット
          setNeedsSplit(false);
          setSplitPosition(0);
          
          // Toast通知（最後に1回だけ）
          Alert.alert(
            '📄 ページ自動分割',
            `2000文字を超えたため、自動で${pagesDraft.length}ページに分割しました。`,
            [{ text: 'OK', style: 'default' }]
          );
          
          // 自動保存
          markAsChanged();
        }, 10);

        return pagesDraft; // ← setPages に返す
      });

    } catch (error) {
      console.error('📄 Step 3: ページ分割エラー:', error);
      Alert.alert('エラー', 'ページ分割中にエラーが発生しました。');
    } finally {
      // フラグ解除
      setTimeout(() => {
        isSplittingRef.current = false;
      }, 50);
    }
  }, [currentPageIndex, findSplitPosition, markAsChanged]);

  // 🚨 削除：分割用useEffectを完全削除（入力ハンドラ直接分割方式に変更）
  
  // 📄 pages配列からcontentを自動反映（setContentループを回避）
  useEffect(() => {
    const currentPageContent = pages[currentPageIndex]?.content || '';
    if (currentPageContent !== content) {
      setContent(currentPageContent);
      console.log('📄 pages配列からcontent自動反映:', {
        currentPageIndex,
        contentLength: currentPageContent.length
      });
    }
  }, [currentPageIndex, pages]);

  return (
    <TouchableWithoutFeedback onPress={() => setIsCanvasIconsVisible(false)}>
      <KeyboardAvoidingView 
        style={[styles.safeArea, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 上部バー */}
        <View style={styles.topBar}>
          {/* 戻るボタン（左端） */}
          <TouchableOpacity onPress={handleGoBack} style={styles.backButtonContainer}>
            <View style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#4F8CFF" />
            </View>
          </TouchableOpacity>
          
          {/* 中央のアイコン群 - 全てを1つのグループに統合して中央揃え */}
          <View style={[
            styles.centerIcons,
            isTablet() && styles.centerIconsTablet // iPad専用スタイル追加
          ]}>
            {/* 検索アイコン */}
            <TouchableOpacity 
              style={[
                styles.topBarIcon, 
                isTablet() && styles.topBarIconTablet, // iPad専用スタイル追加
                isSearchVisible && styles.selectedToolIcon,
                isTTSPlaying && styles.disabledSubToolIcon // 🆕 TTS再生中はグレーアウト
              ]} 
              onPress={() => {
                if (!checkEditingAllowed('検索機能の使用は')) return;
                handleToolbarIconPress();
              }}
              disabled={isTTSPlaying} // 🆕 TTS再生中は無効化
            >
              <Ionicons 
                name="search" 
                size={22} 
                color={isTTSPlaying ? '#999' : (isSearchVisible ? '#4F8CFF' : '#fff')} 
              />
            </TouchableOpacity>
            
            {/* ペンツールアイコン */}
            <TouchableOpacity 
              style={[
                styles.topBarIcon, 
                isTablet() && styles.topBarIconTablet, // iPad専用スタイル追加
                selectedTool === 'pen' && styles.selectedToolIcon,
                isTTSPlaying && styles.disabledSubToolIcon // 🆕 TTS再生中はグレーアウト
              ]} 
              onPress={handlePenToolPress}
              disabled={isTTSPlaying} // 🆕 TTS再生中は無効化
            >
              <MaterialIcons 
                name="edit" 
                size={22} 
                color={isTTSPlaying ? '#999' : (selectedTool === 'pen' ? '#4F8CFF' : '#fff')} 
              />
            </TouchableOpacity>
            
            {/* キーボードアイコン */}
            <TouchableOpacity 
              style={[
                styles.topBarIcon, 
                isTablet() && styles.topBarIconTablet, // iPad専用スタイル追加
                selectedTool === 'keyboard' && styles.selectedToolIcon,
                isTTSPlaying && styles.disabledSubToolIcon // 🆕 TTS再生中はグレーアウト
              ]} 
              onPress={handleKeyboardToolPress}
              disabled={isTTSPlaying} // 🆕 TTS再生中は無効化
            >
              <MaterialCommunityIcons 
                name="keyboard-outline" 
                size={22} 
                color={isTTSPlaying ? '#999' : (selectedTool === 'keyboard' ? '#4F8CFF' : '#fff')} 
              />
            </TouchableOpacity>
            
            {/* 音声録音エリア */}
            {recordingState === 'idle' ? (
              // 録音前：マイクアイコンのみ
              <TouchableOpacity 
                style={[
                  styles.topBarIcon, 
                  selectedTool === 'voice' && styles.selectedToolIcon,
                  isTTSPlaying && styles.disabledSubToolIcon // 🆕 TTS再生中はグレーアウト
                ]} 
                onPress={() => {
                  handleVoiceToolPress();
                  handleStartRecording();
                }}
                disabled={isTTSPlaying} // 🆕 TTS再生中は無効化
              >
                <Ionicons 
                  name="mic-outline" 
                  size={22} 
                  color={isTTSPlaying ? '#999' : (selectedTool === 'voice' ? '#4F8CFF' : '#fff')} 
                />
              </TouchableOpacity>
            ) : (
              // 録音中または一時停止中
              <>
                {/* 一時停止アイコン */}
                <TouchableOpacity 
                  style={styles.topBarIcon} 
                  onPress={handlePauseRecording}
                >
                  <Ionicons 
                    name={recordingState === 'recording' ? 'pause' : 'play'} 
                    size={22} 
                    color="#fff" 
                  />
                </TouchableOpacity>
                
                {/* 録音時間表示 */}
                <View style={styles.recordingTimeDisplay}>
                  <Text style={styles.recordingTimeTopBarText}>
                    {formatRecordingTime(recordingTime)}
                  </Text>
                </View>
                
                {/* 停止ボタン（赤色） */}
                <TouchableOpacity 
                  style={styles.topBarIcon} 
                  onPress={handleStopRecording}
                >
                  <Ionicons name="stop" size={22} color="#FF4444" />
                </TouchableOpacity>
              </>
            )}
            
            {/* 音声読み上げボタン */}
            <TouchableOpacity 
              style={[
                styles.topBarIcon,
                isTTSPlaying && styles.disabledSubToolIcon // TTS再生中はグレーアウト
              ]} 
              onPress={handleTTSButtonPress}
              disabled={isTTSPlaying} // TTS再生中は無効化
            >
              <Ionicons 
                name="volume-high-outline" 
                size={22} 
                color={isTTSPlaying ? '#999' : '#fff'} 
              />
            </TouchableOpacity>
            
          </View>
          
          {/* 右端のページ設定アイコン */}
          {recordingState === 'idle' && (
            <TouchableOpacity 
              style={[
                styles.topBarIcon,
                { marginRight: 16 }, // 右端に適切な余白
                isTTSPlaying && styles.disabledSubToolIcon // TTS再生中はグレーアウト
              ]}
              onPress={() => {
                if (!checkEditingAllowed('ページ設定の使用は')) return;
                handlePageSettings();
              }}
              disabled={isTTSPlaying} // TTS再生中は無効化
            >
              <MaterialCommunityIcons 
                name="content-copy" 
                size={22} 
                color={isTTSPlaying ? '#999' : '#fff'} 
              />
            </TouchableOpacity>
          )}

        </View>

        {/* 🔍 検索バー */}
        {isSearchVisible && (
          <View style={styles.searchBar}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="テキストを検索..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <Text style={styles.searchResultsText}>
                    {searchResults.length > 0 
                      ? `${currentSearchIndex + 1}/${searchResults.length}`
                      : '0件'
                    }
                  </Text>
                  {searchResults.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={styles.searchNavButton}
                        onPress={handleSearchPrevious}
                      >
                        <Ionicons 
                          name="chevron-up" 
                          size={18} 
                          color="#666"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.searchNavButton}
                        onPress={handleSearchNext}
                      >
                        <Ionicons 
                          name="chevron-down" 
                          size={18} 
                          color="#666"
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={styles.searchCloseButton}
                onPress={handleSearchToggle}
              >
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* サブツールバー - 選択されたツールによって表示 */}
        {selectedTool && selectedTool !== 'voice' && (
          <View style={[
            styles.subToolbar,
            isTablet() && styles.subToolbarTablet // iPad専用スタイル追加
          ]}>
            {selectedTool === 'pen' && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  { paddingHorizontal: 8 },
                  isTablet() && { paddingHorizontal: 0, justifyContent: 'center' } // iPad専用
                ]}
              >
                <View style={[
                  styles.subToolbarContent,
                  isTablet() && styles.subToolbarContentTablet // iPad専用スタイル追加
                ]}>
                  {/* サブツール：戻す、進める、ペン、鉛筆、マーカー、消しゴム、太さ、色、画像、定規 */}
                  <View style={[
                    styles.subToolGroup,
                    isTablet() && styles.subToolGroupTablet // iPad専用スタイル追加
                  ]}>
                    {/* 戻す・進める */}
                    <View style={styles.compactUndoRedoContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.compactUndoRedoIcon,
                          !drawingPaths.length && styles.disabledSubToolIcon
                        ]}
                        onPress={handleUndo}
                        disabled={!drawingPaths.length}
                      >
                        <Ionicons 
                          name="arrow-undo" 
                          size={14} 
                          color={drawingPaths.length ? '#666' : '#ccc'} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.compactUndoRedoIcon,
                          !redoStack.length && styles.disabledSubToolIcon
                        ]}
                        onPress={handleRedo}
                        disabled={!redoStack.length}
                      >
                        <Ionicons 
                          name="arrow-redo" 
                          size={14} 
                          color={redoStack.length ? '#666' : '#ccc'} 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    {/* ペンツール */}
                    <TouchableOpacity 
                      style={[
                        styles.subToolIcon,
                        selectedPenTool === 'pen' && styles.selectedSubToolIcon
                      ]}
                      onPress={() => handlePenToolSelect('pen')}
                    >
                      <MaterialCommunityIcons 
                        name="pen" 
                        size={22} 
                        color={selectedPenTool === 'pen' ? '#4F8CFF' : '#666'} 
                      />
                    </TouchableOpacity>
                    
                    {/* 鉛筆ツール */}
                    <TouchableOpacity 
                      style={[
                        styles.subToolIcon,
                        selectedPenTool === 'pencil' && styles.selectedSubToolIcon
                      ]}
                      onPress={() => handlePenToolSelect('pencil')}
                    >
                      <MaterialCommunityIcons 
                        name="lead-pencil" 
                        size={22} 
                        color={selectedPenTool === 'pencil' ? '#4F8CFF' : '#666'} 
                      />
                    </TouchableOpacity>
                    
                    {/* マーカー */}
                    <TouchableOpacity 
                      style={[
                        styles.subToolIcon,
                        selectedPenTool === 'marker' && styles.selectedSubToolIcon
                      ]}
                      onPress={() => handlePenToolSelect('marker')}
                    >
                      <MaterialCommunityIcons 
                        name="marker" 
                        size={22} 
                        color={selectedPenTool === 'marker' ? '#4F8CFF' : '#666'} 
                      />
                    </TouchableOpacity>
                    
                    {/* 消しゴム */}
                    <TouchableOpacity 
                      style={[
                        styles.subToolIcon,
                        selectedPenTool === 'eraser' && styles.selectedSubToolIcon
                      ]}
                      onPress={() => handlePenToolSelect('eraser')}
                    >
                      <MaterialCommunityIcons 
                        name="eraser" 
                        size={22} 
                        color={selectedPenTool === 'eraser' ? '#4F8CFF' : '#666'} 
                      />
                    </TouchableOpacity>
                    
                    {/* 線の太さ設定アイコン（消しゴム以外で表示） */}
                    {selectedPenTool !== 'eraser' && (
                      <TouchableOpacity 
                        style={[
                          styles.subToolIcon,
                          showStrokeSettings && styles.selectedSubToolIcon
                        ]}
                        onPress={handleStrokeSettingsToggle}
                      >
                        <MaterialCommunityIcons name="format-line-weight" size={22} color="#666" />
                      </TouchableOpacity>
                    )}
                    
                    {/* 色選択アイコン（消しゴム以外で表示） */}
                    {selectedPenTool !== 'eraser' && (
                      <TouchableOpacity 
                        style={[
                          styles.subToolIcon,
                          showColorSettings && styles.selectedSubToolIcon
                        ]}
                        onPress={handleColorSettingsToggle}
                      >
                        <MaterialIcons name="palette" size={22} color="#666" />
                      </TouchableOpacity>
                    )}
                    
                    {/* 定規 */}
                    <TouchableOpacity style={styles.subToolIcon} onPress={handleRulerTool}>
                      <MaterialCommunityIcons name="ruler" size={22} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
            
            {selectedTool === 'keyboard' && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  { paddingHorizontal: 8 },
                  isTablet() && { paddingHorizontal: 0, justifyContent: 'center' } // iPad専用
                ]}
              >
                <View style={[
                  styles.subToolbarContent,
                  isTablet() && styles.subToolbarContentTablet // iPad専用スタイル追加
                ]}>
                  <View style={[
                    styles.subToolGroup,
                    isTablet() && styles.subToolGroupTablet // iPad専用スタイル追加
                  ]}>
                    {/* 戻す・進める - compactUndoRedoContainer形式に統一 */}
                    <View style={styles.compactUndoRedoContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.compactUndoRedoIcon,
                          !drawingPaths.length && styles.disabledSubToolIcon
                        ]}
                        onPress={handleUndo}
                        disabled={!drawingPaths.length}
                      >
                        <Ionicons 
                          name="arrow-undo" 
                          size={14} 
                          color={drawingPaths.length ? '#666' : '#ccc'} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.compactUndoRedoIcon,
                          !redoStack.length && styles.disabledSubToolIcon
                        ]}
                        onPress={handleRedo}
                        disabled={!redoStack.length}
                      >
                        <Ionicons 
                          name="arrow-redo" 
                          size={14} 
                          color={redoStack.length ? '#666' : '#ccc'} 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.keyboardSelectorSmall} 
                      onPress={() => {
                        // 🔄 サイクル選択：見出し1 → 見出し2 → 見出し3 → 本文 → 見出し1...
                        const types: TextType[] = ['body', 'heading1', 'heading2', 'heading3'];
                        const currentIndex = types.indexOf(selectedTextType);
                        const nextType = types[(currentIndex + 1) % types.length];
                        handleTextTypeSelect(nextType);
                      }}
                    >
                      <Text style={styles.keyboardTextSmall}>
                        {selectedTextType === 'heading1' ? '見出し1' : 
                         selectedTextType === 'heading2' ? '見出し2' : 
                         selectedTextType === 'heading3' ? '見出し3' : '本文'}
                      </Text>
                      <MaterialIcons name="keyboard-arrow-down" size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.keyboardSelectorSmall} 
                      onPress={() => {
                        // 🔄 サイクル選択：UDフォント → 標準 → 明朝 → ゴシック → UDフォント...
                        const fonts: FontType[] = ['dyslexia', 'standard', 'serif', 'gothic'];
                        const currentIndex = fonts.indexOf(selectedFont);
                        const nextFont = fonts[(currentIndex + 1) % fonts.length];
                        handleFontSelect(nextFont);
                      }}
                    >
                      <Text style={styles.keyboardTextSmall}>
                        {availableFonts.find(font => font.key === selectedFont)?.label || 'UDフォント'}
                      </Text>
                      <MaterialIcons name="keyboard-arrow-down" size={18} color="#666" />
                    </TouchableOpacity>
                    <View style={styles.keyboardSelectorSmall}>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={handleFontSizeDecrease}>
                        <MaterialIcons name="remove" size={18} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.keyboardTextSmall}>{fontSize}</Text>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={handleFontSizeIncrease}>
                        <MaterialIcons name="add" size={18} color="#666" />
                      </TouchableOpacity>
                    </View>

                    
                    {/* 太字アイコン（ON・OFF）を追加 */}
                    <TouchableOpacity 
                      style={[
                        styles.keyboardSubToolIconSmall,
                        isBold && { backgroundColor: '#E3F2FD', borderColor: '#4F8CFF' }
                      ]} 
                      onPress={handleBoldToggle}
                    >
                      <MaterialIcons 
                        name="format-bold" 
                        size={18} 
                        color={isBold ? '#4F8CFF' : '#666'} 
                      />
                    </TouchableOpacity>
                    
                    {/* 行間調整 */}
                    <View style={styles.keyboardSelectorSmall}>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => handleLineSpacingChange(lineSpacing - 0.1)}>
                        <MaterialIcons name="format-line-spacing" size={18} color="#666" />
                        <MaterialIcons name="remove" size={12} color="#666" style={{ position: 'absolute', bottom: 0, right: 0 }} />
                      </TouchableOpacity>
                      <Text style={styles.keyboardTextSmall}>{lineSpacing.toFixed(1)}</Text>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => handleLineSpacingChange(lineSpacing + 0.1)}>
                        <MaterialIcons name="format-line-spacing" size={18} color="#666" />
                        <MaterialIcons name="add" size={12} color="#666" style={{ position: 'absolute', bottom: 0, right: 0 }} />
                      </TouchableOpacity>
                    </View>

                    {/* 文字間隔調整 */}
                    <View style={styles.keyboardSelectorSmall}>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => handleLetterSpacingChange(letterSpacing - 0.5)}>
                        <MaterialIcons name="format-indent-increase" size={18} color="#666" />
                        <MaterialIcons name="remove" size={12} color="#666" style={{ position: 'absolute', bottom: 0, right: 0 }} />
                      </TouchableOpacity>
                      <Text style={styles.keyboardTextSmall}>{letterSpacing.toFixed(1)}</Text>
                      <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => handleLetterSpacingChange(letterSpacing + 0.5)}>
                        <MaterialIcons name="format-indent-increase" size={18} color="#666" />
                        <MaterialIcons name="add" size={12} color="#666" style={{ position: 'absolute', bottom: 0, right: 0 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* ノートエリア全体 */}
        <View style={styles.flex1}>
                      <View style={[
              styles.noteArea,
              // ✅ テキスト編集中は音声プレイヤー分の高さをキャンバスに追加
              isEditing && { paddingBottom: 50 }
            ]}>
              {/* タイトルエリア */}
              <View style={styles.titleRow}>
                {isEditingTitle ? (
                  <TextInput
                    ref={titleInputRef}
                    style={styles.titleInput}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      markAsChanged('title_edit', { newTitle: text }); // 🎯 統一自動保存
                    }}
                    onBlur={handleTitleSave}
                    autoFocus
                    placeholder="タイトルを入力"
                    placeholderTextColor="#B0B0B0"
                  />
                ) : (
                  <TouchableOpacity style={styles.titleDisplay} onPress={() => setIsEditingTitle(true)}>
                    <Text style={styles.titleText}>{title || 'ノート'}</Text>
                    <MaterialIcons name="edit" size={16} color="#B0B0B0" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>

              {/* 本文エリア */}
              <TouchableWithoutFeedback onPress={handleContentAreaPress}>
                <View style={styles.contentArea}>
                {/* ✅ 修正: ScrollView内にTextInputを配置してスクロール対応 */}
                <ScrollView 
                  ref={scrollViewRef}
                  style={[styles.contentScrollView]}
                  contentContainerStyle={[styles.contentScrollContainer]}
                  showsVerticalScrollIndicator={true}
                  scrollIndicatorInsets={{ right: 1 }} // スクロールバーを右端に寄せる
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  onScroll={handleManualScroll}
                  scrollEventThrottle={100}
                  // 🎯 Phase 2: 音声再生中はキャンバス全体を無効化
                  pointerEvents={isTTSPlaying ? 'none' : 'auto'}
                >
                  {/* 🎤 リアルタイム文字起こし表示 */}
                  {recordingState !== 'idle' && (
                    <View style={styles.sttDisplayContainer}>
                      <View style={styles.sttHeader}>
                        <Ionicons name="mic" size={16} color="#4F8CFF" />
                        <Text style={styles.sttHeaderText}>
                          {recordingState === 'recording' ? '録音中...' : '一時停止中'}
                        </Text>
                        <Text style={styles.sttTimer}>
                          {formatRecordingTime(recordingTime)}
                        </Text>
                      </View>
                      
                      {/* 確定した文字起こし結果 */}
                      {transcribedText.length > 0 && (
                        <Text style={styles.sttFinalText}>
                          {transcribedText}
                        </Text>
                      )}
                      
                      {/* 中間結果（リアルタイム表示） */}
                      {interimText.length > 0 && (
                        <Text style={styles.sttInterimText}>
                          {interimText}
                        </Text>
                      )}
                      
                      {/* 文字起こし結果がない場合の表示 */}
                      {transcribedText.length === 0 && interimText.length === 0 && (
                        <Text style={styles.sttPlaceholder}>
                          話してください...
                        </Text>
                      )}
                    </View>
                  )}
                  
                  <TextInput
                    ref={contentInputRef}
                    style={[
                      getTextInputStyle(), // 動的スタイルを適用
                      styles.contentInput, // 基本スタイル追加
                      selectedTool === 'pen' && styles.contentInputBackground
                    ]}
                    value={content}
                    onChangeText={(text) => {
                      // 🚨 Step 3完全版: 入力ハンドラで直接分割（useEffectループを回避）
                      if (text.length > 2000) {
                        console.log('📄 入力ハンドラで2000文字超過検知:', text.length);
                        performPageSplit(text);
                      } else {
                        // 🔧 バグ修正: pages配列を即時同期（ペースト時の重複防止）
                        setPages(prev => {
                          const updatedPages = [...prev];
                          if (updatedPages[currentPageIndex]) {
                            updatedPages[currentPageIndex] = {
                              ...updatedPages[currentPageIndex],
                              content: text
                            };
                          }
                          return updatedPages;
                        });
                        setContent(text);
                        // 分割状態をリセット
                        setNeedsSplit(false);
                        setSplitPosition(0);
                      }
                      markAsChanged('text_input', { newContent: text }); // 🎯 統一自動保存
                    }}
                    placeholder="本文を入力"
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor="#B0B0B0"
                    onBlur={() => {
                      setIsEditing(false);
                      // ✅ 修正: テキスト編集終了時は音声プレイヤーを再表示しない（音声読み上げボタン専用）
                      handleContentSave();
                    }}
                    editable={selectedTool !== 'pen'} // ペンツール時は編集不可
                    onFocus={() => {
                      setIsEditing(true);
                      // ✅ 修正: テキスト編集中は音声プレイヤーを非表示
                      setIsCanvasIconsVisible(false);
                      setShowAudioPlayer(false);
                    }}
                    onSelectionChange={(event) => {
                      // ✨ 選択範囲を追跡
                      const { start, end } = event.nativeEvent.selection;
                      setTextSelection({ start, end });
                      
                      // 🎨 TTS用のテキスト選択ハンドラーを呼び出し
                      handleTextSelection(event);
                    }}
                    pointerEvents={selectedTool === 'pen' ? 'none' : 'auto'} // ペンツール時はタッチイベントを無効
                    scrollEnabled={false} // TextInputのスクロールを無効化（ScrollViewが代行）
                    // 🇯🇵 日本語入力の下線表示に最適化された設定
                    keyboardType="default"
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                    // 🎯 下線表示のために削除: textContentType, clearButtonMode
                    selectionColor="#4F8CFF"
                    // 🎯 Phase 2: レイアウト情報取得
                    onLayout={handleTextLayout}
                  />
                </ScrollView>
                

                
                {/* DrawingCanvas - 常にオーバーレイ表示、ただしペンツール時のみタッチ有効 */}
                <View style={[
                  styles.drawingCanvasOverlay,
                  selectedTool !== 'pen' && styles.drawingCanvasDisabled
                ]}>
                  <DrawingCanvas
                    key={`drawing-canvas-${currentPageIndex}-${pages[currentPageIndex]?.id || 'default'}`} // 🆕 ページごとに強制再レンダリング
                    ref={drawingCanvasRef}
                    selectedTool={selectedTool === 'pen' ? (selectedPenTool || 'pen') : null}
                    selectedColor={selectedColor}
                    strokeWidth={strokeWidth}
                    onPathsChange={handlePathsChange}
                    paths={drawingPaths}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={drawingPaths.length > 0}
                    canRedo={redoStack.length > 0}
                  />
                </View>
              </View>
              </TouchableWithoutFeedback>
            </View>

            {/* noteArea直下にアイコンを配置 */}
            {/* 🎵 Phase 4: 全ノート共通 音声プレイヤー表示（テキスト編集中は非表示） */}
            {showAudioPlayer && !isEditing ? (
              <View style={styles.audioPlayerContainer}>
                {/* 音声設定ボタン（左端） */}
                <TouchableOpacity 
                  style={styles.audioButton}
                  onPress={() => setShowVoiceSettingsModal(!showVoiceSettingsModal)}
                >
                  <Ionicons name="settings" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>設定</Text>
                </TouchableOpacity>
                
                {/* 10秒戻るボタン */}
                <TouchableOpacity style={styles.audioButton} onPress={() => handleAudioSeek(-10)}>
                  <Ionicons name="play-back" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>10秒戻る</Text>
                </TouchableOpacity>
                
                {/* 再生/一時停止ボタン */}
                <TouchableOpacity 
                  style={styles.audioButton} 
                  onPress={() => {
                    console.log('🎵🎵🎵 音声ボタンがタップされました！');
                    handleAudioPlay();
                  }}
                  disabled={isTTSLoading}
                >
                  {isTTSLoading ? (
                    <Ionicons name="hourglass" size={24} color="#999" />
                  ) : (
                    <Ionicons 
                      name={audioPlayState === 'playing' ? "pause" : "play"} 
                      size={24} 
                      color="#4F8CFF" 
                    />
                  )}
                  <Text style={styles.audioButtonText}>
                    {isTTSLoading ? '生成中...' : formatRecordingTime(Math.floor(audioCurrentTime))}
                  </Text>
                </TouchableOpacity>
                
                {/* 10秒進むボタン */}
                <TouchableOpacity style={styles.audioButton} onPress={() => handleAudioSeek(10)}>
                  <Ionicons name="play-forward" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>10秒進む</Text>
                </TouchableOpacity>
                
                {/* 再生速度ボタン（右端） */}
                <TouchableOpacity style={styles.audioButton} onPress={() => handleSpeedChange()}>
                  <Text style={styles.audioSpeedText}>{audioSpeed}x</Text>
                </TouchableOpacity>
              </View>
            ) : isCanvasIconsVisible ? (
              <View style={styles.canvasIconsBar}>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                }}>
                  <MaterialCommunityIcons name="notebook-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>罫線</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                }}>
                  <MaterialCommunityIcons name="grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>格子</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                }}>
                  <MaterialCommunityIcons name="dots-grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>ドット</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                }}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>テンプレート</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                }}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>スキャン</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* 🎤 音声設定ドロップダウンメニュー */}
            {showVoiceSettingsModal && showAudioPlayer && (
              <View style={styles.voiceSettingsDropdown}>
                <Text style={styles.voiceSettingsTitle}>音声合成エンジン</Text>
                {availableTTSProviders.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    style={[
                      styles.voiceProviderOption,
                      currentTTSProvider === provider.id && styles.selectedVoiceProvider
                    ]}
                    onPress={() => handleTTSProviderChange(provider.id)}
                  >
                    <View style={styles.providerInfo}>
                      <Text style={[
                        styles.providerName,
                        currentTTSProvider === provider.id && styles.selectedProviderText
                      ]}>
                        {provider.name}
                      </Text>
                      <Text style={styles.providerDescription}>{provider.description}</Text>
                    </View>
                    {currentTTSProvider === provider.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#4F8CFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
        </View>

        {/* 🎨 ペンツール用カラー設定ドロップダウン - キーボードツールと同じ形式 */}
        {showColorSettings && selectedPenTool !== 'eraser' && (
          <View style={styles.colorPickerMenu}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {getColorPalette().map((color, index) => (
                <TouchableOpacity
                  key={`pen-color-${index}`}
                  style={[
                    styles.colorPickerOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColorPickerOption,
                  ]}
                  onPress={() => {
                    handleColorSelect(color);
                    setShowColorSettings(false);
                  }}
                />
              ))}
          </View>
        </View>
        )}

        {/* 🖊️ ペンツール用太さ設定ドロップダウン */}
        {showStrokeSettings && selectedPenTool !== 'eraser' && (
          <View style={styles.strokePickerMenu}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 }}>
              <TouchableOpacity
                style={[
                  styles.strokeOption,
                  getCurrentStrokeType() === 'thin' && styles.selectedStrokeOption
                ]}
                onPress={() => {
                  setStrokeWidth(strokeOptions.thin.value);
                  setShowStrokeSettings(false);
                }}
              >
                <View style={[styles.strokePreview, { width: 2, height: 20, backgroundColor: selectedColor }]} />
                <Text style={styles.strokeOptionText}>細め</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.strokeOption,
                  getCurrentStrokeType() === 'medium' && styles.selectedStrokeOption
                ]}
                onPress={() => {
                  setStrokeWidth(strokeOptions.medium.value);
                  setShowStrokeSettings(false);
                }}
              >
                <View style={[styles.strokePreview, { width: 3, height: 20, backgroundColor: selectedColor }]} />
                <Text style={styles.strokeOptionText}>普通</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.strokeOption,
                  getCurrentStrokeType() === 'thick' && styles.selectedStrokeOption
                ]}
                onPress={() => {
                  setStrokeWidth(strokeOptions.thick.value);
                  setShowStrokeSettings(false);
                }}
              >
                <View style={[styles.strokePreview, { width: 5, height: 20, backgroundColor: selectedColor }]} />
                <Text style={styles.strokeOptionText}>太め</Text>
              </TouchableOpacity>
          </View>
        </View>
        )}



        {/* 🆕 ページコントロールバー - 罫線アイコンが非表示かつ音声再生メニューが非表示の時のみ表示 */}
        {!isCanvasIconsVisible && !showAudioPlayer && (
        <View style={styles.pageControlBar}>
          {totalPages > 1 && (
            <TouchableOpacity 
              style={[styles.pageControlButton, currentPageIndex === 0 && styles.pageControlButtonDisabled]}
              onPress={handlePreviousPage}
              disabled={currentPageIndex === 0}
            >
              <MaterialIcons 
                name="keyboard-arrow-up" 
                size={20} 
                color={currentPageIndex === 0 ? '#ccc' : '#4F8CFF'} 
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.pageControlButton}
            onPress={handleAddPage}
          >
            <MaterialIcons name="add" size={20} color="#4F8CFF" />
          </TouchableOpacity>
          
          {totalPages > 1 && (
            <TouchableOpacity 
              style={styles.pageControlButton}
              onPress={handleDeletePage}
            >
              <MaterialIcons name="remove" size={20} color="#FF4444" />
            </TouchableOpacity>
          )}
          
          {totalPages > 1 && (
            <TouchableOpacity 
              style={[styles.pageControlButton, currentPageIndex === totalPages - 1 && styles.pageControlButtonDisabled]}
              onPress={handleNextPage}
              disabled={currentPageIndex === totalPages - 1}
            >
              <MaterialIcons 
                name="keyboard-arrow-down" 
                size={20} 
                color={currentPageIndex === totalPages - 1 ? '#ccc' : '#4F8CFF'} 
              />
            </TouchableOpacity>
          )}
          
          {totalPages > 1 && (
            <Text style={styles.pageIndicator}>
              {currentPageIndex + 1}/{totalPages}
            </Text>
          )}
        </View>
        )}

        {/* 📊 Step 1 & 2: 文字数表示と分割検知状態 */}
        {showCharacterCount && (
          <View style={styles.characterCountDisplay}>
            <Text style={[
              styles.characterCountText,
              characterCount > 2000 && styles.characterCountOverLimit
            ]}>
              {characterCount}/2000 文字
            </Text>
            {needsSplit && (
              <Text style={styles.splitDetectionText}>
                📄 分割検知: {splitPosition}文字目
              </Text>
            )}
          </View>
        )}

        {/* AIチャットウィジェット */}
        <AIChatWidget
          canvasText={content}
          selectedText={''} // TODO: 選択されたテキストの実装
          onTextUpdate={(newText) => {
            setContent(newText);
            handleContentSave();
          }}
          autoSave={{ markChanged, performSave, flushSave, hasUnsavedChanges: autoSaveHasUnsavedChanges, isSaving: autoSaveIsSaving }}
        />

        {/* 📏 定規コンポーネント（既存機能への影響なし） */}
        <Ruler
          isVisible={rulerState.isVisible}
          x={rulerState.x}
          y={rulerState.y}
          rotation={rulerState.rotation}
          canvasWidth={400} // 固定値（後で動的に変更可能）
          canvasHeight={600} // 固定値（後で動的に変更可能）
          onMove={handleRulerMove}
          onAngleAdjust={handleRulerAngleAdjust}
        />



      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7FB',
    paddingTop: 0,
  },
  flex1: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F8CFF',
    height: 48,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  backButtonContainer: {
    width: 40,
    alignItems: 'flex-start',
  },
  backButton: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 4,
  },
  centerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center', // 中央揃え
    marginHorizontal: 0, // 外側マージンを削除して均一配置
    paddingHorizontal: 8, // 内側パディングで微調整
  },
  // 🌟 iPad専用：中央寄せで余白調整
  centerIconsTablet: {
    justifyContent: 'center', // 中央寄せ
    marginHorizontal: 0, // 外側マージンを削除
    paddingHorizontal: 0, // 内側パディングも削除
    flex: 1, // flex: 1を確保
    maxWidth: '70%', // 最大幅を制限して中央に寄せる
    alignSelf: 'center', // 自身を中央配置
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // 録音中のボタン群を中央寄せ
    marginHorizontal: 8, // グループ間の余白を適度に調整
    paddingHorizontal: 4, // 内側パディングで微調整
  },
  // 🌟 iPad専用：アイコングループの余白調整
  iconGroupTablet: {
    marginHorizontal: 20, // グループ間の余白をさらに増加
    paddingHorizontal: 12, // 内側パディングも増加
  },
  rightIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -8,
  },
  // 🌟 iPad専用：右側グループの調整
  rightIconGroupTablet: {
    marginRight: 0, // 右側の負のマージンを削除
    marginHorizontal: 12, // 統一した余白
    paddingHorizontal: 8,
  },
  topBarIcon: {
    marginHorizontal: 4, // アイコン間の余白を少し縮小して均一配置
    padding: 4,
  },
  // 🌟 iPad専用：アイコンの余白調整
  topBarIconTablet: {
    marginHorizontal: 8, // アイコン間の余白を増加
    padding: 6, // パディングも少し増加
  },
  moreButtonContainer: {
    width: 40,
    alignItems: 'flex-end',
    padding: 4,
  },
  noteArea: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleText: {
    color: '#B0B0B0',
    fontSize: 18,
    fontWeight: '500',
    marginRight: 4,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#4F8CFF',
  },
  canvasIconsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  canvasIcon: {
    alignItems: 'center',
    padding: 8,
  },
  canvasIconText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 4,
  },
  contentArea: {
    flex: 1,
  },
  // 🔥 修正: ScrollView関連のスタイルを追加
  contentScrollView: {
    flex: 1,
    paddingRight: 8, // 右側にパディングを追加してスクロールバーの見やすさを向上
  },
  contentScrollContainer: {
    flexGrow: 1,
    paddingBottom: 50, // 下部にパディングを追加
  },
  contentInput: {
    minHeight: 200, // 最小の高さを設定
    // fontSize: 16, ← ✨ 削除！getTextInputStyle()のfontSizeを優先
    color: '#333',
    padding: 8,
    margin: 0,
    textAlignVertical: 'top',
  },

  aiWidget: {
    position: 'absolute',
    bottom: 220, // 位置をさらに上に移動 (180 → 220)
    right: 20,
    width: 52, // サイズを小さく (64 → 52)
    height: 52, // サイズを小さく (64 → 52)
    zIndex: 10,
    opacity: 1,
  },
  aiWidgetBubble: {
    backgroundColor: '#24a5cf',
    borderRadius: 26, // borderRadiusも調整 (32 → 26)
    width: 52, // サイズを小さく (64 → 52)
    height: 52, // サイズを小さく (64 → 52)
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B0D0FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  aiTail: {
    position: 'absolute',
    right: -6,
    bottom: 14,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderLeftWidth: 10,
    borderLeftColor: '#24a5cf',
  },
  aiStarIcon: {
    position: 'absolute',
    top: -32, // 位置を調整 (-38 → -32)
    left: '50%',
    marginLeft: -8, // 中央配置調整 (-10 → -8)
    width: 36, // サイズを小さく (45 → 36)
    height: 36, // サイズを小さく (45 → 36)
    zIndex: 20,
  },
  selectedToolIcon: {
    backgroundColor: '#F8FAFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#B8D4FF',
    shadowColor: '#4F8CFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  subToolbar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    width: '100%',
  },
  // 🌟 iPad専用：サブツールバー中央寄せ
  subToolbarTablet: {
    alignItems: 'center', // 中央寄せ
  },
  subToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    width: '100%',
  },
  // 🌟 iPad専用：サブツールバーコンテンツ幅制限
  subToolbarContentTablet: {
    width: 'auto', // 自動幅
    maxWidth: '70%', // 最大幅70%
    justifyContent: 'center', // 中央寄せ
    alignItems: 'center', // 垂直方向も中央寄せ
    alignSelf: 'center', // 自身を中央に配置
  },
  subToolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  // 🌟 iPad専用：サブツールグループ中央寄せ
  subToolGroupTablet: {
    flex: 0, // flexを無効化
    justifyContent: 'center', // 中央寄せ
    alignItems: 'center',
  },
  colorSettingsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  subToolIcon: {
    padding: 10,
    marginHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#F6F7FB',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSubToolIcon: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#4F8CFF',
  },
  thicknessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  thicknessIconContainer: {
    padding: 6,
    marginHorizontal: 1,
    borderRadius: 6,
    backgroundColor: '#F6F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  thicknessOption: {
    backgroundColor: '#333',
    borderRadius: 1,
  },
  thicknessThin: {
    width: 18,
    height: 1,
  },
  thicknessMedium: {
    width: 18,
    height: 3,
  },
  thicknessThick: {
    width: 18,
    height: 5,
  },
  colorPalette: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  colorOption: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#00C851',
    borderWidth: 3,
  },
  customColorOption: {
    backgroundColor: '#F6F7FB',
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subToolbarLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  textTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    minWidth: 55,
    marginHorizontal: 2,
  },
  textTypeSelectorText: {
    color: '#333',
    fontSize: 12,
    marginRight: 2,
  },
  fontSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    minWidth: 70,
    marginHorizontal: 2,
  },
  fontSelectorText: {
    color: '#333',
    fontSize: 12,
    marginRight: 2,
  },
  fontSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  fontSizeButton: {
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    marginHorizontal: 1,
  },
  fontSizeText: {
    color: '#333',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  textColorIndicator: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  colorCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
  },
  boldButton: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  boldButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  boldButtonText: {
    color: '#333',
    fontSize: 16,
  },
  boldButtonTextActive: {
    fontWeight: 'bold',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
  },
  dropdownItem: {
    padding: 8,
  },
  selectedDropdownItem: {
    backgroundColor: '#E3F2FD',
  },
  dropdownItemText: {
    color: '#333',
    fontSize: 16,
  },
  colorPickerMenu: {
    position: 'absolute',
    top: 96,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  colorPickerOption: {
    width: 20,
    height: 20,
    borderRadius: 10,
    margin: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorPickerOption: {
    borderColor: '#4F8CFF',
    borderWidth: 3,
  },
  scrollableSubToolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingRight: 32,
    flexGrow: 1,
    minWidth: '100%',
  },
  keyboardSubToolIcon: {
    padding: 4,
    marginHorizontal: 1,
    borderRadius: 8,
    backgroundColor: '#F6F7FB',
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  keyboardSubToolIconSmall: {
    padding: 6,
    marginHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#F6F7FB',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  keyboardSelectorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    minWidth: 44,
    marginHorizontal: 6,
    backgroundColor: '#F6F7FB',
  },
  keyboardTextSmall: {
    color: '#333',
    fontSize: 12,
    marginRight: 2,
  },
  keyboardIconSmall: {
    fontSize: 16,
  },
  voiceToolIcon: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  recordingTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  recordingTimeText: {
    color: '#333',
    fontSize: 14,
  },
  recordingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  recordingStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  recordingStatusDotActive: {
    backgroundColor: '#FF4444',
  },
  recordingStatusText: {
    color: '#333',
    fontSize: 12,
  },
  voiceRecordingArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // 中央寄せ追加
  },
  recordingTimeDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 4,
  },
  recordingTimeTopBarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  centerIconsRecording: {
    justifyContent: 'center', // 中央寄せに変更
    marginHorizontal: 0,
    marginLeft: 0, // 負のマージンを削除
    paddingLeft: 0,
  },
  disabledSubToolIcon: {
    opacity: 0.5,
  },
  selectedThickness: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#4F8CFF',
  },
  drawingCanvasOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawingCanvasDisabled: {
    pointerEvents: 'none', // タッチイベントを無効化
    opacity: 1, // 描画データは見えるように保持
  },
  contentInputBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  detailSettingsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  detailToolIcon: {
    padding: 10,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#F6F7FB',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDetailToolIcon: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#4F8CFF',
  },
  thicknessContainerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  thicknessIconContainerDetail: {
    padding: 6,
    marginHorizontal: 1,
    borderRadius: 6,
    backgroundColor: '#F6F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  thicknessOptionDetail: {
    backgroundColor: '#333',
    borderRadius: 1,
  },
  colorPaletteDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  colorOptionDetail: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOptionDetail: {
    borderColor: '#00C851',
    borderWidth: 3,
  },
  customColorOptionDetail: {
    backgroundColor: '#F6F7FB',
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScrollView: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  compactUndoRedoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderRadius: 8,
    padding: 2,
    marginHorizontal: 2,
    minWidth: 60,
    minHeight: 36,
  },
  compactUndoRedoIcon: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  strokeSettingsMenu: {
    position: 'absolute',
    top: 96,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsPanelTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  strokeOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    minWidth: 300,
  },
  strokeOption: {
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 50,
  },
  selectedStrokeOption: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4F8CFF',
    borderWidth: 2,
  },
  strokeVisualContainer: {
    width: 50,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  strokeSettingsVisual: {
    width: 40,
    borderRadius: 2,
  },
  strokeSettingsLabel: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedStrokeSettingsLabel: {
    color: '#4F8CFF',
    fontWeight: 'bold',
  },
  strokeSettingsOption: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 60,
  },
  selectedStrokeSettingsOption: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4F8CFF',
  },
  strokeSettingsVisualContainer: {
    width: 50,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  strokePickerMenu: {
    position: 'absolute',
    top: 96,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  strokeOptionText: {
    color: '#333',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  strokePreview: {
    borderRadius: 2,
    marginBottom: 2,
  },
  photoScanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  photoContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
    maxWidth: '90%',
    alignItems: 'center',
  },
  photoDisplay: {
    width: 300,
    height: 400,
    borderRadius: 8,
  },
  photoNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  photoNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F6F7FB',
  },
  photoNavButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  photoPageIndicator: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 20,
  },
  convertToTextButton: {
    backgroundColor: '#4F8CFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertToTextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 20, // 左右マージンを増やして幅を縮小
    marginVertical: 8,
    marginBottom: 30, // 下部マージンをさらに増やす
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  audioButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F6F7FB',
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  audioButtonText: {
    color: '#4F8CFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  audioTimeContainer: {
    backgroundColor: '#F6F7FB',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginHorizontal: 8,
  },
  audioTimeText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
  },
  audioSpeedText: {
    color: '#4F8CFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // 🔍 検索バー用スタイル
  searchBar: {
    backgroundColor: '#F6F7FB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  searchResultsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchResultsText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
    minWidth: 40,
    textAlign: 'center',
  },
  searchNavButton: {
    padding: 4,
    marginHorizontal: 2,
  },
  searchCloseButton: {
    padding: 4,
    marginLeft: 8,
  },

  // 🎤 音声設定ドロップダウン関連のスタイル
  voiceSettingsDropdown: {
    position: 'absolute',
    top: 96,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  voiceSettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  voiceProviderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  selectedVoiceProvider: {
    borderColor: '#4F8CFF',
    backgroundColor: '#F0F4FF',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  selectedProviderText: {
    color: '#4F8CFF',
  },
  providerDescription: {
    fontSize: 12,
    color: '#666',
  },

  // 🆕 ページコントロールバーのスタイル
  pageControlBar: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 60,
  },
  pageControlButton: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 15,
    backgroundColor: '#F6F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    minHeight: 30,
  },
  pageControlButtonDisabled: {
    backgroundColor: '#F0F0F0',
    opacity: 0.5,
  },
  pageIndicator: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
    minWidth: 30,
    textAlign: 'center',
  },

  // 📊 Step 1: 文字数表示用スタイル（開発環境のみ）
  characterCountDisplay: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 999,
  },
  characterCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  characterCountOverLimit: {
    color: '#FF4444',
  },
  splitDetectionText: {
    color: '#FFA500',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // 🎤 リアルタイム文字起こし表示スタイル
  sttDisplayContainer: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E3F2FD',
    shadowColor: '#4F8CFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sttHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E3F2FD',
  },
  sttHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F8CFF',
    marginLeft: 6,
    flex: 1,
  },
  sttTimer: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sttFinalText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 4,
    fontWeight: '500',
  },
  sttInterimText: {
    fontSize: 16,
    color: '#888',
    lineHeight: 22,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  sttPlaceholder: {
    fontSize: 14,
    color: '#B0B0B0',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },



});

export default CanvasEditor; 