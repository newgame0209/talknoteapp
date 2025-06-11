import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, SafeAreaView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useDatabaseStore } from '../store/databaseStore';
import { notebooksApi, pagesApi } from '../services/api';
import DrawingCanvas, { DrawingPath } from '../components/DrawingCanvas';
import AIChatWidget from '../components/AIChatWidget';
import Ruler from '../components/Ruler'; // 📏 定規コンポーネントをインポート
import database, { 
  Recording, 
  ManualNote,
  PhotoScan,
  BookmarkData, // 🆕 BookmarkData型を追加
  saveBookmark,  // 🆕 しおり保存関数を追加
  getBookmark,   // 🆕 しおり取得関数を追加
  getLastBookmarkPage, // 🆕 最後のしおりページ取得関数を追加
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

  // 描画関連の状態管理
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[]>([]); // 削除されたパスを保存
  const [strokeWidth, setStrokeWidth] = useState<number>(2); // デフォルト線の太さ（細め）

  // 🚨 保存競合防止用フラグ
  const [isSaving, setIsSaving] = useState(false);

  // ✨ シンプルな自動保存タイマー（5秒間隔）
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 🆕 ノートタイプ判定関数（早期定義）
  const determineNoteType = (): NoteType => {
    console.log('🔍🔍🔍 CRITICAL noteType判定:', {
      noteId,
      actualNoteId,
      newNoteId,
      recordingState,
      routeParamsNoteId: route.params?.noteId,
      includesPhotoScan: noteId?.includes('photo_scan'),
      startsWithPhotoScan: noteId?.startsWith('photo_scan_'),
      includesImport: noteId?.includes('import'),
      判定結果: recordingState !== 'idle' ? 'recording' :
                noteId?.includes('photo_scan') || noteId?.startsWith('photo_scan_') ? 'photo_scan' :
                noteId?.includes('import') ? 'import' : 'manual'
    });
    
    // 🚨 写真スキャンノートの判定を最優先に
    if (noteId?.includes('photo_scan') || noteId?.startsWith('photo_scan_')) {
      console.log('✅ 写真スキャンノートとして判定');
      return 'photo_scan';
    }
    if (recordingState !== 'idle') {
      console.log('✅ 録音ノートとして判定');
      return 'recording';
    }
    if (noteId?.includes('import')) {
      console.log('✅ インポートノートとして判定');
      return 'import';
    }
    console.log('✅ 手動ノートとして判定');
    return 'manual';
  };

  // 🎯 新しい統一自動保存Hook
  const autoSave = useAutoSave({
    noteId: actualNoteId || newNoteId || noteId || '',
    noteType: determineNoteType(),
    getCurrentCanvasData: () => ({
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
    }),
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
            
            console.log('📝 タイトル重複チェック完了:', { baseTitle, finalTitle, existingCount: counter - 1 });
          } catch (titleCheckError) {
            console.log('⚠️ タイトル重複チェックでエラー（デフォルトタイトル使用）:', titleCheckError);
            finalTitle = baseTitle;
      }
          
          setTitle(finalTitle);

          // ローカルのダミーノートを作成（録音用のsaveRecording関数を利用）
          // ここでキャンバス用のローカルノートを確実に保存
          const savedNoteId = await saveRecording(
            finalTitle,
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
                      
                      // ツール設定復元
                      if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                      if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
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
        const note = await getNoteById(noteId);
        
        // 🆕 Step2.1: 通常ノート（manual）専用処理を追加
        if (noteId === 'new' || note?.file_path === 'manual') {
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
                    
                    // 🔥 通常ノートのキャンバス設定復元
                    if (canvasData.canvasSettings) {
                      const settings = canvasData.canvasSettings;
                      console.log('✅ 通常ノート - キャンバス設定復元開始:', settings);
                      
                      // ツール設定復元
                      if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                      if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
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
                    
                    // ツール設定復元
                    if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                    if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
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
                // キャンバスデータ構造の録音結果
                setContent(transcriptionData.content || '');
                if (transcriptionData.drawingPaths && Array.isArray(transcriptionData.drawingPaths)) {
                  setDrawingPaths(transcriptionData.drawingPaths);
                  console.log('✅ 録音データのキャンバス復元完了:', { pathsCount: transcriptionData.drawingPaths.length });
                }
                
                // ✨ 録音ノートでもキャンバス設定を復元
                if (transcriptionData.canvasSettings) {
                  const settings = transcriptionData.canvasSettings;
                  console.log('🔍🔍🔍 録音設定データ詳細:', settings);
                  
                  // ツール設定復元
                  if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                  if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
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
                
                // ✨ キャンバス設定の復元
                console.log('🔍🔍🔍 canvasData.canvasSettings確認:', canvasData.canvasSettings);
                
                if (canvasData.canvasSettings) {
                  const settings = canvasData.canvasSettings;
                  console.log('🔍🔍🔍 設定データ詳細:', settings);
                  
                  // ツール設定復元
                  if (settings.selectedTool) setSelectedTool(settings.selectedTool);
                  if (settings.selectedPenTool) setSelectedPenTool(settings.selectedPenTool);
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
      // 📌 ノート読み込み完了後にしおり状態をロード
      if (noteId && noteId !== 'new') {
        await loadBookmarkState(noteId);
      }
    };
    
    initializeNote();
  }, [noteId, isNewNote, getNoteById, navigation]);

  // 💾 ダッシュボード戻り時の最終保存
  const handleGoBack = async () => {
    console.log('🔙 戻る動作検出: スワイプジェスチャーまたは戻るボタン');
    console.log('🔄 戻る前の状態:', { 
      contentLength: content.length, 
      pathsCount: drawingPaths.length,
      hasUnsavedChanges,
      title
    });
    
    try {
      // 最終保存を実行
      await performAutoSave();
      console.log('✅ 戻る動作時の自動保存完了');
    } catch (error) {
      console.log('⚠️ 最終保存でエラーが発生しましたが、ダッシュボードに戻ります:', error);
    }
    
    // ダッシュボードに戻る
    navigation.goBack();
  };

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

  // 📌 しおり機能ハンドラ
  const handleBookmarkAction = async () => {
    try {
      const newBookmarkState = !bookmarkData.hasBookmarks;
      const noteIdToSave = actualNoteId || newNoteId || noteId;
      const currentNoteType = determineNoteType();
      
      // SQLiteにしおりを保存
      await saveBookmark(noteIdToSave, currentNoteType, bookmarkData.currentPage);
      
      // しおり状態を更新
      setBookmarkData(prev => ({
        ...prev,
        hasBookmarks: newBookmarkState,
        lastBookmarkPage: prev.currentPage,
        bookmarkPages: newBookmarkState 
          ? [...prev.bookmarkPages.filter(p => p !== prev.currentPage), prev.currentPage]
          : prev.bookmarkPages.filter(p => p !== prev.currentPage)
      }));
      
      console.log(`📌 しおり${newBookmarkState ? '追加' : '削除'}: ${noteIdToSave} ページ${bookmarkData.currentPage}`);
      
      markAsChanged('bookmark_add', { 
        action: 'bookmark_toggled', 
        hasBookmarks: newBookmarkState,
        currentPage: bookmarkData.currentPage,
        noteId: noteIdToSave 
      }); // 🎯 統一自動保存
      
    } catch (error) {
      console.log('⚠️ しおり保存エラー:', error);
    }
  };

  // 📌 しおり状態をロード（SQLiteから）
  const loadBookmarkState = async (noteId: string) => {
    try {
      if (!noteId) return;
      
      // SQLiteからしおり状態を取得
      const bookmark = await getBookmark(noteId, bookmarkData.currentPage);
      const lastPage = await getLastBookmarkPage(noteId);
      
      setBookmarkData(prev => ({
        ...prev,
        hasBookmarks: !!bookmark,
        lastBookmarkPage: lastPage || 1,
        bookmarkPages: bookmark ? [bookmark.page_number] : [],
        currentPage: 1 // 現在は1ページ固定（将来拡張用）
      }));
      
      console.log('📌 しおり状態ロード:', noteId, bookmark ? 'あり' : 'なし');
      
    } catch (error) {
      console.log('⚠️ しおり状態ロードエラー:', error);
    }
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
    
    // ✅ 追加修正: ツールバータッチで罫線アイコン非表示 → 音声プレイヤー表示
    setIsCanvasIconsVisible(false);
    setShowAudioPlayer(true);
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
    // ✅ 追加修正: ツールバータッチで罫線アイコン非表示 → 音声プレイヤー表示
    setIsCanvasIconsVisible(false);
    setShowAudioPlayer(true);
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
    setSelectedTool(selectedTool === 'voice' ? null : 'voice');
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    // ✅ 追加修正: ツールバータッチで罫線アイコン非表示 → 音声プレイヤー表示
    setIsCanvasIconsVisible(false);
    setShowAudioPlayer(true);
    markAsChanged(); // 🔥 追加: 音声ツール選択時に変更フラグを立てる
  };

  // キャンバスアイコンタップ時のハンドラ（アイコン非表示）
  const handleCanvasIconPress = () => {
    setIsCanvasIconsVisible(false);
  };

  // 本文エリアをタップした時のハンドラ（テキスト編集開始）
  const handleContentAreaPress = () => {
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
  const handleStartRecording = () => {
    setRecordingState('recording');
    setRecordingTime(0);
    markAsChanged(); // 🔥 追加: 録音開始時に変更フラグを立てる
    
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
    markAsChanged(); // 🔥 追加: 録音停止時に変更フラグを立てる
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // 録音一時停止ハンドラー
  const handlePauseRecording = () => {
    if (recordingState === 'recording') {
      setRecordingState('paused');
      markAsChanged(); // 🔥 追加: 録音一時停止時に変更フラグを立てる
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } else if (recordingState === 'paused') {
      setRecordingState('recording');
      markAsChanged(); // 🔥 追加: 録音再開時に変更フラグを立てる
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
    
    // 🎯 新しい統一自動保存Hook経由
    if (toolbarFunction) {
      console.log('🚀 統一自動保存Hook実行:', toolbarFunction);
      autoSave.markChanged(toolbarFunction, data);
    } else {
      // デフォルト機能として手動保存を指定
      console.log('🚀 デフォルト保存実行: manual_save');
      autoSave.markChanged('manual_save', data);
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
            },
            lastModified: new Date().toISOString(),
            pageMetadata: getPageMetadata()
          }],
          currentPageIndex: 0,
          metadata: getNoteMetadata(),
          lastModified: new Date().toISOString()
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

  // 🔥 スワイプジェスチャーでの戻る動作を検出
  // 🚀 画面遷移時の自動保存（警告回避版）
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async () => {
      console.log('🔙 画面遷移検出（戻るボタン or スワイプ）');
      
      // 変更がある場合のみ保存処理を実行（阻止はしない）
      if (hasUnsavedChanges) {
        console.log('🔄 画面遷移時の自動保存開始...');
        try {
          // 非同期だが、可能な限り保存を試行
          performAutoSave().then(() => {
            console.log('✅ 画面遷移時の自動保存完了');
          }).catch((error) => {
            console.log('⚠️ 画面遷移時の自動保存エラー:', error);
          });
        } catch (error) {
          console.log('⚠️ 画面遷移時の自動保存エラー:', error);
        }
      } else {
        console.log('📝 未保存の変更なし - 保存スキップ');
      }
    });

    return unsubscribe;
  }, [navigation, performAutoSave, hasUnsavedChanges]);

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

  // 🎵 Phase 4: 音声プレイヤー制御
  const handleAudioPlay = () => {
    if (audioPlayState === 'playing') {
      setAudioPlayState('paused');
      console.log('⏸️ 音声一時停止');
    } else {
      setAudioPlayState('playing');
      console.log('🔊 音声再生開始');
    }
    markAsChanged('voice_record', { playState: audioPlayState }); // 🎯 統一自動保存
  };

  const handleAudioPause = () => {
    setAudioPlayState('paused');
    console.log('⏸️ 音声再生一時停止');
    markAsChanged(); // 🔥 追加: 音声停止時に変更フラグを立てる
  };

  const handleAudioSeek = (seconds: number) => {
    // シーク処理をここに実装
    console.log('Seeking to:', seconds);
    markAsChanged(); // 🔥 追加: 音声シーク時に変更フラグを立てる
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
  
  // 📌 しおり機能の状態管理（object構造に変更）
  const [bookmarkData, setBookmarkData] = useState({
    hasBookmarks: false,           // 現在：しおりの有無
    lastBookmarkPage: 1,           // 将来：最後のしおりページ
    bookmarkPages: [1],            // 将来：しおり設定済みページ一覧
    currentPage: 1                 // 将来：現在表示中のページ
  });

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
    setShowAudioPlayer(true);
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
          
          {/* 中央のアイコン群 */}
          <View style={[
            styles.centerIcons,
            (recordingState === 'recording' || recordingState === 'paused') && styles.centerIconsRecording
          ]}>
            {/* グループ1: 戻る・検索 */}
            <View style={styles.iconGroup}>
              <TouchableOpacity 
                style={[
                  styles.topBarIcon, 
                  isSearchVisible && styles.selectedToolIcon
                ]} 
                onPress={handleToolbarIconPress}
              >
                <Ionicons 
                  name="search" 
                  size={22} 
                  color={isSearchVisible ? '#4F8CFF' : '#fff'} 
                />
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
                              <TouchableOpacity 
                  style={[
                    styles.topBarIcon,
                    bookmarkData.hasBookmarks && styles.selectedToolIcon
                  ]} 
                  onPress={handleBookmarkAction}
                >
                  <MaterialIcons 
                    name={bookmarkData.hasBookmarks ? "bookmark" : "bookmark-border"} 
                    size={22} 
                    color={bookmarkData.hasBookmarks ? "#4F8CFF" : "#fff"} 
                  />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarIcon} onPress={handlePageSettings}>
                <MaterialCommunityIcons name="content-copy" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            )}
          </View>
          
          {/* 三点リーダー（右端） */}
          {(recordingState === 'idle') && (
          <TouchableOpacity style={styles.moreButtonContainer} onPress={handleMoreSettings}>
            <MaterialIcons name="more-horiz" size={24} color="#fff" />
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
                  style={[styles.contentScrollView]}
                  contentContainerStyle={[styles.contentScrollContainer]}
                  showsVerticalScrollIndicator={true}
                  scrollIndicatorInsets={{ right: 1 }} // スクロールバーを右端に寄せる
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                >
                  <TextInput
                    ref={contentInputRef}
                    style={[
                      getTextInputStyle(), // 動的スタイルを適用
                      styles.contentInput, // 基本スタイル追加
                      selectedTool === 'pen' && styles.contentInputBackground
                    ]}
                    value={content}
                    onChangeText={(text) => {
                      setContent(text);
                      markAsChanged('text_input', { newContent: text }); // 🎯 統一自動保存
                    }}
                    placeholder="本文を入力"
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor="#B0B0B0"
                    onBlur={() => {
                      setIsEditing(false);
                      // ✅ テキスト編集終了時に音声プレイヤーを再表示
                      setShowAudioPlayer(true);
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
                  />
                </ScrollView>
                

                
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
              </TouchableWithoutFeedback>
            </View>

            {/* noteArea直下にアイコンを配置 */}
            {/* 🎵 Phase 4: 全ノート共通 音声プレイヤー表示（テキスト編集中は非表示） */}
            {showAudioPlayer && !isEditing ? (
              <View style={styles.audioPlayerContainer}>
                {/* 音声設定ボタン（左端） */}
                <TouchableOpacity style={styles.audioButton}>
                  <Ionicons name="settings" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>音声設定</Text>
                </TouchableOpacity>
                
                {/* 10秒戻るボタン */}
                <TouchableOpacity style={styles.audioButton} onPress={() => handleAudioSeek(-10)}>
                  <Ionicons name="play-back" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>10秒戻る</Text>
                </TouchableOpacity>
                
                {/* 再生/一時停止ボタン */}
                <TouchableOpacity style={styles.audioButton} onPress={handleAudioPlay}>
                  <Ionicons 
                    name={audioPlayState === 'playing' ? "pause" : "play"} 
                    size={24} 
                    color="#4F8CFF" 
                  />
                  <Text style={styles.audioButtonText}>00:00</Text>
                </TouchableOpacity>
                
                {/* 10秒進むボタン */}
                <TouchableOpacity style={styles.audioButton} onPress={() => handleAudioSeek(10)}>
                  <Ionicons name="play-forward" size={20} color="#4F8CFF" />
                  <Text style={styles.audioButtonText}>10秒進む</Text>
                </TouchableOpacity>
                
                {/* 再生速度ボタン（右端） */}
                <TouchableOpacity style={styles.audioButton} onPress={() => {
                  const newSpeed = audioSpeed === 1.0 ? 1.5 : audioSpeed === 1.5 ? 2.0 : 1.0;
                  setAudioSpeed(newSpeed);
                }}>
                  <Text style={styles.audioSpeedText}>1.5x</Text>
                </TouchableOpacity>
              </View>
            ) : isCanvasIconsVisible ? (
              <View style={styles.canvasIconsBar}>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                  setShowAudioPlayer(true);
                }}>
                  <MaterialCommunityIcons name="notebook-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>罫線</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                  setShowAudioPlayer(true);
                }}>
                  <MaterialCommunityIcons name="grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>格子</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                  setShowAudioPlayer(true);
                }}>
                  <MaterialCommunityIcons name="dots-grid" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>ドット</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                  setShowAudioPlayer(true);
                }}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>テンプレート</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.canvasIcon} onPress={() => {
                  setIsCanvasIconsVisible(false);
                  setShowAudioPlayer(true);
                }}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.canvasIconText}>スキャン</Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
          autoSave={autoSave}
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


});

export default CanvasEditor; 