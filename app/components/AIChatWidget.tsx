import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Audio, AVPlaybackSource } from 'expo-av';
import withAutoSave, { WithAutoSaveProps, ToolbarFunction } from '../decorators/AutoSaveDecorator';

/**
 * AIチャットウィジェット
 * 
 * 機能：
 * - 校正：OpenAI GPT-4o（文字の崩れ・誤字・文法ミス修正）
 * - 要約：OpenAI GPT-4o（箇条書き概要）
 * - 読み仮名：Yahoo！かな漢字 API（ルビ付きテキスト）
 * - 辞書：Yahoo！辞書 API（語義検索）
 * - リサーチ：Anthropic Search API → Claude（検索＋要約）
 * - 文字変換：漢字・ひらがな・カタカナ変換
 * 
 * UI/UX:
 * - キャンバス右下に配置
 * - 拡大・縮小・閉じる状態管理
 * - 音声入力対応（実装予定）
 * - 閉じている時はアイコン表示
 */

// 画面サイズを取得
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// チャットの状態定義
type ChatState = 'closed' | 'minimized' | 'expanded';

// メッセージの型定義
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

// AI機能の型定義
type AIFunction = 'chat' | 'proofread' | 'summarize' | 'furigana' | 'dictionary' | 'research' | 'convert';

// 文字変換タイプ
type ConvertType = 'hiragana' | 'katakana' | 'kanji';

interface AIChatWidgetProps extends WithAutoSaveProps {
  // キャンバスのテキスト内容（校正・要約で使用）
  canvasText?: string;
  // 選択されたテキスト（特定の機能で使用）
  selectedText?: string;
  // テキスト更新コールバック
  onTextUpdate?: (newText: string) => void;
}

const AIChatWidget: React.FC<AIChatWidgetProps> = ({
  canvasText = '',
  selectedText = '',
  onTextUpdate,
  autoSave,
}) => {
  // 状態管理
  const [chatState, setChatState] = useState<ChatState>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFunction, setSelectedFunction] = useState<AIFunction>('chat');

  // 🔥 修正: 固定位置にするため、Animatedではなく通常のstateに変更
  const [widgetPosition, setWidgetPosition] = useState({
    right: 16,  // 画面右端から16px
    bottom: 150, // 画面下端から150px（上に移動）
  });

  // 音声録音用
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // スクロールビュー用
  const scrollViewRef = useRef<ScrollView>(null);

  // 🔥 修正: アニメーション関数を削除して、シンプルな状態変更関数に変更
  const changeState = (newState: ChatState) => {
    setChatState(newState);
  };

  // API呼び出し共通関数
  const callAIAPI = async (endpoint: string, payload: any): Promise<any> => {
    try {
      // APIのベースURLを環境変数から取得
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`AI API Error (${endpoint}):`, error);
      throw error;
    }
  };

  // 校正機能
  const handleProofread = async () => {
    if (!canvasText && !selectedText) {
      Alert.alert('注意', '校正するテキストがありません。');
      return;
    }

    // 🎯 AI処理競合防止 - AI処理開始通知
    if (autoSave) {
      autoSave.startAIProcessing('correct_grammar', 'current-note');
    }

    setIsLoading(true);
    try {
      const textToProofread = selectedText || canvasText;
      const result = await callAIAPI('/ai/proofread', { text: textToProofread });
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `📝 校正結果:\n\n${result.corrected_text}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // テキストを更新
      if (onTextUpdate) {
        onTextUpdate(result.corrected_text);
      }
    } catch (error) {
      Alert.alert('エラー', '校正処理に失敗しました。');
    } finally {
      setIsLoading(false);
      
      // 🎯 AI処理競合防止 - AI処理終了通知
      if (autoSave) {
        autoSave.endAIProcessing('correct_grammar', 'current-note');
      }
    }
  };

  // 要約機能
  const handleSummarize = async () => {
    if (!canvasText && !selectedText) {
      Alert.alert('注意', '要約するテキストがありません。');
      return;
    }

    setIsLoading(true);
    try {
      const textToSummarize = selectedText || canvasText;
      const result = await callAIAPI('/ai/summarize', { 
        text: textToSummarize, 
        max_length: 100 
      });
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `📊 要約:\n\n${result.summary}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('エラー', '要約処理に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 読み仮名機能
  const handleFurigana = async () => {
    if (!selectedText) {
      Alert.alert('注意', '読み仮名を付けるテキストを選択してください。');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callAIAPI('/ai/furigana', { text: selectedText });
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `🈯 読み仮名:\n\n${result.html}\n\n${result.plain}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('エラー', '読み仮名処理に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 辞書機能
  const handleDictionary = async (word: string) => {
    if (!word.trim()) {
      Alert.alert('注意', '調べる単語を入力してください。');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callAIAPI('/ai/dictionary', { word: word.trim() });
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `📚 辞書検索 "${word.trim()}":\n\n${result.meaning || '結果が見つかりませんでした。'}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('エラー', '辞書検索に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // リサーチ機能
  const handleResearch = async (query: string) => {
    if (!query.trim()) {
      Alert.alert('注意', '検索クエリを入力してください。');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callAIAPI('/ai/research', { query: query.trim() });
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `🔍 リサーチ結果 "${query.trim()}":\n\n${result.summary}\n\n参考資料:\n${result.sources?.map((source: any) => `• ${source.url}`).join('\n') || ''}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('エラー', 'リサーチに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 文字変換機能
  const handleConvert = async (type: ConvertType) => {
    if (!selectedText) {
      Alert.alert('注意', '変換するテキストを選択してください。');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callAIAPI('/ai/convert', { 
        text: selectedText, 
        target_type: type 
      });
      
      const typeNames = {
        hiragana: 'ひらがな',
        katakana: 'カタカナ',
        kanji: '漢字'
      };
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `🔄 ${typeNames[type]}変換:\n\n${result.converted_text}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // テキストを更新
      if (onTextUpdate) {
        onTextUpdate(result.converted_text);
      }
    } catch (error) {
      Alert.alert('エラー', '文字変換に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // チャット機能
  const handleChat = async (message: string) => {
    if (!message.trim()) return;

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    setIsLoading(true);
    try {
      const result = await callAIAPI('/ai/chat', {
        messages: [
          { role: 'user', content: message.trim() }
        ]
      });
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: result.response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      Alert.alert('エラー', 'チャットに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 音声録音開始
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'マイクへのアクセスが許可されていません。');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('録音開始エラー:', err);
      Alert.alert('エラー', '録音を開始できませんでした。');
    }
  };

  // 音声録音停止
  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // 音声ファイルをテキストに変換（音声認識API呼び出し）
        // TODO: STT APIの実装
        Alert.alert('音声録音完了', '音声認識機能は準備中です。');
      }
    } catch (error) {
      console.error('録音停止エラー:', error);
      Alert.alert('エラー', '録音の停止に失敗しました。');
    }
  };

  // メッセージ送信
  const handleSendMessage = () => {
    if (selectedFunction === 'chat') {
      handleChat(inputText);
    } else if (selectedFunction === 'dictionary') {
      handleDictionary(inputText);
    } else if (selectedFunction === 'research') {
      handleResearch(inputText);
    }
  };

  // キーボード入力処理
  const handleTextSubmit = () => {
    handleSendMessage();
  };

  // クローズドアイコンの描画
  const renderClosedIcon = () => (
    <TouchableOpacity
      style={styles.closedIcon}
      onPress={() => changeState('minimized')}
    >
      {/* 統合されたAIチャットアイコン */}
      <Image 
        source={require('../assets/aichat.png')} 
        style={styles.aiChatIcon}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );

  // 最小化状態の描画
  const renderMinimized = () => (
    <View style={styles.minimizedContainer}>
      <View style={styles.minimizedHeader}>
        <Ionicons name="sparkles" size={16} color="#4A90E2" />
        <Text style={styles.minimizedTitle}>AI</Text>
        <View style={styles.minimizedActions}>
          <TouchableOpacity onPress={() => changeState('expanded')}>
            <Ionicons name="expand" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeState('closed')}>
            <Ionicons name="close" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton} onPress={handleProofread}>
          <Text style={styles.quickActionText}>校正</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton} onPress={handleSummarize}>
          <Text style={styles.quickActionText}>要約</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton} onPress={handleFurigana}>
          <Text style={styles.quickActionText}>読み仮名</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // 拡大状態の描画
  const renderExpanded = () => (
    <View style={styles.expandedContainer}>
      {/* ヘッダー */}
      <View style={styles.expandedHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={20} color="#4A90E2" />
          <Text style={styles.expandedTitle}>AI アシスタント</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => changeState('minimized')}>
            <Ionicons name="remove" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeState('closed')}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 機能選択ボタン */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.functionSelector}>
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'chat' && styles.functionButtonActive]}
          onPress={() => setSelectedFunction('chat')}
        >
          <Ionicons name="chatbubble" size={16} color={selectedFunction === 'chat' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'chat' && styles.functionButtonTextActive]}>
            チャット
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'proofread' && styles.functionButtonActive]}
          onPress={() => { setSelectedFunction('proofread'); handleProofread(); }}
        >
          <MaterialIcons name="spellcheck" size={16} color={selectedFunction === 'proofread' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'proofread' && styles.functionButtonTextActive]}>
            校正
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'summarize' && styles.functionButtonActive]}
          onPress={() => { setSelectedFunction('summarize'); handleSummarize(); }}
        >
          <MaterialIcons name="summarize" size={16} color={selectedFunction === 'summarize' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'summarize' && styles.functionButtonTextActive]}>
            要約
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'furigana' && styles.functionButtonActive]}
          onPress={() => { setSelectedFunction('furigana'); handleFurigana(); }}
        >
          <FontAwesome name="language" size={16} color={selectedFunction === 'furigana' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'furigana' && styles.functionButtonTextActive]}>
            読み仮名
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'dictionary' && styles.functionButtonActive]}
          onPress={() => setSelectedFunction('dictionary')}
        >
          <MaterialIcons name="menu-book" size={16} color={selectedFunction === 'dictionary' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'dictionary' && styles.functionButtonTextActive]}>
            辞書
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'research' && styles.functionButtonActive]}
          onPress={() => setSelectedFunction('research')}
        >
          <Ionicons name="search" size={16} color={selectedFunction === 'research' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'research' && styles.functionButtonTextActive]}>
            リサーチ
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.functionButton, selectedFunction === 'convert' && styles.functionButtonActive]}
          onPress={() => setSelectedFunction('convert')}
        >
          <MaterialIcons name="transform" size={16} color={selectedFunction === 'convert' ? '#fff' : '#4A90E2'} />
          <Text style={[styles.functionButtonText, selectedFunction === 'convert' && styles.functionButtonTextActive]}>
            変換
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 文字変換のサブメニュー */}
      {selectedFunction === 'convert' && (
        <View style={styles.convertOptions}>
          <TouchableOpacity 
            style={styles.convertButton}
            onPress={() => handleConvert('hiragana')}
          >
            <Text style={styles.convertButtonText}>ひらがな</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.convertButton}
            onPress={() => handleConvert('katakana')}
          >
            <Text style={styles.convertButtonText}>カタカナ</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.convertButton}
            onPress={() => handleConvert('kanji')}
          >
            <Text style={styles.convertButtonText}>漢字</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* メッセージエリア */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageContainer,
              message.type === 'user' ? styles.userMessage : styles.aiMessage,
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' ? styles.userMessageText : styles.aiMessageText,
            ]}>
              {message.content}
            </Text>
            <Text style={styles.messageTime}>
              {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
        
        {isLoading && (
          <View style={[styles.messageContainer, styles.aiMessage]}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.loadingText}>処理中...</Text>
          </View>
        )}
      </ScrollView>

      {/* 入力エリア */}
      {(selectedFunction === 'chat' || selectedFunction === 'dictionary' || selectedFunction === 'research') && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              selectedFunction === 'dictionary' ? '調べたい単語を入力...' :
              selectedFunction === 'research' ? '検索したい内容を入力...' :
              'メッセージを入力...'
            }
            multiline
            maxLength={500}
            onSubmitEditing={handleTextSubmit}
            blurOnSubmit={false}
          />
          
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.voiceButton}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Ionicons 
                name={isRecording ? "stop" : "mic"} 
                size={20} 
                color={isRecording ? "#FF4444" : "#4A90E2"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  // メインレンダリング
  return (
    <View
      style={[
        styles.widgetContainer,
        {
          right: widgetPosition.right,
          bottom: widgetPosition.bottom,
        },
      ]}
    >
      {chatState === 'closed' && renderClosedIcon()}
      {chatState === 'minimized' && renderMinimized()}
      {chatState === 'expanded' && renderExpanded()}
    </View>
  );
};

const styles = StyleSheet.create({
  widgetContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  
  // クローズド状態
  closedIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // 最小化状態
  minimizedContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  minimizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  minimizedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    flex: 1,
  },
  minimizedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActions: {
    flexDirection: 'row',
  },
  quickActionButton: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
  
  // 拡大状態
  expandedContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: Math.min(350, screenWidth - 40),
    height: Math.min(500, screenHeight - 100),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  
  // 機能選択
  functionSelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  functionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  functionButtonActive: {
    backgroundColor: '#4A90E2',
  },
  functionButtonText: {
    fontSize: 12,
    color: '#4A90E2',
    marginLeft: 4,
    fontWeight: '500',
  },
  functionButtonTextActive: {
    color: '#fff',
  },
  
  // 文字変換オプション
  convertOptions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    gap: 8,
  },
  convertButton: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  convertButtonText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
  
  // メッセージエリア
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90E2',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8F9FA',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  
  // 入力エリア
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 80,
    fontSize: 14,
    marginRight: 8,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  aiChatIcon: {
    width: 70,
    height: 70,
  },
});

export default withAutoSave(AIChatWidget, {
  enabledFunctions: ['ai_chat_widget'],
  aiConflictPrevention: true,
  debugMode: true
}); 