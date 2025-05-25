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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

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
const DUMMY_NOTES: Note[] = [
  { id: '1', title: 'しゃべるノートの使い方マニュアル', date: '2025/05/06', type: 'document' },
  { id: '2', title: '英語の授業ノート', date: '2025/05/05', type: 'document' },
];

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

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [selectedFolder, setSelectedFolder] = useState<string>('1');
  const [selectedTag, setSelectedTag] = useState<string>('1');
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0: 閉じる, 1: 開く

  // greeting message variables
  const userName = 'ユーザー'; // TODO: ユーザー名を取得
  const hours = new Date().getHours();
  const greeting = hours < 18 ? 'こんにちは' : 'こんばんは';

  useEffect(() => {}, []);

  // ノートアイテムのレンダリング
  const renderNoteItem = (item: Note) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.noteItem}
        onPress={() => navigation.navigate('CanvasEditor', { noteId: item.id })}
      >
        <View style={styles.noteItemContent}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={24}
            color="#4F46E5"
          />
          <Text style={styles.noteTitle}>{item.title}</Text>
          <Text style={styles.noteArrow}>{'>'}</Text>
        </View>
        <Text style={styles.noteDate}>{item.date}</Text>
      </TouchableOpacity>
    );
  };

  // 推薦アイテムのレンダリング
  const renderRecommendationItem = (item: Note) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.noteItem}
        onPress={() => navigation.navigate('CanvasEditor', { noteId: item.id })}
      >
        <View style={styles.noteItemContent}>
          <View style={styles.aiIconContainer}>
            <Image
              source={require('../../assets/ai_recommendation.png')}
              style={styles.aiRecommendationIcon}
            />
          </View>
          <Text style={styles.noteTitle}>{item.title}</Text>
          <Text style={styles.noteArrow}>{'>'}</Text>
        </View>
        <Text style={styles.noteDate}>{item.date}</Text>
      </TouchableOpacity>
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
    setIsCreateMenuVisible(false);
    navigation.navigate('RecordScreen');
  };

  // インポート画面へ遷移
  const navigateToImport = () => {
    setIsCreateMenuVisible(false);
    navigation.navigate('FileImportSheet');
  };

  // スキャン画面へ遷移（未実装）
  const navigateToScan = () => {
    setIsCreateMenuVisible(false);
    // 未実装
    console.log('Scan feature not implemented yet');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 学習応援メッセージ */}
      <View style={styles.encouragementContainer}>
        <Text style={styles.encouragementText}>
          {`${greeting} ${userName}さん\n昨日より5分多く学習しました！\n今日も1日頑張りましょう👍`}
        </Text>
      </View>

      {/* フィルターエリア */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
        </ScrollView>
        
        <View style={styles.searchContainer}>
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
      </View>

      {/* 新規ノート作成ボタン */}
      <TouchableOpacity style={styles.createNoteButton} onPress={() => navigation.navigate('CanvasEditor')}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.createNoteText}>新しいノート</Text>
      </TouchableOpacity>

      <ScrollView style={styles.contentContainer}>
        {/* 最近のノート */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>最近のノート</Text>
          {DUMMY_NOTES.map((note) => renderNoteItem(note))}
        </View>

        {/* AIからのおすすめ学習 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>AIからのおすすめ学習</Text>
          {DUMMY_RECOMMENDATIONS.map((note) => renderRecommendationItem(note))}
        </View>
      </ScrollView>

      {/* 下部タブバー */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="mic" size={32} color="#589ff4" />
          <Text style={styles.tabText}>AI音声入力</Text>
        </TouchableOpacity>

        {/* 作成ボタン */}
        <TouchableOpacity style={styles.createButton} onPress={toggleCreateMenu}>
          <Ionicons name="add" size={36} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
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
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] }) },
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
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] }) },
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  filterItemSelected: {
    backgroundColor: '#589ff4', // カラーコード変更
    borderColor: '#589ff4', // カラーコード変更
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  createNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#589ff4', // カラーコード変更
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  createNoteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
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
    justifyContent: 'flex-end',
  },
  createMenuContainer: {
    alignItems: 'center',
    paddingBottom: 24,
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
    bottom: 90,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    display: 'none',
  },
  folderButton: {
    display: 'none',
  },
});

export default DashboardScreen;
