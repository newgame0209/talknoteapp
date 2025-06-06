/**
 * PhotoScanScreen.tsx
 * 
 * 写真スキャン機能の画面
 * カメラで撮影した画像からOCRでテキストを抽出し、ノートとして保存
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { 
  CameraView, 
  CameraType, 
  useCameraPermissions,
  FlashMode 
} from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAuth } from 'firebase/auth';
import { COLORS } from '../constants/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  provider?: string;
  bounding_boxes?: Array<{
    text: string;
    vertices: Array<{ x: number; y: number }>;
  }>;
}

interface CapturedPhoto {
  uri: string;
  id: string;
  timestamp: number;
  processedUri?: string;
  ocrResult?: OCRResult;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraggableCropFrameProps {
  containerWidth: number;
  containerHeight: number;
  onCropChange: (crop: CropArea) => void;
  initialCrop: CropArea;
}

// API関数
const apiClient = {
  post: async (url: string, data: any, options: any = {}) => {
    const response = await fetch(`http://192.168.0.46:8000${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    return { data: await response.json() };
  }
};

export default function PhotoScanScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  
  // カメラ権限
  const [permission, requestPermission] = useCameraPermissions();
  
  // 状態管理
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isShowingPreview, setIsShowingPreview] = useState(false);
  const [showInstantPreview, setShowInstantPreview] = useState(false);
  const [instantPreviewUri, setInstantPreviewUri] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [notebookTitle, setNotebookTitle] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 15, y: 20, width: 70, height: 60 });
  const [showSkewModal, setShowSkewModal] = useState(false);
  const [skewAngle, setSkewAngle] = useState(0);

  
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (ocrResult) {
      setEditedText(ocrResult.text);
    }
  }, [ocrResult]);

  // 権限チェック
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const getAuthToken = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    throw new Error('認証されていません');
  };

  const createNotebook = async (data: { title: string }) => {
    const token = await getAuthToken();
    return await apiClient.post('/api/v1/notebooks/', data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  const createPage = async (data: any) => {
    const token = await getAuthToken();
    return await apiClient.post('/api/v1/pages/', data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  // カメラ権限チェック
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#666" />
          <Text style={styles.permissionTitle}>カメラアクセスが必要です</Text>
          <Text style={styles.permissionText}>
            文書をスキャンしてテキストを抽出するために、カメラへのアクセスを許可してください。
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>カメラを許可</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 写真撮影
  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false
      });

      if (photo) {
        // 一瞬プレビューを表示
        showInstantPhotoPreview(photo.uri);
        
        // 自動切り取りを実行
        const croppedUri = await autoFrameCrop(photo.uri, photo.width, photo.height);
        
        const newPhoto: CapturedPhoto = {
          uri: photo.uri, // 元の画像
          processedUri: croppedUri, // 自動切り取り済み画像
          id: Date.now().toString(),
          timestamp: Date.now()
        };
        
        setCapturedPhotos(prev => [...prev, newPhoto]);
        setSelectedPhotoIndex(capturedPhotos.length);
        
        // 撮影後は直接スキャン画面に遷移
        setIsShowingPreview(true);
        processOCR(croppedUri || photo.uri);
      }
    } catch (error) {
      console.error('撮影エラー:', error);
      Alert.alert('エラー', '写真を撮影できませんでした');
    } finally {
      setIsProcessing(false);
    }
  };

  // ギャラリーから追加
  const addFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false
      });

      if (!result.canceled && result.assets[0]) {
        const assetWidth = result.assets[0].width ?? 0;
        const assetHeight = result.assets[0].height ?? 0;
        const croppedFromGallery = await autoFrameCrop(result.assets[0].uri, assetWidth, assetHeight);

        const newPhoto: CapturedPhoto = {
          uri: result.assets[0].uri,
          processedUri: croppedFromGallery,
          id: Date.now().toString(),
          timestamp: Date.now()
        };
        
        const newIndex = capturedPhotos.length;
        setCapturedPhotos(prev => [...prev, newPhoto]);
        setSelectedPhotoIndex(newIndex);
        
        // スキャン画面が表示されていない場合は表示する
        if (!isShowingPreview) {
          setIsShowingPreview(true);
        }
        
        processOCR(result.assets[0].uri);
      }
    } catch (error) {
      console.error('ギャラリー選択エラー:', error);
      Alert.alert('エラー', '画像を選択できませんでした');
    }
  };

  // OCR処理
  const processOCR = async (imageUri: string) => {
    try {
      setIsProcessing(true);
      
      // 画像をBase64に変換
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true }
      );
      
      if (!manipResult.base64) {
        throw new Error('Base64変換に失敗しました');
      }
      
      console.log('OCR処理開始:', `data:image/jpeg;base64,${manipResult.base64.substring(0, 100)}...`);
      
      const token = await getAuthToken();
      const response = await apiClient.post('/api/v1/ocr/extract-text-base64', 
        { image_data: `data:image/jpeg;base64,${manipResult.base64}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('OCR結果:', response.data);
      
      if (response.data && response.data.text) {
        const result: OCRResult = {
          text: response.data.text,
          confidence: response.data.confidence || 0,
          language: response.data.language,
          provider: response.data.provider,
          bounding_boxes: response.data.bounding_boxes
        };
        
        setOcrResult(result);
        setEditedText(result.text);
        setNotebookTitle(`スキャンノート ${new Date().toLocaleDateString()}`);
        
        // 撮影した写真にOCR結果を関連付け
        setCapturedPhotos(prev => {
          const updated = [...prev];
          const photoIndex = updated.findIndex(p => p.uri === imageUri);
          if (photoIndex !== -1) {
            updated[photoIndex].ocrResult = result;
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('OCR処理エラー:', error);
      
      // OCRエラー時のユーザーフレンドリーなメッセージ表示
      Alert.alert(
        '📷 写真の認識ができませんでした',
        '写真が不鮮明か、文字が読み取れません。\n\n✓ 明るい場所で撮影してください\n✓ 文字がはっきり見えるようにしてください\n✓ 手ブレしないように注意してください\n\nもう一度撮影しますか？',
        [
          {
            text: 'キャンセル',
            style: 'cancel'
          },
          {
                         text: '📸 再撮影',
             onPress: () => {
               // 撮影画面に戻る
               setIsShowingPreview(false);
               setCapturedPhotos([]);
               setSelectedPhotoIndex(0);
               setOcrResult(null);
               setEditedText('');
             }
          }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ノートで開く
  const openInNote = async () => {
    try {
      if (!editedText.trim()) {
        Alert.alert('エラー', 'テキストが抽出されていません');
        return;
      }
      
      const currentPhoto = capturedPhotos[selectedPhotoIndex];
      if (!currentPhoto) {
        Alert.alert('エラー', '写真が選択されていません');
        return;
      }
      
      setIsProcessing(true);
      
      // ノートブック作成
      const notebookResponse = await createNotebook({
        title: notebookTitle || `スキャンノート ${new Date().toLocaleDateString()}`
      });
      
      if (!notebookResponse.data?.id) {
        throw new Error('ノートブック作成に失敗しました');
      }
      
      // ページ作成（写真とテキストを含む）
      const pageData = {
        notebook_id: notebookResponse.data.id,
        title: notebookTitle || 'スキャンページ',
        content: {
          type: 'mixed',
          image: {
            uri: currentPhoto.processedUri || currentPhoto.uri,
            timestamp: currentPhoto.timestamp
          },
          text: editedText,
          ocr_result: currentPhoto.ocrResult
        }
      };
      
      const pageResponse = await createPage(pageData);
      
      if (pageResponse.data?.id) {
        // Canvas Editorに遷移
        navigation.navigate('CanvasEditor', {
          notebookId: notebookResponse.data.id,
          pageId: pageResponse.data.id,
          initialContent: pageData.content
        });
      }
    } catch (error) {
      console.error('ノート作成エラー:', error);
      Alert.alert('エラー', 'ノートの作成に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  // 撮影後の一瞬プレビュー
  const showInstantPhotoPreview = (uri: string) => {
    setInstantPreviewUri(uri);
    setShowInstantPreview(true);
    // 1秒後に自動で消す
    setTimeout(() => {
      setShowInstantPreview(false);
      setInstantPreviewUri(null);
    }, 1000);
  };

  // スキュー修正
  const applySkewCorrection = async () => {
    try {
      const currentPhoto = capturedPhotos[selectedPhotoIndex];
      if (!currentPhoto) return;
      
      const manipResult = await ImageManipulator.manipulateAsync(
        currentPhoto.uri,
        [{ rotate: skewAngle }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
      );
      
      // 処理済み画像として保存
      setCapturedPhotos(prev => {
        const updated = [...prev];
        updated[selectedPhotoIndex].processedUri = manipResult.uri;
        return updated;
      });
      
      setShowSkewModal(false);
      setSkewAngle(0);
    } catch (error) {
      console.error('スキュー修正エラー:', error);
      Alert.alert('エラー', 'スキュー修正に失敗しました');
    }
  };

  // トリミング適用
  const applyCrop = async () => {
    try {
      const currentPhoto = capturedPhotos[selectedPhotoIndex];
      if (!currentPhoto) return;

      // 画像の実際のサイズを取得
      const imageUri = currentPhoto.processedUri || currentPhoto.uri;
      const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], { compress: 1 });
      const imageWidth = imageInfo.width;
      const imageHeight = imageInfo.height;

      console.log('🖼️ 画像情報:', { imageWidth, imageHeight });
      console.log('📐 cropArea:', cropArea);

      // クロップ領域を画像の実際のサイズに変換
      const cropX = Math.round((cropArea.x / 100) * imageWidth);
      const cropY = Math.round((cropArea.y / 100) * imageHeight);
      const cropWidth = Math.round((cropArea.width / 100) * imageWidth);
      const cropHeight = Math.round((cropArea.height / 100) * imageHeight);

      console.log('✂️ 実際のクロップ領域:', { cropX, cropY, cropWidth, cropHeight });

      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: cropX,
            originY: cropY,
            width: cropWidth,
            height: cropHeight
          }
        }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
      );
      
      // 処理済み画像として保存
      setCapturedPhotos(prev => {
        const updated = [...prev];
        updated[selectedPhotoIndex].processedUri = manipResult.uri;
        return updated;
      });
      
      setShowCropModal(false);
      Alert.alert('成功', 'トリミングが完了しました');
    } catch (error) {
      console.error('トリミングエラー:', error);
      Alert.alert('エラー', 'トリミングに失敗しました');
    }
  };

  // 自動切り取り機能（撮影ガイド枠に基づく）
  const autoFrameCrop = async (
    imageUri: string,
    imageWidth: number,
    imageHeight: number
  ): Promise<string> => {
    try {
      // UI上のガイドフレームサイズ (px)
      const uiFrameWidth = screenWidth - 80;
      const uiFrameHeight = uiFrameWidth * 1.4;

      // ガイドフレームのUI上の原点 (px)
      const uiFrameLeft = 40;
      const uiFrameTop = (screenHeight - uiFrameHeight) / 2;

      // 画像 ↔ UI スケール係数
      const scaleX = imageWidth / screenWidth;
      const scaleY = imageHeight / screenHeight;

      // 画像上の切り取り領域 (px)
      const cropX = Math.round(uiFrameLeft * scaleX);
      const cropY = Math.round(uiFrameTop * scaleY);
      const cropWidth = Math.round(uiFrameWidth * scaleX);
      const cropHeight = Math.round(uiFrameHeight * scaleY);

      console.log('🔄 自動切り取り:', {
        imageSize: `${imageWidth}×${imageHeight}`,
        uiFrame: `${uiFrameWidth}×${uiFrameHeight} at (${uiFrameLeft}, ${uiFrameTop})`,
        cropPx: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
      });

      // 切り取り実行
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: cropX,
            originY: cropY,
            width: cropWidth,
            height: cropHeight
          }
        }],
        { 
          compress: 0.9, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      console.log('✅ 切り取り完了:', result.uri);
      return result.uri;
    } catch (error) {
      console.error('❌ 自動切り取りエラー:', error);
      return imageUri; // エラー時は元の画像を返す
    }
  };

  // 戻る
  const goBack = () => {
    navigation.goBack();
  };

  // カメラ切り替え
  const toggleCameraType = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  // フラッシュ切り替え
  const toggleFlash = () => {
    setFlashMode(current => {
      switch (current) {
        case 'off': return 'on';
        case 'on': return 'auto';
        default: return 'off';
      }
    });
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash-outline';
      case 'auto': return 'flash-outline';
      default: return 'flash-off-outline';
    }
  };

  // 一瞬のプレビュー表示
  if (showInstantPreview && instantPreviewUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.instantPreviewContainer}>
          <Image
            source={{ uri: instantPreviewUri }}
            style={styles.instantPreviewImage}
            contentFit="cover"
          />
          <View style={styles.instantPreviewOverlay}>
            <Text style={styles.instantPreviewText}>撮影完了</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // スキャン画面（写真プレビュー）
  if (isShowingPreview && capturedPhotos.length > 0) {
    const currentPhoto = capturedPhotos[selectedPhotoIndex];
    
    return (
      <SafeAreaView style={styles.container}>
        {/* ヘッダー */}
        <View style={styles.scanHeader}>
          <Pressable onPress={goBack} style={[styles.headerButton, { backgroundColor: '#00A1FF' }]}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={openInNote} style={styles.openNoteButton}>
            <Text style={styles.openNoteText}>ノートを作成する</Text>
          </Pressable>
        </View>

        {/* 写真表示エリア（大表示、白背景なし） */}
        <View style={styles.scanImageContainer}>
          <Image
            source={{ uri: currentPhoto.processedUri || currentPhoto.uri }}
            style={styles.scanImage}
            contentFit="contain"
          />
          {isProcessing && (
            <View style={styles.scanProcessingOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.scanProcessingText}>処理中...</Text>
            </View>
          )}
        </View>

        {/* ページナビゲーション */}
        <View style={styles.pageNavigation}>
          <Pressable 
            onPress={() => {
              if (selectedPhotoIndex > 0) {
                setSelectedPhotoIndex(selectedPhotoIndex - 1);
              }
            }}
            style={[styles.navArrow, selectedPhotoIndex === 0 && styles.navArrowDisabled]}
            disabled={selectedPhotoIndex === 0}
          >
            <Ionicons name="chevron-back" size={20} color={selectedPhotoIndex === 0 ? '#ccc' : '#00A1FF'} />
          </Pressable>
          <Text style={styles.pageIndicator}>{selectedPhotoIndex + 1}枚目</Text>
          <Pressable 
            onPress={() => {
              if (selectedPhotoIndex < capturedPhotos.length - 1) {
                setSelectedPhotoIndex(selectedPhotoIndex + 1);
              }
            }}
            style={[styles.navArrow, selectedPhotoIndex === capturedPhotos.length - 1 && styles.navArrowDisabled]}
            disabled={selectedPhotoIndex === capturedPhotos.length - 1}
          >
            <Ionicons name="chevron-forward" size={20} color={selectedPhotoIndex === capturedPhotos.length - 1 ? '#ccc' : '#00A1FF'} />
          </Pressable>
        </View>

        {/* アクションボタン */}
        <View style={styles.scanActionButtons}>
          <Pressable 
            onPress={() => {
              // カメラ画面に戻る
              setIsShowingPreview(false);
            }} 
            style={styles.scanActionButton}
          >
            <Ionicons name="camera" size={24} color="#00A1FF" />
            <Text style={styles.scanActionText}>写真追加</Text>
          </Pressable>

          <Pressable onPress={addFromGallery} style={styles.scanActionButton}>
            <Ionicons name="image" size={24} color="#00A1FF" />
            <Text style={styles.scanActionText}>ギャラリー</Text>
          </Pressable>

          <Pressable onPress={() => {
            // トリミングモーダルを開く際にクロップエリアをリセット
            setCropArea({ x: 10, y: 12, width: 70, height: 60 });
            setShowCropModal(true);
          }} style={styles.scanActionButton}>
            <Ionicons name="crop" size={24} color="#00A1FF" />
            <Text style={styles.scanActionText}>トリミング</Text>
          </Pressable>
        </View>

        {/* OCR結果 */}
        {ocrResult && (
          <ScrollView style={styles.scanOcrSection}>
            <Text style={styles.scanOcrTitle}>抽出されたテキスト</Text>
            <View style={styles.scanConfidenceContainer}>
              <Text style={styles.scanConfidenceText}>
                信頼度: {Math.round((ocrResult.confidence || 0) * 100)}%
              </Text>
              {ocrResult.language && (
                <Text style={styles.scanLanguageText}>言語: {ocrResult.language}</Text>
              )}
            </View>
            <Text
              style={styles.scanTextPreview}
            >
              {editedText || "抽出されたテキストがここに表示されます"}
            </Text>
          </ScrollView>
        )}

        {/* スキュー修正モーダル */}
        <Modal visible={showSkewModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.skewModal}>
              <Text style={styles.modalTitle}>スキュー修正</Text>
              <View style={styles.skewPreview}>
                <Image
                  source={{ uri: currentPhoto.uri }}
                  style={[styles.skewPreviewImage, { transform: [{ rotate: `${skewAngle}deg` }] }]}
                  contentFit="contain"
                />
              </View>
              <View style={styles.skewControls}>
                <Text style={styles.skewLabel}>回転角度: {skewAngle}°</Text>
                <View style={styles.skewButtons}>
                  <Pressable
                    onPress={() => setSkewAngle(prev => prev - 1)}
                    style={styles.skewButton}
                  >
                    <Text style={styles.skewButtonText}>-1°</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSkewAngle(0)}
                    style={styles.skewButton}
                  >
                    <Text style={styles.skewButtonText}>リセット</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSkewAngle(prev => prev + 1)}
                    style={styles.skewButton}
                  >
                    <Text style={styles.skewButtonText}>+1°</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setShowSkewModal(false)} style={styles.modalCancelButton}>
                  <Text style={styles.modalCancelText}>キャンセル</Text>
                </Pressable>
                <Pressable onPress={applySkewCorrection} style={styles.modalConfirmButton}>
                  <Text style={styles.modalConfirmText}>適用</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* トリミングモーダル */}
        <Modal visible={showCropModal} transparent animationType="slide">
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.modalContainer}>
              <View style={styles.cropModal}>
                <Text style={styles.modalTitle}>指でドラッグしてトリミング範囲を調整</Text>
                
                {/* 説明テキスト */}
                <View style={{ marginBottom: 16, paddingHorizontal: 12, backgroundColor: 'rgba(0, 161, 255, 0.1)', borderRadius: 8, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, color: '#00A1FF', textAlign: 'center', fontWeight: '600' }}>
                    📱 枠をドラッグして移動・右下角で大きさ調整
                  </Text>
                </View>
                
                {/* より大きなプレビュー写真表示エリア */}
                <View style={styles.cropContainerLarge}>
                  <Image
                    source={{ uri: currentPhoto.processedUri || currentPhoto.uri }}
                    style={styles.cropImageLarge}
                    contentFit="contain"
                  />
                  
                  {/* ドラッグ可能なトリミング枠 */}
                  <DraggableCropFrame
                    containerWidth={screenWidth - 40} // より大きく
                    containerHeight={400} // より高く
                    onCropChange={(newCrop) => setCropArea(newCrop)}
                    initialCrop={cropArea}
                  />
                </View>
                
                {/* リセットボタンのみ */}
                <View style={styles.cropControls}>
                  <Pressable 
                    onPress={() => setCropArea({ x: 10, y: 10, width: 80, height: 80 })}
                    style={styles.cropResetButton}
                  >
                    <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.cropResetText}>範囲をリセット</Text>
                  </Pressable>
                </View>
                
                <View style={styles.modalButtons}>
                  <Pressable onPress={() => setShowCropModal(false)} style={styles.modalCancelButton}>
                    <Text style={styles.modalCancelText}>キャンセル</Text>
                  </Pressable>
                  <Pressable onPress={applyCrop} style={styles.modalConfirmButton}>
                    <Text style={styles.modalConfirmText}>適用</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      </SafeAreaView>
    );
  }

  // カメラ画面
  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
      />
      
      {/* ヘッダー - Absolute positioning */}
      <View style={styles.cameraHeader}>
        <Pressable onPress={goBack} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.cameraHeaderTitle}>写真をスキャン</Text>
        <Pressable onPress={toggleFlash} style={styles.headerButton}>
          <Ionicons name={getFlashIcon()} size={28} color="#fff" />
        </Pressable>
      </View>

      {/* 撮影ガイド枠と説明 - Absolute positioning */}
      <View style={styles.cameraGuideContainer}>
        {/* 暗いオーバーレイで撮影範囲以外を暗くする */}
        <View style={styles.cameraOverlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.cameraGuideFrame} />
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>
        
        <View style={styles.cameraGuideText}>
          <Ionicons name="document-text-outline" size={24} color="#00A1FF" />
          <Text style={styles.guideText}>枠の中に綺麗に入れて撮影しよう！</Text>
        </View>
      </View>

      {/* 左右ナビゲーション - Absolute positioning */}
      <View style={styles.cameraNavigation}>
        <View style={styles.leftNavigation}>
          {capturedPhotos.length > 0 && (
            <Pressable onPress={() => setIsShowingPreview(true)} style={styles.navButton}>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.navText}>他の写真</Text>
              <Text style={styles.navCount}>({capturedPhotos.length})</Text>
            </Pressable>
          )}
        </View>
        
        <View style={styles.rightNavigation}>
          {/* 次の写真項目を削除 */}
        </View>
      </View>

      {/* カメラコントロール - Absolute positioning */}
      <View style={styles.cameraControls}>
        <Pressable onPress={addFromGallery} style={styles.galleryButton}>
          <Ionicons name="images" size={28} color="#fff" />
        </Pressable>

        <Pressable onPress={takePicture} style={styles.captureButton}>
          <View style={styles.captureButtonInner} />
        </Pressable>

        <Pressable onPress={toggleCameraType} style={styles.flipButton}>
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ドラッグ可能なトリミング枠コンポーネント
const DraggableCropFrame: React.FC<DraggableCropFrameProps> = ({
  containerWidth,
  containerHeight,
  onCropChange,
  initialCrop
}) => {
  const translateX = useSharedValue((initialCrop.x / 100) * containerWidth);
  const translateY = useSharedValue((initialCrop.y / 100) * containerHeight);
  const frameWidth = useSharedValue((initialCrop.width / 100) * containerWidth);
  const frameHeight = useSharedValue((initialCrop.height / 100) * containerHeight);

  // initialCropが変更された時に値を更新
  useEffect(() => {
    translateX.value = (initialCrop.x / 100) * containerWidth;
    translateY.value = (initialCrop.y / 100) * containerHeight;
    frameWidth.value = (initialCrop.width / 100) * containerWidth;
    frameHeight.value = (initialCrop.height / 100) * containerHeight;
  }, [initialCrop, containerWidth, containerHeight]);

  const MIN_SIZE = 50; // 最小サイズ（px）

  // トリミング枠の位置とサイズを更新する関数
  const updateCropArea = () => {
    'worklet';
    const newCrop: CropArea = {
      x: Math.max(0, Math.min(100, (translateX.value / containerWidth) * 100)),
      y: Math.max(0, Math.min(100, (translateY.value / containerHeight) * 100)),
      width: Math.max(5, Math.min(100, (frameWidth.value / containerWidth) * 100)),
      height: Math.max(5, Math.min(100, (frameHeight.value / containerHeight) * 100)),
    };
    console.log('🔄 Crop area updated:', newCrop);
    runOnJS(onCropChange)(newCrop);
  };

  // ジェスチャー開始時の基準値保存
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(0);
  const startHeight = useSharedValue(0);
  
  // 操作中の視覚的フィードバック用
  const isDragging = useSharedValue(false);
  const isResizing = useSharedValue(false);

  // メインフレームの移動ジェスチャー（視覚的フィードバック重視）
  const framePanGesture = Gesture.Pan()
    .onBegin(() => {
      // ジェスチャー開始時に現在位置を基準値として保存
      startX.value = translateX.value;
      startY.value = translateY.value;
      isDragging.value = true; // 操作中フラグをON
    })
    .onUpdate((event) => {
      // 基準値 + 移動量で新しい位置を計算（感度50%）
      const newX = startX.value + (event.translationX * 0.5);
      const newY = startY.value + (event.translationY * 0.5);
      
      // 境界チェック
      const maxX = containerWidth - frameWidth.value;
      const maxY = containerHeight - frameHeight.value;
      
      // 視覚的に確実に更新されるよう値を設定
      translateX.value = Math.max(0, Math.min(maxX, newX));
      translateY.value = Math.max(0, Math.min(maxY, newY));
    })
    .onEnd(() => {
      isDragging.value = false; // 操作中フラグをOFF
      updateCropArea();
    });

  // リサイズジェスチャー（右下角ハンドル用）
  const resizePanGesture = Gesture.Pan()
    .onBegin(() => {
      // ジェスチャー開始時に現在サイズを基準値として保存
      startWidth.value = frameWidth.value;
      startHeight.value = frameHeight.value;
      isResizing.value = true; // リサイズ中フラグをON
    })
    .onUpdate((event) => {
      // 基準値 + 移動量で新しいサイズを計算（感度60%）
      const newWidth = startWidth.value + (event.translationX * 0.6);
      const newHeight = startHeight.value + (event.translationY * 0.6);
      
      // サイズ制限チェック
      const maxWidth = containerWidth - translateX.value;
      const maxHeight = containerHeight - translateY.value;
      
      // 視覚的に確実に更新されるよう値を設定
      frameWidth.value = Math.max(MIN_SIZE, Math.min(maxWidth, newWidth));
      frameHeight.value = Math.max(MIN_SIZE, Math.min(maxHeight, newHeight));
    })
    .onEnd(() => {
      isResizing.value = false; // リサイズ中フラグをOFF
      updateCropArea();
    });

  // フレームのアニメーションスタイル（視覚的フィードバック強化）
  const frameAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      width: frameWidth.value,
      height: frameHeight.value,
      // 操作中は色を変更して視覚的フィードバック
      borderColor: isDragging.value || isResizing.value ? '#FF6B6B' : '#00A1FF',
      backgroundColor: isDragging.value || isResizing.value 
        ? 'rgba(255, 107, 107, 0.15)' 
        : 'rgba(0, 161, 255, 0.1)',
      // 操作中は少し大きな線にして分かりやすく
      borderWidth: isDragging.value || isResizing.value ? 4 : 3,
    };
  });

  // リサイズハンドルのアニメーションスタイル
  const resizeHandleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value + frameWidth.value - 15 },
        { translateY: translateY.value + frameHeight.value - 15 },
      ],
    };
  });

  // 四隅のドットのアニメーションスタイル
  const topLeftDotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - 4 },
      { translateY: translateY.value - 4 },
    ],
  }));

  const topRightDotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + frameWidth.value - 4 },
      { translateY: translateY.value - 4 },
    ],
  }));

  const bottomLeftDotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - 4 },
      { translateY: translateY.value + frameHeight.value - 4 },
    ],
  }));

  const bottomRightDotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + frameWidth.value - 4 },
      { translateY: translateY.value + frameHeight.value - 4 },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      {/* メインのトリミング枠 */}
      <GestureDetector gesture={framePanGesture}>
        <Animated.View style={[styles.draggableCropFrame, frameAnimatedStyle]}>
          {/* フレームの境界線 */}
          <View style={styles.cropFrameBorder} />
          
          {/* 中央の移動用エリア */}
          <View style={styles.cropMoveArea}>
            <Ionicons name="move" size={24} color="rgba(0, 161, 255, 0.8)" />
            <Text style={styles.cropMoveText}>ドラッグして移動</Text>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* 右下角のリサイズハンドル */}
      <GestureDetector gesture={resizePanGesture}>
        <Animated.View style={[styles.cropResizeHandle, resizeHandleAnimatedStyle]}>
          <Ionicons name="resize" size={20} color="#00A1FF" />
        </Animated.View>
      </GestureDetector>

      {/* 四隅のドット（視覚的ガイド） */}
      <Animated.View style={[styles.cropCornerDot, topLeftDotStyle]} />
      <Animated.View style={[styles.cropCornerDot, topRightDotStyle]} />
      <Animated.View style={[styles.cropCornerDot, bottomLeftDotStyle]} />
      <Animated.View style={[styles.cropCornerDot, bottomRightDotStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    alignSelf: 'stretch',
    margin: 0,
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraGuideContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 5,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTop: {
    width: '100%',
    height: (screenHeight - (screenWidth - 80) * 1.4) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayMiddle: {
    width: '100%',
    height: (screenWidth - 80) * 1.4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlaySide: {
    width: 40,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayBottom: {
    width: '100%',
    height: (screenHeight - (screenWidth - 80) * 1.4) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  cameraGuideFrame: {
    width: screenWidth - 80,
    height: (screenWidth - 80) * 1.4,
    borderWidth: 3,
    borderColor: '#00A1FF',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  cameraGuideText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00A1FF',
  },
  guideText: {
    color: '#00A1FF',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  cameraNavigation: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    zIndex: 10,
  },
  leftNavigation: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightNavigation: {
    flex: 1,
    alignItems: 'flex-end',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  navText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  navCount: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 2,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scanHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  openNoteButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  openNoteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scanImageContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  scanImage: {
    width: '100%',
    height: '100%',
  },
  scanProcessingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanProcessingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  pageNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  pageIndicator: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  navArrow: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 161, 255, 0.1)',
  },
  navArrowDisabled: {
    opacity: 0.5,
  },
  scanActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  scanActionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scanActionText: {
    color: '#00A1FF',
    fontSize: 12,
    marginTop: 4,
  },
  scanOcrSection: {
    maxHeight: 200,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scanOcrTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  scanConfidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scanConfidenceText: {
    fontSize: 12,
    color: '#666',
  },
  scanLanguageText: {
    fontSize: 12,
    color: '#666',
  },
  scanTextInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scanTextPreview: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalCancelText: {
    color: '#333',
    fontSize: 16,
  },
  modalConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skewModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: screenWidth - 40,
    maxHeight: screenHeight * 0.8,
  },
  skewPreview: {
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  skewPreviewImage: {
    width: '100%',
    height: '100%',
  },
  skewControls: {
    alignItems: 'center',
  },
  skewLabel: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  skewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  skewButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skewButtonText: {
    fontSize: 14,
    color: '#333',
  },
  cropModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: screenWidth - 40,
    maxHeight: screenHeight * 0.8,
  },
  cropContainer: {
    height: 300,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  cropContainerLarge: {
    height: 400,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  cropImage: {
    width: '100%',
    height: '100%',
  },
  cropImageLarge: {
    width: '100%',
    height: '100%',
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
  },
  cropControls: {
    paddingVertical: 16,
  },
  cropControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cropControlLabel: {
    fontSize: 14,
    color: '#333',
    width: 60,
  },
  cropControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cropControlButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 8,
  },
  cropControlButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  cropControlValue: {
    fontSize: 14,
    color: '#333',
    width: 40,
    textAlign: 'center',
  },
  cropResetButton: {
    backgroundColor: '#00A1FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  cropResetText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instantPreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  instantPreviewImage: {
    width: '100%',
    height: '100%',
  },
  instantPreviewOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instantPreviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ドラッグ可能なトリミング枠用のスタイル
  draggableCropFrame: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00A1FF',
    backgroundColor: 'rgba(0, 161, 255, 0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  cropFrameBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: '#00A1FF',
    borderRadius: 6,
  },
  cropMoveArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00A1FF',
  },
  cropMoveText: {
    fontSize: 12,
    color: '#00A1FF',
    fontWeight: '600',
    marginTop: 4,
  },
  cropResizeHandle: {
    position: 'absolute',
    width: 30,
    height: 30,
    backgroundColor: '#00A1FF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  cropCornerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#00A1FF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 1002,
  },
}); 