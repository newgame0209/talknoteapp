import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

interface FilePickerAreaProps {
  navigation?: any;
}

const FilePickerArea: React.FC<FilePickerAreaProps> = ({ navigation }) => {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  // ファイル選択
  const pickDocument = useCallback(async () => {
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
      
      // ファイル選択後、アップロード進捗画面に遷移
      if (navigation) {
        navigation.navigate('ImportProgress', { file: selectedFile });
      }
    } catch (error) {
      console.error('ファイル選択エラー:', error);
      Alert.alert('エラー', 'ファイルの選択中にエラーが発生しました。');
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* ガイダンスメッセージ */}
      <View style={styles.messageContainer}>
        <View style={styles.robotIcon}>
          <Ionicons name="happy-outline" size={32} color="#4F46E5" />
        </View>
        <Text style={styles.messageText}>
          インポートしたいファイルを選んでください。
          PDFや音声ファイル、画像などに対応しています。
        </Text>
      </View>

      {/* ファイル選択エリア */}
      <TouchableOpacity
        style={styles.filePickerButton}
        onPress={pickDocument}
      >
        <MaterialCommunityIcons name="file-upload-outline" size={32} color="#4F46E5" />
        <Text style={styles.filePickerText}>ファイルを選択</Text>
        <Text style={styles.filePickerSubText}>PDF, 音声, 画像ファイルに対応</Text>
      </TouchableOpacity>

      {/* サポートするファイル形式 */}
      <View style={styles.supportedFormatsContainer}>
        <Text style={styles.supportedFormatsTitle}>サポートするファイル形式</Text>
        <View style={styles.formatsList}>
          <View style={styles.formatItem}>
            <MaterialCommunityIcons name="file-pdf-box" size={24} color="#4F46E5" />
            <Text style={styles.formatText}>PDF</Text>
          </View>
          <View style={styles.formatItem}>
            <MaterialCommunityIcons name="file-music-outline" size={24} color="#4F46E5" />
            <Text style={styles.formatText}>MP3, WAV</Text>
          </View>
          <View style={styles.formatItem}>
            <MaterialCommunityIcons name="file-image-outline" size={24} color="#4F46E5" />
            <Text style={styles.formatText}>JPG, PNG</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  messageContainer: {
    flexDirection: 'row',
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  robotIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
  },
  filePickerButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  filePickerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 12,
    marginBottom: 4,
  },
  filePickerSubText: {
    fontSize: 14,
    color: '#6B7280',
  },
  supportedFormatsContainer: {
    marginTop: 8,
  },
  supportedFormatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  formatsList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  formatItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatText: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
});

export default FilePickerArea;
