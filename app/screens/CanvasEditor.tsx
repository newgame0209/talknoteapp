import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, SafeAreaView, Platform, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useDatabaseStore } from '../store/databaseStore';

// 画面遷移の型定義
type RootStackParamList = {
  CanvasEditor: { noteId: string };
};

type CanvasEditorRouteProp = RouteProp<RootStackParamList, 'CanvasEditor'>;
type CanvasEditorNavigationProp = StackNavigationProp<RootStackParamList, 'CanvasEditor'>;

// ツールの種類定義
type ToolType = 'pen' | 'keyboard' | 'voice' | null;
type PenToolType = 'pen' | 'pencil' | 'eraser' | 'marker' | null;
// キーボードツール用の型定義を追加
type KeyboardToolType = 'textType' | 'font' | 'size' | 'color' | 'bold' | 'spacing' | null;
type TextType = 'heading1' | 'heading2' | 'heading3' | 'body';

const CanvasEditor: React.FC = () => {
  const route = useRoute<CanvasEditorRouteProp>();
  const navigation = useNavigation<CanvasEditorNavigationProp>();
  const { noteId } = route.params;
  const { getNoteById, updateNote } = useDatabaseStore();

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
  // テキストタイプの状態管理
  const [selectedTextType, setSelectedTextType] = useState<TextType>('body');
  // フォントタイプの状態管理
  const [selectedFont, setSelectedFont] = useState<'standard' | 'dyslexia'>('standard');
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

  // カラーパレット定義
  const getColorPalette = () => {
    if (selectedPenTool === 'marker') {
      // マーカー用カラーパレット（黄色系メイン）
      return ['#FFFF00', '#FFD700', '#FFA500', '#FF69B4'];
    } else if (selectedPenTool === 'pencil') {
      // 鉛筆用カラーパレット（黒系メイン）
      return ['#000000', '#666666', '#999999', '#333333'];
    } else {
      // ペン用カラーパレット
      return ['#FF0000', '#4F8CFF', '#000000', '#008000'];
    }
  };

  const titleInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setIsCanvasIconsVisible(true);
    const loadNote = async () => {
      try {
        const note = await getNoteById(noteId);
        if (note) {
          setTitle(note.title);
          if ('transcription' in note) {
            setContent(note.transcription || '');
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
    loadNote();
  }, [noteId, getNoteById, navigation]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる際に録音タイマーをクリア
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // タイトル編集の保存
  const handleTitleSave = async () => {
    try {
      await updateNote(noteId, title, content);
      setIsEditingTitle(false);
    } catch (error) {
      Alert.alert('エラー', 'タイトルの保存に失敗しました。');
    }
  };

  // 本文編集の保存（自動保存）
  const handleContentSave = async () => {
    try {
      await updateNote(noteId, title, content);
      // 自動保存のためアラートは表示しない
    } catch (error) {
      Alert.alert('エラー', 'ノートの保存に失敗しました。');
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
  };

  // ツールバーアイコンタップ時のハンドラ（編集解除）
  const handleToolbarIconPress = () => {
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    
    setIsEditing(false);
    setIsEditingTitle(false);
    setIsCanvasIconsVisible(false);
  };

  // ペンツール選択ハンドラ
  const handlePenToolPress = () => {
    const newSelectedTool = selectedTool === 'pen' ? null : 'pen';
    setSelectedTool(newSelectedTool);
    
    // ペンツールを解除した場合、サブツールもリセット
    if (newSelectedTool === null) {
      setSelectedPenTool(null);
    }
    
    // TextInputのフォーカスを強制的に解除
    titleInputRef.current?.blur();
    contentInputRef.current?.blur();
    setIsEditing(false);
    setIsEditingTitle(false);
    setIsCanvasIconsVisible(false);
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
  };

  // フォント選択ハンドラ
  const handleFontSelect = (font: 'standard' | 'dyslexia') => {
    setSelectedFont(font);
  };

  // テキストカラー選択ハンドラ
  const handleTextColorSelect = (color: string) => {
    setTextColor(color);
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

  // ペンツール内の選択ハンドラ
  const handlePenToolSelect = (tool: PenToolType) => {
    setSelectedPenTool(selectedPenTool === tool ? null : tool);
    
    // ツール選択時のデフォルト色設定
    if (tool === 'marker') {
      setSelectedColor('#FFFF00'); // 黄色
    } else if (tool === 'pencil') {
      setSelectedColor('#000000'); // 黒色
    } else if (tool === 'pen') {
      setSelectedColor('#000000'); // 黒色（青ではなく）
    }
  };

  // 色選択ハンドラ
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
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
  
  // 利用可能なフォント一覧
  const availableFonts = [
    { key: 'dyslexia', label: 'UDフォント' },
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

  return (
    <TouchableWithoutFeedback onPress={() => setIsCanvasIconsVisible(false)}>
      <SafeAreaView style={styles.safeArea}>
        {/* 上部バー */}
        <View style={styles.topBar}>
          {/* 戻るボタン（左端） */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
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
              <View style={styles.subToolbarContent}>
                {/* 色設定が必要なツールが選択されているかどうかで表示を切り替え */}
                {!selectedPenTool || !needsColorSettings(selectedPenTool) ? (
                  <>
                    {/* サブツール群 - 中央配置 */}
                    <View style={styles.subToolGroup}>
                      {/* 共通ツール: 戻る・進む */}
                      <TouchableOpacity style={styles.subToolIcon}>
                        <Ionicons name="arrow-undo" size={18} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.subToolIcon}>
                        <Ionicons name="arrow-redo" size={18} color="#666" />
                      </TouchableOpacity>
                      
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
                          size={18} 
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
                          size={18} 
                          color={selectedPenTool === 'pencil' ? '#4F8CFF' : '#666'} 
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
                          size={18} 
                          color={selectedPenTool === 'eraser' ? '#4F8CFF' : '#666'} 
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
                          size={18} 
                          color={selectedPenTool === 'marker' ? '#4F8CFF' : '#666'} 
                        />
                      </TouchableOpacity>
                      
                      {/* 画像挿入 */}
                      <TouchableOpacity style={styles.subToolIcon}>
                        <MaterialIcons name="image" size={18} color="#666" />
                      </TouchableOpacity>
                      
                      {/* 定規 */}
                      <TouchableOpacity style={styles.subToolIcon}>
                        <MaterialCommunityIcons name="ruler" size={18} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* 色設定が必要なツール選択時（pen, pencil, marker） */
                  <>
                    {/* 色設定ツール群 - 中央配置 */}
                    <View style={styles.colorSettingsGroup}>
                      {/* 戻るボタン */}
                      <TouchableOpacity 
                        style={styles.subToolIcon}
                        onPress={() => setSelectedPenTool(null)}
                      >
                        <Ionicons name="arrow-back" size={18} color="#666" />
                      </TouchableOpacity>
                      
                      {/* 選択されたツールアイコン */}
                      <View style={[styles.subToolIcon, styles.selectedSubToolIcon]}>
                        {selectedPenTool === 'pen' && (
                          <MaterialCommunityIcons name="pen" size={18} color="#4F8CFF" />
                        )}
                        {selectedPenTool === 'pencil' && (
                          <MaterialCommunityIcons name="lead-pencil" size={18} color="#4F8CFF" />
                        )}
                        {selectedPenTool === 'marker' && (
                          <MaterialCommunityIcons name="marker" size={18} color="#4F8CFF" />
                        )}
                      </View>
                      
                      {/* 線の太さ設定 */}
                      <View style={styles.thicknessContainer}>
                        <TouchableOpacity style={styles.thicknessIconContainer}>
                          <View style={[styles.thicknessOption, styles.thicknessThin]} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.thicknessIconContainer}>
                          <View style={[styles.thicknessOption, styles.thicknessMedium]} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.thicknessIconContainer}>
                          <View style={[styles.thicknessOption, styles.thicknessThick]} />
                        </TouchableOpacity>
                      </View>
                      
                      {/* カラーパレット（赤、青、黒、カスタム） */}
                      <View style={styles.colorPalette}>
                        {getColorPalette().slice(0, 3).map((color, index) => (
                          <TouchableOpacity
                            key={`${selectedPenTool}-${index}`}
                            style={[
                              styles.colorOption,
                              { backgroundColor: color },
                              selectedColor === color && styles.selectedColorOption,
                            ]}
                            onPress={() => handleColorSelect(color)}
                          />
                        ))}
                        {/* カスタムカラーボタン */}
                        <TouchableOpacity style={[styles.colorOption, styles.customColorOption]}>
                          <MaterialIcons name="palette" size={14} color="#666" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}
            
            {selectedTool === 'keyboard' && (
              <View style={styles.subToolbarContent}>
                <View style={styles.subToolGroup}>
                  <TouchableOpacity style={styles.keyboardSubToolIconSmall}>
                    <Ionicons name="arrow-undo" size={16} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.keyboardSubToolIconSmall}>
                    <Ionicons name="arrow-redo" size={16} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.keyboardSelectorSmall} onPress={handleTextTypeDropdownToggle}>
                    <Text style={styles.keyboardTextSmall}>{selectedTextType === 'heading1' ? '見出し1' : selectedTextType === 'heading2' ? '見出し2' : selectedTextType === 'heading3' ? '見出し3' : '本文'}</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.keyboardSelectorSmall} onPress={handleFontDropdownToggle}>
                    <Text style={styles.keyboardTextSmall}>{availableFonts.find(font => font.key === selectedFont)?.label || 'UDフォント'}</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#666" />
                  </TouchableOpacity>
                  <View style={styles.keyboardSelectorSmall}>
                    <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => setFontSize(Math.max(10, fontSize - 1))}>
                      <MaterialIcons name="remove" size={16} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.keyboardTextSmall}>{fontSize}</Text>
                    <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={() => setFontSize(Math.min(30, fontSize + 1))}>
                      <MaterialIcons name="add" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.keyboardSubToolIconSmall} onPress={handleColorPickerToggle}>
                    <View style={[styles.colorCircle, { backgroundColor: textColor, width: 16, height: 16, borderRadius: 8 }]} />
                  </TouchableOpacity>
                </View>
              </View>
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
                <TextInput
                  ref={contentInputRef}
                  style={styles.contentInput}
                  value={content}
                  onChangeText={setContent}
                  placeholder="本文を入力"
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor="#B0B0B0"
                  onBlur={handleContentSave}
                  editable={true}
                  onFocus={() => setIsEditing(true)}
                />
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

        {/* AIチャットウィジェット（右下・吹き出し型） */}
        <View style={styles.aiWidget} pointerEvents="box-none">
          <View style={styles.aiWidgetBubble}>
            {/* 星アイコンを吹き出しの上部中央に絶対配置 */}
            <Image
              source={require('../assets/ai_star.png')}
              style={styles.aiStarIcon}
              resizeMode="contain"
            />
            {/* 既存のAIアイコン */}
            <Image
              source={require('../assets/ai_recommendation.png')}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
            <View style={styles.aiTail} />
          </View>
        </View>

        {/* 文法選択ドロップダウン */}
        {showTextTypeDropdown && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedTextType === 'body' && styles.selectedDropdownItem]}
              onPress={() => {
                handleTextTypeSelect('body');
                setShowTextTypeDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemText}>本文</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedTextType === 'heading1' && styles.selectedDropdownItem]}
              onPress={() => {
                handleTextTypeSelect('heading1');
                setShowTextTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, { fontSize: 18, fontWeight: 'bold' }]}>見出し1</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedTextType === 'heading2' && styles.selectedDropdownItem]}
              onPress={() => {
                handleTextTypeSelect('heading2');
                setShowTextTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, { fontSize: 16, fontWeight: 'bold' }]}>見出し2</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dropdownItem, selectedTextType === 'heading3' && styles.selectedDropdownItem]}
              onPress={() => {
                handleTextTypeSelect('heading3');
                setShowTextTypeDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, { fontSize: 14, fontWeight: 'bold' }]}>見出し3</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* フォント選択ドロップダウン */}
        {showFontDropdown && (
          <View style={styles.dropdownMenu}>
            {availableFonts.map((font) => (
              <TouchableOpacity 
                key={font.key}
                style={[styles.dropdownItem, selectedFont === font.key && styles.selectedDropdownItem]}
                onPress={() => {
                  handleFontSelect(font.key as 'standard' | 'dyslexia');
                  setShowFontDropdown(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{font.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 文字色選択カラーピッカー - コンパクトサイズ */}
        {showColorPicker && (
          <View style={styles.colorPickerMenu}>
            {['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080'].map((color, index) => (
              <TouchableOpacity
                key={`color-${index}`}
                style={[
                  styles.colorPickerOption,
                  { backgroundColor: color },
                  textColor === color && styles.selectedColorPickerOption,
                ]}
                onPress={() => {
                  handleTextColorSelect(color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </View>
        )}

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
    paddingHorizontal: 16,
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
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F6F7FB',
    minWidth: 36,
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
    width: 16,
    height: 16,
    borderRadius: 8,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    padding: 4,
    marginHorizontal: 2,
    borderRadius: 7,
    backgroundColor: '#F6F7FB',
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  keyboardSelectorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    minWidth: 40,
    marginHorizontal: 2,
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
});

export default CanvasEditor; 