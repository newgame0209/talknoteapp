import React, { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  useCanvasRef,
  Circle,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { isTablet } from '../utils/deviceUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface DrawingPath {
  path: string;
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'pencil' | 'marker' | 'eraser';
  timestamp: number;
}

export interface DrawingCanvasProps {
  selectedTool: 'pen' | 'pencil' | 'marker' | 'eraser' | null;
  selectedColor: string;
  strokeWidth: number;
  onPathsChange: (paths: DrawingPath[]) => void;
  paths: DrawingPath[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface DrawingCanvasHandle {
  /**
   * キャンバスの手書きレイヤーを PNG Base64 で取得する
   * 形式: "data:image/png;base64,..."
   */
  captureHandwriting: () => string | null;
}

// 📐 座標点の型定義
interface Point {
  x: number;
  y: number;
}

// 🎨 スムーズ描画用のユーティリティ関数
class SmoothDrawing {
  // 2点間の距離を計算
  static distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  // 2点間の中点を取得
  static midPoint(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  // 座標配列からスムーズなSVGパスを生成（ベジェ曲線使用）
  static createSmoothPath(points: Point[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x.toFixed(3)},${points[0].y.toFixed(3)}`;
    if (points.length === 2) {
      return `M${points[0].x.toFixed(3)},${points[0].y.toFixed(3)}L${points[1].x.toFixed(3)},${points[1].y.toFixed(3)}`;
    }

    let path = `M${points[0].x.toFixed(3)},${points[0].y.toFixed(3)}`;
    
    // 🌊 スムーズなクアドラティック・ベジェ曲線を生成
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midPoint = this.midPoint(current, next);
      
      // Q コマンド: クアドラティック・ベジェ曲線
      // Q controlX,controlY endX,endY
      path += `Q${current.x.toFixed(3)},${current.y.toFixed(3)} ${midPoint.x.toFixed(3)},${midPoint.y.toFixed(3)}`;
    }
    
    // 最後の点まで線を引く
    const lastPoint = points[points.length - 1];
    path += `T${lastPoint.x.toFixed(3)},${lastPoint.y.toFixed(3)}`;
    
    return path;
  }

  // 🎯 座標の間引き処理（パフォーマンス向上）
  static filterPoints(points: Point[], minDistance: number = 3): Point[] {
    if (points.length <= 2) return points;
    
    const filtered: Point[] = [points[0]]; // 最初の点は必ず含める
    
    for (let i = 1; i < points.length - 1; i++) {
      const lastFiltered = filtered[filtered.length - 1];
      const current = points[i];
      
      // 最小距離以上離れている場合のみ追加
      if (this.distance(lastFiltered, current) >= minDistance) {
        filtered.push(current);
      }
    }
    
    // 最後の点は必ず含める
    filtered.push(points[points.length - 1]);
    
    return filtered;
  }
}

const DrawingCanvasInner: React.ForwardRefRenderFunction<DrawingCanvasHandle, DrawingCanvasProps> = ({
  selectedTool,
  selectedColor,
  strokeWidth,
  onPathsChange,
  paths,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}, ref) => {
  const canvasRef = useCanvasRef();
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const currentPathRef = useRef<DrawingPath | null>(null);
  const selectedToolRef = useRef<'pen' | 'pencil' | 'marker' | 'eraser' | null>(null);
  
  // 🔧 Stale Closure問題の解決：pathsを常に最新の値で参照
  const pathsRef = useRef<DrawingPath[]>(paths);
  
  // 🎨 スムーズ描画用の座標配列
  const currentPointsRef = useRef<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('Ready - Enhanced Smooth Drawing');
  const [moveCount, setMoveCount] = useState(0);

  // 🗑️ 消しゴム用の状態
  const [eraserPosition, setEraserPosition] = useState<Point | null>(null);
  const [showEraserCursor, setShowEraserCursor] = useState(false);

  // 👉 指タッチを無視するためのフラグ
  const drawingBlockedRef = useRef(false);

  // selectedColorとstrokeWidthを常に最新の値で参照
  const selectedColorRef = useRef<string>(selectedColor);
  const strokeWidthRef = useRef<number>(strokeWidth);
  
  // selectedToolの変更を追跡してRefを更新
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);
  
  // selectedColorの変更を追跡してRefを更新
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);
  
  // strokeWidthの変更を追跡してRefを更新
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  // 🔧 pathsプロパティの変更をRefに反映
  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  // 🔍 paths プロパティの変化を監視（デバッグ用）
  useEffect(() => {
    // console.log('🔍 DrawingCanvas: paths prop changed:', {
    //   pathsLength: paths.length,
    //   paths: paths.map((p, i) => ({ 
    //     index: i, 
    //     tool: p.tool, 
    //     color: p.color, 
    //     timestamp: p.timestamp,
    //     pathLength: p.path.length
    //   }))
    // });
    setDebugInfo(`Props changed: paths=${paths.length}`);
  }, [paths]);

  // 現在描画中のパスを作成
  const createNewPath = useCallback(() => {
    const currentTool = selectedToolRef.current;
    if (!currentTool) return null;
    
    return {
      path: '',
      color: selectedColorRef.current,
      strokeWidth: strokeWidthRef.current,
      tool: currentTool,
      timestamp: Date.now(),
    };
  }, []); // 依存配列を空にしてrefを使用

  // 🚀 座標配列からパスを更新
  const updateCurrentPathFromPoints = useCallback((points: Point[]) => {
    if (!currentPathRef.current || points.length === 0) return;
    
    // 📐 座標の間引き処理（Apple Pencil使用時はより細かく）
    const filterDistance = isTablet() ? 1 : 2; // iPadでは間引きを少なくして感度向上
    const filteredPoints = SmoothDrawing.filterPoints(points, filterDistance);
    
    // 🌊 スムーズなベジェ曲線パスを生成
    const smoothPath = SmoothDrawing.createSmoothPath(filteredPoints);
    
    const updatedPath = {
      ...currentPathRef.current,
      path: smoothPath
    };
    
    setCurrentPath(updatedPath);
    currentPathRef.current = updatedPath;
  }, []);

  // 🗑️ 消しゴム用：触れた部分だけを消す
  const eraseAtPoint = useCallback((point: Point) => {
    const currentPaths = pathsRef.current;
    if (currentPaths.length === 0) return;

    const eraserRadius = 15; // 固定サイズ
    let hasChanges = false;
    const newPaths: DrawingPath[] = [];

    currentPaths.forEach((drawingPath) => {
      // パスから座標点を取得
      const pathCoords = parsePathCoordinates(drawingPath.path);
      if (pathCoords.length === 0) {
        newPaths.push(drawingPath);
        return;
      }

      // 連続したセグメントを作成（消しゴムの範囲外の点をグループ化）
      const segments: Point[][] = [];
      let currentSegment: Point[] = [];
      
      pathCoords.forEach((coord) => {
        const distance = SmoothDrawing.distance(coord, point);
        
        if (distance > eraserRadius) {
          // 消しゴムの範囲外なので保持
          currentSegment.push(coord);
        } else {
          // 消しゴムの範囲内なので削除
          hasChanges = true;
          
          // 現在のセグメントに点があれば保存して新しいセグメントを開始
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [];
          }
        }
      });
      
      // 最後のセグメントを追加
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      // 各セグメントから新しいパスを作成
      if (segments.length > 0) {
        segments.forEach((segment, index) => {
          if (segment.length >= 2) { // 最低2点必要
            // 直接SVGパスを作成（シンプルに）
            let path = `M${segment[0].x.toFixed(1)},${segment[0].y.toFixed(1)}`;
            for (let i = 1; i < segment.length; i++) {
              path += `L${segment[i].x.toFixed(1)},${segment[i].y.toFixed(1)}`;
            }
            
            newPaths.push({
              ...drawingPath,
              path: path,
              timestamp: drawingPath.timestamp + index * 0.001,
            });
          }
        });
      }
      // segments.length === 0 の場合は線全体が削除された
    });

    // 変更があった場合のみ更新
    if (hasChanges) {
      // console.log('🗑️ Eraser applied', {
      //   originalPaths: currentPaths.length,
      //   newPaths: newPaths.length,
      //   eraserRadius: eraserRadius,
      //   position: `(${point.x.toFixed(0)}, ${point.y.toFixed(0)})`
      // });
      
      onPathsChange(newPaths);
    }
  }, []);

  // 📐 SVGパス文字列から座標を抽出（改良版）
  const parsePathCoordinates = useCallback((pathString: string): Point[] => {
    const coords: Point[] = [];
    if (!pathString) return coords;

    // 数値のペアを抽出（座標として扱う）
    const numberPairs = pathString.match(/([0-9.-]+)\s*,\s*([0-9.-]+)/g);
    
    if (numberPairs) {
      numberPairs.forEach(pair => {
        const [xStr, yStr] = pair.split(',');
        const x = parseFloat(xStr.trim());
        const y = parseFloat(yStr.trim());
        
        if (!isNaN(x) && !isNaN(y)) {
          coords.push({ x, y });
        }
      });
    }

    return coords;
  }, []);

  // ✏️ 指タッチを無効化し、Apple Pencil(=Stylus)のみ描画を許可
  const panGesture = Gesture.Pan()
    .runOnJS(true) // すべてJSスレッドで実行し、Reanimated依存を排除
    .minDistance(1) // 最小移動距離を1pxに設定（感度向上）
    .activeOffsetX([-2, 2]) // X軸の反応範囲を狭く（感度向上）
    .activeOffsetY([-2, 2]) // Y軸の反応範囲を狭く（感度向上）
    .onBegin((event) => {
      const currentTool = selectedToolRef.current;
      if (!currentTool) return;

      // iPad + ペン系ツールの場合のみフィルタリング
      const isPenTool = currentTool === 'pen' || currentTool === 'pencil' || currentTool === 'marker';
      if (isTablet() && isPenTool) {
        // pointerTypeは数値のenum: TOUCH=0, STYLUS=1, MOUSE=2
        const pointerType = event.pointerType;
        const isStylus = pointerType === 1; // 1 = STYLUS
        drawingBlockedRef.current = !isStylus; // 指(0)ならブロック
        
        console.log(`🎯 Pointer detected: type=${pointerType} (0=touch, 1=stylus, 2=mouse), isStylus=${isStylus}`);
        
        if (drawingBlockedRef.current) {
          console.log('🚫 Touch blocked - pen tool requires stylus');
          return;
        }
        
        // Apple Pencil検出時は即座に描画開始（感度向上）
        if (isStylus) {
          console.log('✏️ Apple Pencil detected - enhanced sensitivity mode');
        }
      }

      const { x, y } = event;

      // 消しゴム
      if (currentTool === 'eraser') {
        eraseAtPoint({ x, y });
        setEraserPosition({ x, y });
        setShowEraserCursor(true);
        return;
      }

      const newPath = createNewPath();
      if (!newPath) return;

      currentPointsRef.current = [{ x, y }];
      newPath.path = `M${x.toFixed(3)},${y.toFixed(3)}`;
      setCurrentPath(newPath);
      currentPathRef.current = newPath;
      setIsDrawing(true);
    })
    .onUpdate((event) => {
      const currentTool = selectedToolRef.current;
      if (!currentTool) return;

      const { x, y } = event;

      if (currentTool === 'eraser') {
        eraseAtPoint({ x, y });
        setEraserPosition({ x, y });
        return;
      }

      if (drawingBlockedRef.current) {
        console.log('🚫 Touch blocked during move - pen tool requires stylus');
        return; // 指タッチ→無視
      }

      if (!currentPathRef.current) return;

      currentPointsRef.current.push({ x, y });
      updateCurrentPathFromPoints(currentPointsRef.current);
    })
    .onEnd(() => {
      setShowEraserCursor(false);
      setEraserPosition(null);

      if (drawingBlockedRef.current) {
        drawingBlockedRef.current = false;
        setIsDrawing(false);
        console.log('🚫 Touch ended - was blocked (not stylus)');
        return;
      }

      if (currentPathRef.current && currentPointsRef.current.length) {
        // 最終パス処理でも感度を考慮
        const finalFilterDistance = isTablet() ? 2 : 3; // iPadでは最終処理でもより細かく
        const finalFiltered = SmoothDrawing.filterPoints(currentPointsRef.current, finalFilterDistance);
        const smoothPath = SmoothDrawing.createSmoothPath(finalFiltered);
        const finalPath = { ...currentPathRef.current, path: smoothPath };
        onPathsChange([...pathsRef.current, finalPath]);
      }

      // cleanup
      setCurrentPath(null);
      currentPathRef.current = null;
      currentPointsRef.current = [];
      setIsDrawing(false);
    });

  // ツール別のスタイル設定 - スムーズ描画対応版
  const getPathStyle = (drawingPath: DrawingPath) => {
    // 🎨 基本的なスタイル設定
    const baseStyle = {
      style: 'stroke' as const,
      strokeCap: 'round' as const,
      strokeJoin: 'round' as const,
    };

    switch (drawingPath.tool) {
      case 'pen':
        return {
          ...baseStyle,
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
          // 🚀 スムーズ描画のためのアンチエイリアシング有効
        };
      case 'pencil':
        return {
          ...baseStyle,
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth * 0.6, // 鉛筆はより細く
          opacity: 0.55, // より鉛筆らしい薄い透明感
          strokeCap: 'round' as const,
          strokeJoin: 'round' as const,
        };
      case 'marker':
        return {
          ...baseStyle,
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth * 2.5, // マーカーは太く
          opacity: 0.6, // マーカーらしい透明感
          strokeCap: 'square' as const, // マーカーらしい角張った端
        };
      default:
        return {
          ...baseStyle,
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
        };
    }
  };

  // 📸 手書きレイヤーのPNG Base64を取得（OCR用に白い背景を合成）
  const captureHandwriting = useCallback((): string | null => {
    if (!canvasRef.current) return null;
    try {
      // 1️⃣ 元の透明背景画像を取得
      const originalImage = canvasRef.current.makeImageSnapshot();
      if (!originalImage) return null;
      
      console.log('🖼️ Original image captured:', {
        width: originalImage.width(),
        height: originalImage.height()
      });
      
      // 2️⃣ OCR用に白い背景付きの画像を作成
      const width = originalImage.width();
      const height = originalImage.height();
      
      // 新しいSurfaceを作成
      const surface = Skia.Surface.Make(width, height);
      if (!surface) {
        console.warn('🖼️ Failed to create surface for white background');
        // フォールバック: 元の透明背景画像を返す
        const base64 = originalImage.encodeToBase64();
        return `data:image/png;base64,${base64}`;
      }
      
      const canvas = surface.getCanvas();
      
      // 3️⃣ 白い背景を描画
      canvas.clear(Skia.Color('#FFFFFF'));
      console.log('🖼️ White background applied');
      
      // 4️⃣ 元の手書きを白い背景の上に描画
      canvas.drawImage(originalImage, 0, 0);
      console.log('🖼️ Original handwriting drawn on white background');
      
      // 5️⃣ 最終画像を取得してBase64で返却
      const finalImage = surface.makeImageSnapshot();
      if (!finalImage) {
        console.warn('🖼️ Failed to create final image');
        // フォールバック: 元の透明背景画像を返す
        const base64 = originalImage.encodeToBase64();
        return `data:image/png;base64,${base64}`;
      }
      
      const base64 = finalImage.encodeToBase64();
      console.log('🖼️ Final image with white background created:', {
        originalSize: originalImage.encodeToBase64().length,
        finalSize: base64.length
      });
      
      return `data:image/png;base64,${base64}`;
    } catch (err) {
      console.warn('🖼️ captureHandwriting error:', err);
      // エラー時のフォールバック: 元の方法で取得
      try {
        const image = canvasRef.current?.makeImageSnapshot();
        if (!image) return null;
        const base64 = image.encodeToBase64();
        return `data:image/png;base64,${base64}`;
      } catch (fallbackErr) {
        console.warn('🖼️ Fallback captureHandwriting also failed:', fallbackErr);
        return null;
      }
    }
  }, [canvasRef]);

  // ref にメソッドを公開
  useImperativeHandle(ref, () => ({
    captureHandwriting,
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.canvasContainer}>
          <Canvas
            ref={canvasRef}
            style={styles.canvas}
          >
            <Group>
              {/* 🎨 保存済みのパスを描画 */}
              {paths.map((drawingPath, index) => {
                if (!drawingPath.path) return null;
                
                const pathObj = Skia.Path.MakeFromSVGString(drawingPath.path);
                if (!pathObj) return null;
                
                const pathStyle = getPathStyle(drawingPath);
                
                return (
                  <Path
                    key={`${drawingPath.timestamp}-${index}`}
                    path={pathObj}
                    {...pathStyle}
                  />
                );
              })}
              
              {/* 🚀 現在描画中のパス */}
              {currentPath && currentPath.path && (
                (() => {
                  const currentPathObj = Skia.Path.MakeFromSVGString(currentPath.path);
                  if (!currentPathObj) return null;
                  
                  const currentPathStyle = getPathStyle(currentPath);
                  
                  return (
                    <Path
                      path={currentPathObj}
                      {...currentPathStyle}
                    />
                  );
                })()
              )}
              
              {/* 🗑️ 消しゴムカーソル */}
              {showEraserCursor && eraserPosition && (
                <Circle
                  cx={eraserPosition.x}
                  cy={eraserPosition.y}
                  r={15}
                  color="rgba(255, 0, 0, 0.3)"
                  style="stroke"
                  strokeWidth={2}
                />
              )}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  debugInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
    maxWidth: 300,
  },
  debugText: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

export default forwardRef(DrawingCanvasInner); 