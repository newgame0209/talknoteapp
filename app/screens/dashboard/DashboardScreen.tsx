import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Animated,
  Easing,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { getRecordings, Recording, initDatabase, deleteNote, updateNoteTitle, getAllNotes } from '../../services/database';
import api from '../../services/api';

// 仮のデータ型定義
interface Note {
  id: string;
  title: string;
  date: string;
  type: 'document' | 'audio' | 'image';
}

interface Tag {
  id: string;
  name: string;
}

interface Folder {
  id: string;
  name: string;
}

// 仮のデータ
const DUMMY_NOTES: Note[] = [];

const DUMMY_RECOMMENDATIONS: Note[] = [
  { id: '3', title: '復習の候補1', date: '2025/05/06', type: 'document' },
  { id: '4', title: '復習の候補2', date: '2025/05/06', type: 'document' },
];

const DUMMY_FOLDERS: Folder[] = [
  { id: '1', name: 'すべて' },
  { id: '2', name: '授業' },
  { id: '3', name: '自習' },
];

const DUMMY_TAGS: Tag[] = [
  { id: '1', name: 'すべて' },
  { id: '2', name: '英語' },
  { id: '3', name: '数学' },
  { id: '4', name: '理科' },
];

// サポートするファイル形式
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'image/jpeg', 'image/png'
];

// 最大ファイルサイズ (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 選択されたファイルの型
export interface SelectedFile {
  name: string;
  uri: string;
  type: string;
  size: number;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [selectedFolder, setSelectedFolder] = useState<string>('1');
  const [selectedTag, setSelectedTag] = useState<string>('1');
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0: 閉じる, 1: 開く
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 新しいステート：削除・編集機能用
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  const [isRenameDialogVisible, setIsRenameDialogVisible] = useState(false);
  const [isMoveDialogVisible, setIsMoveDialogVisible] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [currentEditingNote, setCurrentEditingNote] = useState<Note | null>(null);

  // greeting message variables
  const userName = 'ユーザー'; // TODO: ユーザー名を取得
  const hours = new Date().getHours();
  const greeting = hours < 18 ? 'こんにちは' : 'こんばんは';

  // 新しいステート：プル・トゥ・リフレッシュ機能用
  const [refreshing, setRefreshing] = useState(false);

  // データベースの初期化と録音データの取得
  const loadData = async () => {
    try {
      console.log('[Dashboard] loadData 開始');
      setIsLoading(true);
      
      // データベースを初期化
      console.log('[Dashboard] データベース初期化中...');
      await initDatabase();
      console.log('[Dashboard] データベース初期化完了');
      
      // 録音データを取得
      console.log('[Dashboard] 録音データ取得中...');
      const recordingData = await getAllNotes();
      console.log('[Dashboard] 録音データ取得完了:', recordingData.length, '件');
      setRecordings(recordingData);

      console.log('[Dashboard] loadData 完了');
    } catch (error) {
      console.error('[Dashboard] loadData エラー:', error);
      Alert.alert('エラー', 'データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
      console.log('[Dashboard] isLoading = false に設定');
    }
  };

  // リアルタイムでタイトル生成状況を監視
  const startTitleGenerationMonitoring = () => {
    const intervalId = setInterval(async () => {
      try {
        const currentRecordings = await getAllNotes();
        const hasGeneratingTitle = currentRecordings.some(recording => 
          recording.title === "AIがタイトルを生成中…"
        );
        
        // 前回と異なる場合のみ更新
        const recordingsChanged = JSON.stringify(currentRecordings) !== JSON.stringify(recordings);
        if (recordingsChanged) {
          console.log('[Dashboard] タイトル生成監視: データが更新されました');
          setRecordings(currentRecordings);
        }
        
        // 生成中のタイトルがなくなったら監視を停止
        if (!hasGeneratingTitle) {
          console.log('[Dashboard] タイトル生成監視: 完了');
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('[Dashboard] タイトル生成監視エラー:', error);
        clearInterval(intervalId);
      }
    }, 1000); // 1秒ごとに監視

    return intervalId;
  };

  useEffect(() => {
    loadData();
  }, []);

  // refreshing状態の変化を監視
  useEffect(() => {
    console.log('[Dashboard] refreshing状態変化:', refreshing);
  }, [refreshing]);

  // 画面がフォーカスされたときにデータを再読み込み + タイトル生成監視開始
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const recordingData = await getAllNotes();
        setRecordings(recordingData);
        
        // タイトル生成中のノートがある場合、監視を開始
        const hasGeneratingTitle = recordingData.some(recording => 
          recording.title === "AIがタイトルを生成中…"
        );
        if (hasGeneratingTitle) {
          console.log('[Dashboard] タイトル生成監視を開始');
          startTitleGenerationMonitoring();
        }
      } catch (error) {
        console.error('データ再読み込みエラー:', error);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // キャンバスデータの表示用に処理する関数
  const parseCanvasData = (transcription?: string) => {
    if (!transcription) return { title: null, displayText: null };
    
    try {
      // JSONデータとして解析を試行
      const canvasData = JSON.parse(transcription);
      if (canvasData && typeof canvasData === 'object') {
        // ✨ 新しいキャンバスデータ構造に対応
        if (canvasData.type === 'canvas') {
          // 新しいキャンバスデータ構造の場合
          const title = canvasData.title || null;
          const content = canvasData.content || '';
          const pathsCount = canvasData.drawingPaths ? canvasData.drawingPaths.length : 0;
          
          let displayText = '';
          if (content.trim()) {
            // テキストがある場合、最初の50文字を表示
            displayText = content.trim().length > 50 
              ? content.trim().substring(0, 50) + '...' 
              : content.trim();
          }
          if (pathsCount > 0) {
            const drawingText = `手書き ${pathsCount}個`;
            displayText = displayText 
              ? `${displayText}（${drawingText}）` 
              : drawingText;
          }
          
          // テキストも手書きもない場合
          if (!displayText) {
            displayText = '空のノート';
          }
          
          return { 
            title: title,
            displayText: displayText,
            isCanvas: true,
            stats: { textLength: content.length, pathsCount }
          };
        } else {
          // 古い形式のキャンバスデータ
          const title = canvasData.title || null;
          const content = canvasData.content || '';
          const pathsCount = canvasData.drawingPaths ? canvasData.drawingPaths.length : 0;
          
          let displayText = '';
          if (content.trim()) {
            displayText = content.trim().length > 50 
              ? content.trim().substring(0, 50) + '...' 
              : content.trim();
          }
          if (pathsCount > 0) {
            displayText += displayText ? `（手書き ${pathsCount}個）` : `手書き ${pathsCount}個`;
          }
          
          return { 
            title: title,
            displayText: displayText || '空のノート',
            isCanvas: true,
            stats: { textLength: content.length, pathsCount }
          };
        }
      } else {
        // JSONだが、オブジェクトでない場合
        return { title: null, displayText: null };
      }
    } catch (parseError) {
      // JSONパースエラーの場合は通常のテキストとして扱う
      const textLength = transcription.length;
      if (textLength > 300) {
        // 長いテキストの場合は文字起こしデータの可能性
        const preview = transcription.substring(0, 50) + '...';
        return { 
          title: null, 
          displayText: `📝 ${preview}`,
          isTranscription: true,
          stats: { textLength, pathsCount: 0 }
        };
      } else {
        // 短いテキストはそのまま表示
        return { 
          title: null, 
          displayText: transcription,
          isText: true,
          stats: { textLength, pathsCount: 0 }
        };
      }
    }
  };

  // 録音データをNote形式に変換
  const convertRecordingToNote = (recording: Recording): Note => {
    // キャンバスデータの解析
    const { title: canvasTitle, displayText } = parseCanvasData(recording.transcription);
    
    // タイトルの決定（キャンバスデータのタイトル優先、次に元のタイトル）
    const finalTitle = canvasTitle || recording.title;
    
    // ファイルタイプの判定（写真スキャンデータの場合）
    let noteType: 'document' | 'audio' | 'image';
    if (recording.file_path === 'photo_scan') {
      noteType = 'image';
    } else if (recording.duration > 0) {
      noteType = 'audio';
    } else {
      noteType = 'document';
    }
    
    return {
      id: recording.id,
      title: finalTitle,
      date: new Date(recording.created_at).toLocaleDateString('ja-JP'),
      type: noteType,
    };
  };

  // FlatListのヘッダー
  const renderListHeader = () => (
    <>
      {/* 学習応援メッセージ */}
      <View style={styles.encouragementContainer}>
        <Text style={styles.encouragementText}>
          {`${greeting} ${userName}さん\n昨日より5分多く学習しました！\n今日も1日頑張りましょう👍`}
        </Text>
      </View>
      {/* フィルターエリア */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterItem, styles.filterItemSelected]}
            onPress={() => {}}
          >
            <Text style={[styles.filterText, { color: '#FFFFFF' }]}>フォルダ</Text>
            <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.filterDivider} />
          <TouchableOpacity
            style={[styles.filterItem, styles.filterItemSelected]}
            onPress={() => {}}
          >
            <Text style={[styles.filterText, { color: '#FFFFFF' }]}>AIが付けたタグ</Text>
            <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerActionContainer}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name="search" size={20} color="#6B7280" />
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity style={styles.headerActionButton}>
            <MaterialCommunityIcons name="folder-plus-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
      {/* 新規ノート作成ボタン */}
      <TouchableOpacity 
        style={[styles.createNoteButton, refreshing && styles.createNoteButtonDisabled]} 
        onPress={() => navigation.navigate('CanvasEditor', { noteId: 'new', isNewNote: true })}
        disabled={refreshing}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.createNoteText}>新しいノート</Text>
      </TouchableOpacity>
      {/* 最近のノートタイトル */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>最近のノート</Text>
      </View>
    </>
  );

  // FlatListのフッター
  const renderListFooter = () => (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>AIからのおすすめ学習</Text>
      {DUMMY_RECOMMENDATIONS.map((note) => (
        <View key={note.id} style={styles.noteItem}>
          <View style={styles.noteItemContent} pointerEvents="box-none">
            <View style={styles.aiIconContainer}>
              <Image
                source={require('../../assets/ai_recommendation.png')}
                style={styles.aiRecommendationIcon}
              />
            </View>
            <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
            <Text style={styles.noteArrow}>{'>'}</Text>
          </View>
          <Text style={styles.noteDate}>{note.date}</Text>
        </View>
      ))}
      {/* 下部余白 */}
      <View style={{ height: 120 }} />
    </View>
  );

  // ノートアイテムのレンダリング
  const renderNoteItem = (item: Note) => {
    const isSelected = selectedNotes.has(item.id);
    const isGeneratingTitle = item.title === "AIがタイトルを生成中…";

    // 改善されたスワイプジェスチャーのハンドラー
    const onSwipeGesture = (event: any) => {
      // ジェスチャーが終了した時のみ処理
      if (event.nativeEvent.state === State.END) {
        const { translationX, velocityX } = event.nativeEvent;
        
        // 左方向に70px以上スワイプ、または速度が-400以上の場合
        if (translationX < -70 || velocityX < -400) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedNotes(new Set([item.id]));
          }
        }
      }
    };

    return (
      <PanGestureHandler 
        onHandlerStateChange={onSwipeGesture}
        activeOffsetX={[-20, 20]}  // 水平方向に20px以上動いた時のみアクティブ
        failOffsetY={[-10, 10]}   // 垂直方向に10px以上動いたら失敗（スクロール優先）
        minPointers={1}
        maxPointers={1}
      >
        <Animated.View>
          <TouchableOpacity
            style={[
              styles.noteItem, 
              isSelected && styles.noteItemSelected,
              isGeneratingTitle && styles.noteItemGenerating
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (isSelectionMode) {
                toggleNoteSelection(item.id);
              } else {
                navigation.navigate('CanvasEditor', { noteId: item.id });
              }
            }}
            onLongPress={() => {
              if (!isSelectionMode) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsSelectionMode(true);
                setSelectedNotes(new Set([item.id]));
              }
            }}
            delayLongPress={600}  // 長押し検出時間を600msに延長
            disabled={refreshing}
          >
            <View style={styles.noteItemContent} pointerEvents="box-none">
              {isSelectionMode && (
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => toggleNoteSelection(item.id)}
                >
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={isSelected ? "#589ff4" : "#9CA3AF"}
                  />
                </TouchableOpacity>
              )}
              {item.type === 'audio' ? (
                <Ionicons name="mic" size={24} color="#4F46E5" />
              ) : item.type === 'image' ? (
                <Ionicons name="camera" size={24} color="#4F46E5" />
              ) : (
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={24}
                  color="#4F46E5"
                />
              )}
              <Text 
                style={[
                  styles.noteTitle, 
                  isGeneratingTitle && styles.noteTitleGenerating
                ]} 
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!isSelectionMode && <Text style={styles.noteArrow}>{'>'}</Text>}
            </View>
            <Text style={styles.noteDate}>{item.date}</Text>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  // 選択モードに入る関数
  const enterSelectionMode = (noteId?: string) => {
    setIsSelectionMode(true);
    if (noteId) {
      setSelectedNotes(new Set([noteId]));
    }
  };

  // 選択モードを終了する関数
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedNotes(new Set());
  };

  // ノートの選択切り替え関数
  const toggleNoteSelection = (noteId: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNotes(newSelected);
  };

  // 削除確認ダイアログ表示
  const showDeleteDialog = () => {
    if (selectedNotes.size === 0) return;
    setIsDeleteDialogVisible(true);
  };

  // ノート削除実行
  const executeDelete = async () => {
    try {
      setIsLoading(true);
      
      // 選択されたノートを削除
      for (const noteId of selectedNotes) {
        await deleteNote(noteId);
      }
      
      // データを再読み込み
      await loadData();
      
      // 選択モードを終了
      exitSelectionMode();
      setIsDeleteDialogVisible(false);
      
      Alert.alert('削除完了', `${selectedNotes.size}件のノートを削除しました。`);
    } catch (error) {
      console.error('削除エラー:', error);
      Alert.alert('エラー', 'ノートの削除中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // アクションモーダル表示
  const showActionModal = () => {
    if (selectedNotes.size === 0) return;
    setIsActionModalVisible(true);
  };

  // 推薦アイテムのレンダリング
  const renderRecommendationItem = (item: Note) => {
    const onSwipeGesture = (event: any) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX } = event.nativeEvent;
        if (translationX < -50) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setIsSelectionMode(true);
          setSelectedNotes(new Set([item.id]));
        }
      }
    };

    return (
      <PanGestureHandler onHandlerStateChange={onSwipeGesture}>
        <Animated.View>
          <TouchableOpacity
            style={styles.noteItem}
            activeOpacity={1}
            onPress={() => navigation.navigate('CanvasEditor', { noteId: item.id })}
          >
            <View style={styles.noteItemContent} pointerEvents="box-none">
              <View style={styles.aiIconContainer}>
                <Image
                  source={require('../../assets/ai_recommendation.png')}
                  style={styles.aiRecommendationIcon}
                />
              </View>
              <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.noteArrow}>{'>'}</Text>
            </View>
            <Text style={styles.noteDate}>{item.date}</Text>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  // フォルダ選択
  const renderFolderItem = (folder: Folder) => {
    const isSelected = folder.id === selectedFolder;
    return (
      <TouchableOpacity
        style={[styles.filterItem, isSelected && styles.filterItemSelected]}
        onPress={() => setSelectedFolder(folder.id)}
      >
        <Text
          style={[styles.filterText, isSelected && styles.filterTextSelected]}
        >
          {folder.name}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isSelected ? '#FFFFFF' : '#6B7280'}
        />
      </TouchableOpacity>
    );
  };

  // タグ選択
  const renderTagItem = (tag: Tag) => {
    const isSelected = tag.id === selectedTag;
    return (
      <TouchableOpacity
        style={[styles.filterItem, isSelected && styles.filterItemSelected]}
        onPress={() => setSelectedTag(tag.id)}
      >
        <Text
          style={[styles.filterText, isSelected && styles.filterTextSelected]}
        >
          {tag.name}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isSelected ? '#FFFFFF' : '#6B7280'}
        />
      </TouchableOpacity>
    );
  };

  // 作成メニューの表示/非表示
  const toggleCreateMenu = () => {
    setIsCreateMenuVisible(!isCreateMenuVisible);
    
    // アニメーション実行
    Animated.timing(anim, {
      toValue: menuOpen ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setMenuOpen(!menuOpen));
  };

  // 録音画面へ遷移
  const navigateToRecord = () => {
    // 閉じるときにメニュー状態をリセットしてアイコン欠落バグを防止
    setIsCreateMenuVisible(false);
    setMenuOpen(false);
    anim.setValue(0); // reset anim value
    navigation.navigate('Record');
  };

  // インポートモーダル表示
  const navigateToImport = () => {
    // 閉じるときにメニュー状態をリセットしてアイコン欠落バグを防止
    setIsCreateMenuVisible(false);
    setMenuOpen(false);
    anim.setValue(0); // reset anim value
    setIsImportModalVisible(true);
  };
  
  // ファイル選択
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_FILE_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(file.uri, { size: true });

      // ファイルサイズチェック
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
        Alert.alert(
          'ファイルサイズエラー',
          `ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。`,
          [{ text: 'OK' }]
        );
        return;
      }

      const selectedFile = {
        name: file.name,
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        size: fileInfo.exists && fileInfo.size ? fileInfo.size : 0,
      };

      setSelectedFile(selectedFile);
    } catch (error) {
      console.error('ファイル選択エラー:', error);
      Alert.alert('エラー', 'ファイルの選択中にエラーが発生しました。');
    }
  };
  
  // インポート実行
  const executeImport = async () => {
    try {
      if (selectedFile) {
        // ファイルからインポート
        console.log('📥 ファイル インポート開始:', selectedFile.name);
        
        // モーダルを閉じる
        setIsImportModalVisible(false);
        
        // FormDataを作成
        const formData = new FormData();
        formData.append('file', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type,
        } as any);
        
        // 動的にimportAPIをインポート
        const apiModule = await import('../../services/api');
        const { importApi } = apiModule;
        
        // ファイルインポート開始（2段階処理）
        const result = await importApi.importFromFile(formData, {
          auto_split: true,
          max_characters_per_page: 2000,
          generate_title: true
        });
        
        console.log('📥 ファイル インポート開始成功:', result);
        
        // 進捗画面に遷移（新しいパラメータ形式）
        navigation.navigate('ImportProgress', { 
          importId: result.import_id,
          importType: 'file', 
          source: selectedFile.name,
          file: selectedFile // 互換性のため
        });
        
      } else if (urlInput.trim()) {
        // URLからインポート
        console.log('📥 URL インポート開始:', urlInput);
        
        // URL形式の簡単な検証
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(urlInput.trim())) {
          Alert.alert('エラー', '有効なURL（http://またはhttps://で始まる）を入力してください。');
          return;
        }
        
        // モーダルを閉じる
        setIsImportModalVisible(false);
        
                 // 動的にimportAPIをインポート
         const apiModule = await import('../../services/api');
         const { importApi } = apiModule;
         
         // URLインポート開始
        const result = await importApi.importFromUrl(urlInput.trim(), {
          auto_split: true,
          max_characters_per_page: 2000,
          generate_title: true
        });
        
        console.log('📥 URL インポート開始成功:', result);
        
        // 進捗画面に遷移
        navigation.navigate('ImportProgress', { 
          importId: result.import_id,
          importType: 'url', 
          source: urlInput.trim()
        });
        
      } else {
        Alert.alert('エラー', 'ファイルまたはURLを指定してください');
        return;
      }
      
    } catch (error) {
      console.error('❌ インポートエラー:', error);
      
      // エラーメッセージを分析して適切な説明を表示
      let errorMessage = 'インポート処理でエラーが発生しました。';
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('invalid') || error.message.includes('format')) {
          errorMessage = 'ファイル形式またはURLが無効です。';
        }
      }
      
      Alert.alert('エラー', errorMessage);
    } finally {
      // リセット
      setSelectedFile(null);
      setUrlInput('');
    }
  };

  // スキャン画面へ遷移
  const navigateToScan = () => {
    // 閉じるときにメニュー状態をリセットしてアイコン欠落バグを防止
    setIsCreateMenuVisible(false);
    setMenuOpen(false);
    anim.setValue(0); // reset anim value
    // PhotoScan画面に遷移
    navigation.navigate('PhotoScan' as never);
  };

  // プル・トゥ・リフレッシュ機能の実装
  const onRefresh = async () => {
    console.log('[Dashboard] ★★★ onRefresh が呼ばれました！ ★★★');
      setRefreshing(true);
    
    try {
      // 最低表示時間を確保（1.5秒）
      const minDisplayTime = new Promise(resolve => {
        setTimeout(() => {
          console.log('[Dashboard] 最低表示時間完了');
          resolve(undefined);
        }, 1500);
      });
      
      // データ読み込み開始
      console.log('[Dashboard] データ読み込み開始');
      const dataLoadPromise = loadData();
      
      // データ読み込みとミニマム表示時間を並行実行
      await Promise.all([dataLoadPromise, minDisplayTime]);
      
      console.log('[Dashboard] ★★★ プル・トゥ・リフレッシュ完了 - データ更新済み ★★★');
    } catch (error) {
      console.error('[Dashboard] プル・トゥ・リフレッシュエラー:', error);
      Alert.alert('更新エラー', 'データの更新に失敗しました');
    } finally {
      console.log('[Dashboard] ★★★ スピナーを消します ★★★');
      setRefreshing(false);
    }
  };

  // デバッグ情報をログ出力（安全に）
  try {
    console.log('[Dashboard] FlatList render debug:', {
      recordingsLength: recordings?.length || 0,
      recordingsType: typeof recordings,
      isArray: Array.isArray(recordings),
      recordingsSample: recordings?.slice(0, 2).map(r => ({
        id: r?.id,
        title: r?.title,
        type: typeof r
      })) || [],
      shouldShowEmpty: recordings?.length === 0
    });
  } catch (debugError) {
    console.error('[Dashboard] Debug log error:', debugError);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <FlatList
        style={{ flex: 1 }}
        data={recordings.length > 0 ? recordings.map(convertRecordingToNote) : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderNoteItem(item)}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={<Text style={styles.emptyText}>まだノートがありません。新しく作成してみましょう！</Text>}
        contentContainerStyle={{ 
          paddingHorizontal: 16, 
          paddingBottom: 150,
          flexGrow: 1
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#589ff4']}
            tintColor="#589ff4"
            title="更新中..."
            titleColor="#589ff4"
            progressViewOffset={60}
          />
        }
        // パフォーマンス最適化の設定
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={20}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 88, // ノートアイテムの固定高さ
          offset: 88 * index,
          index,
        })}
        // スクロール感度の改善
        scrollEventThrottle={16}
        bounces={true}
        bouncesZoom={false}
        alwaysBounceVertical={true}
        decelerationRate="normal"
        // メモリ効率の改善
        legacyImplementation={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />
      {/* 下部タブバー */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} disabled={refreshing}>
          <Ionicons name="mic" size={32} color="#589ff4" />
          <Text style={styles.tabText}>AI音声入力</Text>
        </TouchableOpacity>

        {/* 作成ボタン */}
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={toggleCreateMenu}
          disabled={refreshing}
        >
          <Ionicons name="add" size={36} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          disabled={refreshing}
          onPress={() => navigation.navigate('Settings' as never)}
        >
          <View style={styles.notificationBadge} />
          <Ionicons name="person" size={32} color="#589ff4" />
          <Text style={styles.tabText}>設定</Text>
        </TouchableOpacity>
      </View>

      {/* 作成メニューモーダル */}
      <Modal
        transparent={true}
        visible={isCreateMenuVisible}
        animationType="fade"
        onRequestClose={() => {
          setIsCreateMenuVisible(false);
          setMenuOpen(false);
          anim.setValue(0);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setIsCreateMenuVisible(false);
            setMenuOpen(false);
            anim.setValue(0);
          }}
        >
          <View style={styles.createMenuContainer}>
            {/* 録音して文字起こし - 左上に配置 */}
            <Animated.View 
              style={[styles.actionWrapper, {
                transform: [
                  { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] }) },
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
                  { scale: anim }
                ],
                opacity: anim
              }]}
            >
              <Animated.View style={{
                opacity: anim,
                position: 'absolute',
                top: -45,
                width: 90,
                alignSelf: 'center',
              }}>
                <Text style={styles.createMenuText}>録音して{'\n'}文字起こし</Text>
              </Animated.View>
              <TouchableOpacity
                style={[styles.createMenuIcon, { borderWidth: 0 }]}
                onPress={navigateToRecord}
              >
                <Ionicons name="mic" size={30} color="#589ff4" />
              </TouchableOpacity>
            </Animated.View>

            {/* 写真をスキャン - 真上に配置 */}
            <Animated.View 
              style={[styles.actionWrapper, {
                transform: [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) },
                  { scale: anim }
                ],
                opacity: anim
              }]}
            >
              <Animated.View style={{
                opacity: anim,
                position: 'absolute',
                top: -45,
                width: 90,
                alignSelf: 'center',
              }}>
                <Text style={styles.createMenuText}>写真を{'\n'}スキャン</Text>
              </Animated.View>
              <TouchableOpacity
                style={[styles.createMenuIcon, { borderWidth: 0 }]} // 丸アイコンの外枠を削除
                onPress={navigateToScan}
              >
                <Ionicons name="camera" size={30} color="#589ff4" />
              </TouchableOpacity>
            </Animated.View>

            {/* インポート - 右上に配置 */}
            <Animated.View 
              style={[styles.actionWrapper, {
                transform: [
                  { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 100] }) },
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
                  { scale: anim }
                ],
                opacity: anim
              }]}
            >
              <Animated.View style={{
                opacity: anim,
                position: 'absolute',
                top: -45,
                width: 90,
                alignSelf: 'center',
              }}>
                <Text style={styles.createMenuText}>インポート</Text>
              </Animated.View>
              <TouchableOpacity
                style={[styles.createMenuIcon, { borderWidth: 0 }]}
                onPress={navigateToImport}
              >
                <Ionicons name="document" size={30} color="#589ff4" />
              </TouchableOpacity>
            </Animated.View>

            {/* 作成ボタン（閉じるためのUI） */}
            <TouchableOpacity
              style={[styles.createButton, styles.createButtonActive]}
              onPress={toggleCreateMenu}
            >
              <Animated.View style={{
                transform: [{
                  rotate: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg']
                  })
                }]
              }}>
                <Ionicons name="add" size={36} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* インポートモーダル */}
      <Modal
        transparent={true}
        visible={isImportModalVisible}
        animationType="fade"
        onRequestClose={() => setIsImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importModalContainer}>
            <View style={styles.importModalHeader}>
              <Text style={styles.importModalTitle}>インポート</Text>
              <TouchableOpacity 
                onPress={() => {
                  setIsImportModalVisible(false);
                  setSelectedFile(null);
                  setUrlInput('');
                }}
                style={styles.importModalCloseButton}
              >
                <Text style={styles.importModalCloseText}>キャンセル</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.importSection}>
              <Text style={styles.importSectionTitle}>URLからインポート</Text>
              <TextInput
                style={styles.urlInput}
                placeholder="https://"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.importDivider} />

            <View style={styles.importSection}>
              <Text style={styles.importSectionTitle}>ファイルからインポート</Text>
              <TouchableOpacity 
                style={styles.filePickerButton} 
                onPress={pickDocument}
              >
                {selectedFile ? (
                  <Text style={styles.selectedFileName} numberOfLines={1} ellipsizeMode="middle">
                    {selectedFile.name}
                  </Text>
                ) : (
                  <View style={styles.filePickerContent}>
                    <MaterialCommunityIcons name="file-upload-outline" size={24} color="#589ff4" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.importButton, (!selectedFile && !urlInput.trim()) && styles.importButtonDisabled]} 
              onPress={executeImport}
              disabled={!selectedFile && !urlInput.trim()}
            >
              <Text style={styles.importButtonText}>実行する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* アクションモーダル */}
      {isSelectionMode && selectedNotes.size > 0 && (
        <View style={styles.actionBarContainer}>
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // 名前変更機能（今後実装）
                Alert.alert('名前変更', '今後実装予定の機能です');
              }}
            >
              <Ionicons name="create-outline" size={20} color="#1F2937" />
              <Text style={styles.actionButtonText}>名前変更</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // 移動機能（今後実装）
                Alert.alert('移動', '今後実装予定の機能です');
              }}
            >
              <Ionicons name="folder-outline" size={20} color="#1F2937" />
              <Text style={styles.actionButtonText}>移動</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={showDeleteDialog}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>削除</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={exitSelectionMode}
          >
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 削除確認ダイアログ */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isDeleteDialogVisible}
        onRequestClose={() => setIsDeleteDialogVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>このノートを削除しますか？</Text>
            <Text style={styles.deleteDialogMessage}>
              ゴミ箱に移動されたノートは30日後に{'\n'}完全に削除されます。
            </Text>
            
            <View style={styles.checkboxContainer}>
              <TouchableOpacity style={styles.checkboxTouchable}>
                <View style={styles.checkboxSquare} />
                <Text style={styles.checkboxText}>今後表示しない</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.deleteDialogButtons}>
              <TouchableOpacity
                style={styles.deleteDialogDeleteButton}
                onPress={executeDelete}
              >
                <Text style={styles.deleteDialogDeleteText}>削除</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.deleteDialogCancelButton}
              onPress={() => {
                setIsDeleteDialogVisible(false);
                if (selectedNotes.size === 1) {
                  // スワイプ削除の場合は選択状態をクリア
                  setSelectedNotes(new Set());
                }
              }}
            >
              <Text style={styles.deleteDialogCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 150, // 下部タブバー分の余白を追加
    flexGrow: 1,
  },
  encouragementContainer: {
    backgroundColor: '#EBF5FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 60, // 少し下に移動
    marginHorizontal: 16,
    borderRadius: 8,
  },
  encouragementText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterItemSelected: {
    backgroundColor: '#589ff4',
    borderColor: '#589ff4',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  filterTextSelected: {
    color: '#FFFFFF',
  },
  filterDivider: {
    width: 8,
  },
  headerActionContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
  },
  createNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#589ff4',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,   // ボタン上部に余白
    marginBottom: 24, // ボタンと最近のノート間の余白を拡大
  },
  createNoteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  noteItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noteItemSelected: {
    backgroundColor: '#EBF4FF',
    borderColor: '#589ff4',
  },
  noteItemGenerating: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  noteItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  noteTitle: {
    flex: 1,
    fontSize: 15,
    color: '#000000', // 黒色に変更
    marginLeft: 8,
  },
  noteTitleGenerating: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  noteArrow: {
    fontSize: 16,
    color: '#000000', // 黒色に変更
  },
  noteDate: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  aiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#589ff4',
  },
  aiRecommendationIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  robotIcon: {
    display: 'none',
  },
  tabBar: {
    flexDirection: 'row',
    height: 70, // 高さを増加
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20, // iPhoneの横スクロールバーと被らないように上に移動
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabText: {
    fontSize: 12, // フォントサイズ増加
    color: '#589ff4', // カラーコード変更
    marginTop: 4,
  },
  createButton: {
    width: 70, // サイズ増加
    height: 70, // サイズ増加
    borderRadius: 35,
    backgroundColor: '#589ff4', // カラーコード変更
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonActive: {
    backgroundColor: '#4080e0', // カラーコード変更
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 40, // 設定アイコンのほぼ隣に
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  createMenuContainer: {
    alignItems: 'center',
    paddingBottom: 24,
    position: 'absolute',
    bottom: 70, // 下部タブバーの上に配置
    left: 0,
    right: 0,
  },
  createMenuItems: {
    position: 'absolute',
    bottom: 90, // 位置調整
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  createMenuItem: {
    alignItems: 'center',
  },
  createMenuIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  createMenuText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionWrapper: {
    position: 'absolute',
    bottom: 20, // さらに下部に配置
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // インポートモーダルのスタイル
  importModalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  importModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  importModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  importModalCloseButton: {
    padding: 4,
  },
  importModalCloseText: {
    fontSize: 16,
    color: '#6B7280',
  },
  importSection: {
    marginBottom: 16,
  },
  importSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  urlInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  importDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  filePickerButton: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileName: {
    fontSize: 14,
    color: '#1F2937',
  },
  importButton: {
    backgroundColor: '#589ff4',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  importButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchButton: {
    display: 'none',
  },
  folderButton: {
    display: 'none',
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  actionBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    minWidth: 60,
  },
  actionButtonText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 12,
    backgroundColor: '#589ff4',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 100, // 位置を上に移動
  },
  deleteDialog: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteDialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteDialogMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'center',
  },
  checkboxTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    marginRight: 8,
    borderRadius: 2,
  },
  checkboxText: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteDialogButtons: {
    width: '100%',
    marginBottom: 12,
  },
  deleteDialogDeleteButton: {
    padding: 14,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  deleteDialogDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteDialogCancelButton: {
    padding: 14,
    backgroundColor: 'transparent',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  deleteDialogCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#589ff4',
  },
  swipeDeleteButton: {
    width: 80,
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  createNoteButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});

export default DashboardScreen;
