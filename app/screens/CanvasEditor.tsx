import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, SafeAreaView, Platform, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useDatabaseStore } from '../store/databaseStore';
import { notebooksApi, pagesApi } from '../services/api';
import DrawingCanvas, { DrawingPath } from '../components/DrawingCanvas';
import AIChatWidget from '../components/AIChatWidget';
import database, { 
  Recording, 
  saveRecording, 
  updateNote, 
  updateCanvasData,
  updateNoteTitle 
} from '../services/database';

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

const CanvasEditor: React.FC = () => {
  const route = useRoute<CanvasEditorRouteProp>();
  const navigation = useNavigation<CanvasEditorNavigationProp>();
  const { noteId, isNewNote } = route.params;
  const { getNoteById, updateNote, saveRecording } = useDatabaseStore();

  // ノートブック・ページ管理用の状態
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [initialTitle, setInitialTitle] = useState<string | null>(null);
  const [newNoteId, setNewNoteId] = useState<string | null>(null); // 新規作成時のノートID
  // 実際に使用するノートIDを動的に決定
  const actualNoteId = isNewNote ? newNoteId : noteId;

  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isCanvasIconsVisible, setIsCanvasIconsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
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

  // 描画関連の状態管理
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[]>([]); // 削除されたパスを保存
  const [strokeWidth, setStrokeWidth] = useState<number>(2); // デフォルト線の太さ（細め）

  // 🚨 保存競合防止用フラグ
  const [isSaving, setIsSaving] = useState(false);

  // ✨ シンプルな自動保存タイマー（5秒間隔）
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // 📝 ノートブック・ページの初期化（新規作成）
  useEffect(() => {
    const initializeNotebookAndPage = async () => {
      if (notebookId && pageId) return; // 既に初期化済み
      
      // 新規作成の場合、ローカル用のダミーノートを作成
      if (isNewNote) {
        try {
          console.log('🚀 新規ノート作成開始');
          
          // デフォルトタイトル生成（ノート2025-06-04形式）
          const today = new Date();
          const defaultTitle = `ノート${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          setTitle(defaultTitle);
          
          // ローカルのダミーノートを作成（録音用のsaveRecording関数を利用）
          // ここでキャンバス用のローカルノートを確実に保存
          const savedNoteId = await saveRecording(
            defaultTitle,
            0, // duration: 0秒（キャンバスデータ用）
            '', // filePath: 空（キャンバスデータ用）
            '' // transcription: 空のコンテンツ（キャンバス用）
          );
          
          if (savedNoteId) {
            setNewNoteId(savedNoteId);
            console.log('✅ 新規ノート作成完了 - noteId:', savedNoteId);
            console.log('🔄 ダッシュボードで表示されるノートID:', savedNoteId);
          } else {
            console.log('⚠️ ノートID取得に失敗、ローカル編集のみ継続');
          }
          
        } catch (error) {
          console.log('⚠️ ローカル新規ノート作成中にエラー:', error);
          // エラーでもローカル編集は継続
          const today = new Date();
          const defaultTitle = `ノート${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          setTitle(defaultTitle);
        }
        
        setContent(''); // 初期コンテンツは空
        return;
      }
    };
    
    if (isNewNote) {
      initializeNotebookAndPage();
    }
  }, [isNewNote, notebookId, pageId, saveRecording]);

  // 📝 既存ノート読み込み（新規作成でない場合）
  useEffect(() => {
    setIsCanvasIconsVisible(true);
    
    // 新規作成の場合はノート読み込みをスキップ
    if (isNewNote) {
      return;
    }
    
    const loadNote = async () => {
      try {
        const note = await getNoteById(noteId);
        if (note) {
          setTitle(note.title);
          
          // ✨ 改善されたキャンバスデータ復元処理
          if ('transcription' in note) {
            // 録音データからの文字起こし結果
            const transcriptionText = note.transcription || '';
            
            try {
              // 録音データもJSON構造の可能性がある
              const transcriptionData = JSON.parse(transcriptionText);
              if (transcriptionData && typeof transcriptionData === 'object' && transcriptionData.type === 'canvas') {
                // キャンバスデータ構造の録音結果
                setContent(transcriptionData.content || '');
                if (transcriptionData.drawingPaths && Array.isArray(transcriptionData.drawingPaths)) {
                  setDrawingPaths(transcriptionData.drawingPaths);
                  console.log('✅ 録音データのキャンバス復元完了:', { pathsCount: transcriptionData.drawingPaths.length });
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
            try {
              // JSONとして保存されたキャンバスデータを復元
              const canvasData = JSON.parse(note.content);
              if (canvasData && typeof canvasData === 'object' && canvasData.type === 'canvas') {
                // ✨ 新しいキャンバスデータ構造での復元
                setContent(canvasData.content || '');
                
                // 手書きデータの復元
                if (canvasData.drawingPaths && Array.isArray(canvasData.drawingPaths)) {
                  setDrawingPaths(canvasData.drawingPaths);
                  console.log('✅ 手書きデータ復元完了:', { pathsCount: canvasData.drawingPaths.length });
                }
                
                // ✨ キャンバス設定の復元
                if (canvasData.canvasSettings) {
                  const settings = canvasData.canvasSettings;
                  
                  // ツール設定復元
                  if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                  if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
                  if (settings.selectedColor) setSelectedColor(settings.selectedColor);
                  if (settings.strokeWidth) setStrokeWidth(settings.strokeWidth);
                  
                  // テキスト設定復元
                  if (settings.textSettings) {
                    const textSettings = settings.textSettings;
                    if (textSettings.fontSize) setFontSize(textSettings.fontSize);
                    if (textSettings.textColor) setTextColor(textSettings.textColor);
                    if (textSettings.selectedFont) setSelectedFont(textSettings.selectedFont);
                    if (textSettings.selectedTextType) setSelectedTextType(textSettings.selectedTextType);
                    if (typeof textSettings.isBold === 'boolean') setIsBold(textSettings.isBold);
                    if (textSettings.lineSpacing) setLineSpacing(textSettings.lineSpacing);
                    if (textSettings.letterSpacing) setLetterSpacing(textSettings.letterSpacing);
                  }
                  
                  console.log('✅ キャンバス設定復元完了:', {
                    tool: settings.selectedTool,
                    penTool: settings.selectedPenTool,
                    hasTextSettings: !!settings.textSettings
                  });
                }
              } else {
                // 古い形式または通常のテキストデータとして扱う
                setContent(note.content);
              }
            } catch (parseError) {
              // JSONパースエラーの場合は通常のテキストとして扱う
              console.log('📝 通常のテキストデータとして読み込み:', parseError);
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
    loadNote();
  }, [noteId, isNewNote, getNoteById, navigation]);

  // 💾 ダッシュボード戻り時の最終保存
  const handleGoBack = async () => {
    try {
      // 最終保存を実行
      await performAutoSave();
    } catch (error) {
      console.log('⚠️ 最終保存でエラーが発生しましたが、ダッシュボードに戻ります:', error);
    }
    
    // ダッシュボードに戻る
    navigation.goBack();
  };

  // コンポーネントのクリーンアップ
  useEffect(() => {
    // 自動保存タイマー開始
    startAutoSave();
    
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
    // キャンバスアイコンを表示するように変更
    setIsCanvasIconsVisible(true);
  };

  // キャンバス以外をタップした時のハンドラ（アイコン非表示・編集解除）
  const handleOutsidePress = () => {
    setIsCanvasIconsVisible(false);
    setIsEditing(false);
    setIsEditingTitle(false);
    
    // ✨ フォーカス解除時に変更フラグのみ
    markAsChanged();
  };

  // ツールバーアイコンタップ時のハンドラ（編集解除）
  const handleToolbarIconPress = () => {
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    
    setIsEditing(false);
    setIsEditingTitle(false);
    setIsCanvasIconsVisible(false);
    
    // ✨ ツールバーアイコンタップ時に変更フラグのみ
    markAsChanged();
  };

  // ペンツール選択ハンドラ
  const handlePenToolPress = () => {
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
  };

  // キーボードツール選択ハンドラ
  const handleKeyboardToolPress = () => {
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
    setIsCanvasIconsVisible(false);
  };

  // キーボードツール内の選択ハンドラ
  const handleKeyboardToolSelect = (tool: KeyboardToolType) => {
    setSelectedKeyboardTool(selectedKeyboardTool === tool ? null : tool);
  };

  // テキストタイプ選択ハンドラ
  const handleTextTypeSelect = (type: TextType) => {
    setSelectedTextType(type);
    markAsChanged(); // 変更フラグのみ
  };

  // フォント選択ハンドラ
  const handleFontSelect = (font: FontType) => { // 型を更新
    setSelectedFont(font);
    markAsChanged(); // 変更フラグのみ
  };

  // テキストカラー選択ハンドラ
  const handleTextColorSelect = (color: string) => {
    setTextColor(color);
    markAsChanged(); // 変更フラグのみ
  };

  // 音声ツール選択ハンドラ
  const handleVoiceToolPress = () => {
    setSelectedTool(selectedTool === 'voice' ? null : 'voice');
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    setIsCanvasIconsVisible(false);
  };

  // キャンバスアイコンタップ時のハンドラ（アイコン非表示）
  const handleCanvasIconPress = () => {
    setIsCanvasIconsVisible(false);
  };

  // 本文エリアをタップした時のハンドラ（アイコン表示）
  const handleContentAreaPress = () => {
    setIsCanvasIconsVisible(true);
    setIsEditing(true);
  };

  // ペンツール選択ハンドラ
  const handlePenToolSelect = (tool: PenToolType) => {
    setSelectedPenTool(tool);
    
    // 消しゴムが選択された場合は色と太さ設定を閉じる
    if (tool === 'eraser') {
      setShowColorSettings(false);
      setShowStrokeSettings(false);
    }
    
    markAsChanged(); // 変更フラグのみ
    
    // console.log('🎨 Pen sub-tool selected:', tool);
  };

  // 色選択ハンドラ
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    markAsChanged(); // 変更フラグのみ
  };

  // 色設定が必要なツールかどうかを判定
  const needsColorSettings = (tool: PenToolType): boolean => {
    return tool === 'pen' || tool === 'pencil' || tool === 'marker';
  };

  // 文法選択ドロップダウンの状態管理
  const [showTextTypeDropdown, setShowTextTypeDropdown] = useState<boolean>(false);
  // 文字色選択の状態管理
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // フォント選択ドロップダウンの状態管理
  const [showFontDropdown, setShowFontDropdown] = useState<boolean>(false);
  
  // 利用可能なフォント一覧（更新版）
  const availableFonts = [
    { key: 'dyslexia', label: 'UDフォント（読みやすい）' },
    { key: 'standard', label: '標準フォント' },
    { key: 'serif', label: '明朝体' },
    { key: 'gothic', label: 'ゴシック体' }
  ];

  // 文法選択ハンドラ
  const handleTextTypeDropdownToggle = () => {
    setShowTextTypeDropdown(!showTextTypeDropdown);
    setShowColorPicker(false); // 他のドロップダウンを閉じる
    setShowFontDropdown(false);
  };

  // 文字色ピッカーハンドラ
  const handleColorPickerToggle = () => {
    setShowColorPicker(!showColorPicker);
    setShowTextTypeDropdown(false); // 他のドロップダウンを閉じる
    setShowFontDropdown(false);
  };

  // フォント選択ハンドラ
  const handleFontDropdownToggle = () => {
    setShowFontDropdown(!showFontDropdown);
    setShowTextTypeDropdown(false);
    setShowColorPicker(false);
  };

  // 録音時間をフォーマットする関数（MM:SS形式）
  const formatRecordingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 録音開始ハンドラー
  const handleStartRecording = () => {
    setRecordingState('recording');
    setRecordingTime(0);
    
    // 1秒ごとに時間を更新
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        // 60秒で自動停止
        if (newTime >= 60) {
          handleStopRecording();
          return 60;
        }
        return newTime;
      });
    }, 1000);
  };

  // 録音停止ハンドラー
  const handleStopRecording = () => {
    setRecordingState('idle');
    setRecordingTime(0);
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // 録音一時停止ハンドラー
  const handlePauseRecording = () => {
    if (recordingState === 'recording') {
      setRecordingState('paused');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } else if (recordingState === 'paused') {
      setRecordingState('recording');
      // 一時停止から再開
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            handleStopRecording();
            return 60;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  // ✨ 手書きパスの変更をハンドリング
  const handlePathsChange = (newPaths: DrawingPath[]) => {
    setDrawingPaths(newPaths);
    setRedoStack([]); // 新しい手書きでRedoスタックをクリア
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
  };

  // 📏 線の太さ設定表示の切り替え
  const handleStrokeSettingsToggle = () => {
    setShowStrokeSettings(!showStrokeSettings);
    setShowColorSettings(false); // 他の設定を閉じる
  };

  // 🎨 カラー設定表示の切り替え
  const handleColorSettingsToggle = () => {
    setShowColorSettings(!showColorSettings);
    setShowStrokeSettings(false); // 他の設定を閉じる
  };

  // 📏 線の太さ選択ハンドラー
  const handleStrokeTypeSelect = (type: 'thin' | 'medium' | 'thick') => {
    setStrokeWidth(strokeOptions[type].value);
    setShowStrokeSettings(false); // 選択後に閉じる
  };

  // テキストスタイルを動的に生成する関数を追加
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

    return {
      ...baseStyle,
      ...typeStyle,
      fontFamily,
      color: textColor,
      fontWeight: isBold ? 'bold' as const : (typeStyle.fontWeight || 'normal' as const),
      lineHeight: fontSize * lineSpacing,
      letterSpacing: selectedFont === 'dyslexia' ? Math.max(letterSpacing, 0.5) : letterSpacing, // UDフォント時は最低0.5px間隔
    };
  };

  // フォントサイズ変更ハンドラ
  const handleFontSizeChange = (newSize: number) => {
    // 最小8px、最大32pxに制限
    const clampedSize = Math.max(8, Math.min(32, newSize));
    setFontSize(clampedSize);
  };

  // フォントサイズ増加ハンドラ
  const handleFontSizeIncrease = () => {
    handleFontSizeChange(fontSize + 2);
  };

  // フォントサイズ減少ハンドラ
  const handleFontSizeDecrease = () => {
    handleFontSizeChange(fontSize - 2);
  };

  // 太字トグルハンドラ
  const handleBoldToggle = () => {
    setIsBold(!isBold);
  };

  // 行間調整ハンドラ
  const handleLineSpacingChange = (spacing: number) => {
    // 0.8倍から2.0倍の範囲で制限
    const clampedSpacing = Math.max(0.8, Math.min(2.0, spacing));
    setLineSpacing(clampedSpacing);
  };

  // 文字間隔調整ハンドラ
  const handleLetterSpacingChange = (spacing: number) => {
    // -2pxから5pxの範囲で制限
    const clampedSpacing = Math.max(-2, Math.min(5, spacing));
    setLetterSpacing(clampedSpacing);
  };

  // ✨ シンプルな自動保存関数（5秒間隔）
  const performAutoSave = async () => {
    if (isSaving || !hasUnsavedChanges) return;

    try {
      setIsSaving(true);
      
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
        console.log('✅ 自動保存完了:', { pathsCount: drawingPaths.length, contentLength: content.length });
      }
    } catch (error) {
      console.log('⚠️ 自動保存エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ✨ 5秒間隔自動保存の開始
  const startAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setInterval(() => {
      performAutoSave();
    }, 5000); // 5秒間隔
  };

  // ✨ 変更フラグを立てる関数
  const markAsChanged = () => {
    setHasUnsavedChanges(true);
  };

  return (
    <TouchableWithoutFeedback onPress={() => setIsCanvasIconsVisible(false)}>
      <SafeAreaView style={styles.safeArea}>
        {/* 上部バー */}
        <View style={styles.topBar}>
          {/* 戻るボタン（左端） */}
          <TouchableOpacity onPress={handleGoBack} style={styles.backButtonContainer}>
            <View style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#4F8CFF" />
            </View>
          </TouchableOpacity>
          
          {/* 中央のアイコン群 */}
          <View style={[
            styles.centerIcons,
            (recordingState === 'recording' || recordingState === 'paused') && styles.centerIconsRecording
          ]}>
            {/* グループ1: 戻る・検索 */}
            <View style={styles.iconGroup}>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <Ionicons name="search" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* グループ2: ペンツール・キーボード・マイク */}
            <View style={styles.iconGroup}>
              <TouchableOpacity 
                style={[
                  styles.topBarIcon, 
                  selectedTool === 'pen' && styles.selectedToolIcon
                ]} 
                onPress={handlePenToolPress}
              >
                <MaterialIcons 
                  name="edit" 
                  size={22} 
                  color={selectedTool === 'pen' ? '#4F8CFF' : '#fff'} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.topBarIcon, 
                  selectedTool === 'keyboard' && styles.selectedToolIcon
                ]} 
                onPress={handleKeyboardToolPress}
              >
                <MaterialCommunityIcons 
                  name="keyboard-outline" 
                  size={22} 
                  color={selectedTool === 'keyboard' ? '#4F8CFF' : '#fff'} 
                />
              </TouchableOpacity>
              
              {/* 音声録音エリア */}
              <View style={styles.voiceRecordingArea}>
                {recordingState === 'idle' ? (
                  // 録音前：マイクアイコンのみ
                  <TouchableOpacity 
                    style={[
                      styles.topBarIcon, 
                      selectedTool === 'voice' && styles.selectedToolIcon
                    ]} 
                    onPress={() => {
                      handleVoiceToolPress();
                      handleStartRecording();
                    }}
                  >
                    <Ionicons 
                      name="mic-outline" 
                      size={22} 
                      color={selectedTool === 'voice' ? '#4F8CFF' : '#fff'} 
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
              </View>
            </View>
            
            {/* グループ3: しおり・ページ設定 */}
            {(recordingState === 'idle') && (
            <View style={styles.rightIconGroup}>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialIcons name="bookmark-border" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialCommunityIcons name="content-copy" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            )}
          </View>
          
          {/* 三点リーダー（右端） */}
          {(recordingState === 'idle') && (
          <TouchableOpacity style={styles.moreButtonContainer} onPress={handleToolbarIconPress}>
            <MaterialIcons name="more-horiz" size={24} color="#fff" />
          </TouchableOpacity>
          )}
        </View>

        {/* サブツールバー - 選択されたツールによって表示 */}
        {selectedTool && selectedTool !== 'voice' && (
          <View style={styles.subToolbar}>
            {selectedTool === 'pen' && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 8 }}
              >
                <View style={styles.subToolbarContent}>
                  {/* サブツール：戻す、進める、ペン、鉛筆、マーカー、消しゴム、太さ、色、画像、定規 */}
                  <View style={styles.subToolGroup}>
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
                    
                    {/* 画像挿入 */}
                    <TouchableOpacity style={styles.subToolIcon}>
                      <MaterialIcons name="image" size={22} color="#666" />
                    </TouchableOpacity>
                    
                    {/* 定規 */}
                    <TouchableOpacity style={styles.subToolIcon}>
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
                contentContainerStyle={{ paddingHorizontal: 8 }}
              >
                <View style={styles.subToolbarContent}>
                  <View style={styles.subToolGroup}>
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
                    
                    <TouchableOpacity style={styles.keyboardSelectorSmall} onPress={handleTextTypeDropdownToggle}>
                      <Text style={styles.keyboardTextSmall}>{selectedTextType === 'heading1' ? '見出し1' : selectedTextType === 'heading2' ? '見出し2' : selectedTextType === 'heading3' ? '見出し3' : '本文'}</Text>
                      <MaterialIcons name="keyboard-arrow-down" size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.keyboardSelectorSmall} onPress={handleFontDropdownToggle}>
                      <Text style={styles.keyboardTextSmall}>{availableFonts.find(font => font.key === selectedFont)?.label || 'UDフォント'}</Text>
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
                    <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={handleColorPickerToggle}>
                      <View style={[styles.colorCircle, { backgroundColor: textColor, width: 18, height: 18, borderRadius: 9 }]} />
                    </TouchableOpacity>
                    
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
          <View style={styles.noteArea}>
              {/* タイトルエリア */}
              <View style={styles.titleRow}>
                {isEditingTitle ? (
                  <TextInput
                    ref={titleInputRef}
                    style={styles.titleInput}
                    value={title}
                    onChangeText={setTitle}
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
              <View style={styles.contentArea}>
                {/* テキスト入力エリア - 常に表示 */}
                <TextInput
                  ref={contentInputRef}
                  style={[
                    getTextInputStyle(), // 動的スタイルを適用
                    selectedTool === 'pen' && styles.contentInputBackground
                  ]}
                  value={content}
                  onChangeText={setContent}
                  placeholder="本文を入力"
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor="#B0B0B0"
                  onBlur={handleContentSave}
                  editable={selectedTool !== 'pen'} // ペンツール時は編集不可
                  onFocus={() => setIsEditing(true)}
                  pointerEvents={selectedTool === 'pen' ? 'none' : 'auto'} // ペンツール時はタッチイベントを無効
                />
                
                {/* DrawingCanvas - 常にオーバーレイ表示、ただしペンツール時のみタッチ有効 */}
                <View style={[
                  styles.drawingCanvasOverlay,
                  selectedTool !== 'pen' && styles.drawingCanvasDisabled
                ]}>
                  <DrawingCanvas
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
            </View>

            {/* noteArea直下にアイコンを配置 */}
            {isCanvasIconsVisible && (
              <View style={styles.canvasIconsBar}>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => setIsCanvasIconsVisible(false)}>
                  <MaterialCommunityIcons name="notebook-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>罫線</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => setIsCanvasIconsVisible(false)}>
                  <MaterialCommunityIcons name="grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>格子</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => setIsCanvasIconsVisible(false)}>
                  <MaterialCommunityIcons name="dots-grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>ドット</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => setIsCanvasIconsVisible(false)}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>テンプレート</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => setIsCanvasIconsVisible(false)}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>スキャン</Text>
                </TouchableOpacity>
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

        {/* AIチャットウィジェット */}
        <AIChatWidget
          canvasText={content}
          selectedText={''} // TODO: 選択されたテキストの実装
          onTextUpdate={(newText) => {
            setContent(newText);
            handleContentSave();
          }}
        />

      </SafeAreaView>
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
    justifyContent: 'space-between',
    marginHorizontal: 8,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -8,
  },
  topBarIcon: {
    marginHorizontal: 6,
    padding: 4,
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
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
  },
  aiWidget: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    width: 64,
    height: 64,
    zIndex: 10,
    opacity: 1,
  },
  aiWidgetBubble: {
    backgroundColor: '#24a5cf',
    borderRadius: 32,
    width: 64,
    height: 64,
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
    top: -38,
    left: '50%',
    marginLeft: -10,
    width: 45,
    height: 45,
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
  subToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    width: '100%',
  },
  subToolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
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
    padding: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    minWidth: 50,
    marginHorizontal: 4,
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
    justifyContent: 'flex-start',
    marginHorizontal: 0,
    marginLeft: -8,
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
});

export default CanvasEditor; 