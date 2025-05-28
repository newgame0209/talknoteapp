import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, SafeAreaView, Platform, TouchableWithoutFeedback } from 'react-native';
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

  // キャンバスアイコンタップ時のハンドラ（アイコン非表示）
  const handleCanvasIconPress = () => {
    setIsCanvasIconsVisible(false);
  };

  // 本文エリアをタップした時のハンドラ（アイコン表示）
  const handleContentAreaPress = () => {
    setIsCanvasIconsVisible(true);
    setIsEditing(true);
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
          <View style={styles.centerIcons}>
            {/* グループ1: 戻る・検索 */}
            <View style={styles.iconGroup}>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <Ionicons name="search" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* グループ2: ペンツール・キーボード・マイク */}
            <View style={styles.iconGroup}>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialIcons name="edit" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialCommunityIcons name="keyboard-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <Ionicons name="mic-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* グループ3: しおり・ページ設定 */}
            <View style={styles.rightIconGroup}>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialIcons name="bookmark-border" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBarIcon} onPress={handleToolbarIconPress}>
                <MaterialCommunityIcons name="content-copy" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* 三点リーダー（右端） */}
          <TouchableOpacity style={styles.moreButtonContainer} onPress={handleToolbarIconPress}>
            <MaterialIcons name="more-horiz" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

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
                    <Text style={styles.titleDate}>2025-05-04</Text>
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
  titleDate: {
    color: '#B0B0B0',
    fontSize: 16,
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
});

export default CanvasEditor; 