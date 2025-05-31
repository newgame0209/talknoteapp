import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Dimensions, Text } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  useCanvasRef,
} from '@shopify/react-native-skia';

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

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  selectedTool,
  selectedColor,
  strokeWidth,
  onPathsChange,
  paths,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
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
    console.log('🔍 DrawingCanvas: paths prop changed:', {
      pathsLength: paths.length,
      paths: paths.map((p, i) => ({ 
        index: i, 
        tool: p.tool, 
        color: p.color, 
        timestamp: p.timestamp,
        pathLength: p.path.length
      }))
    });
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
    
    // 📐 座標の間引き処理（パフォーマンス向上）
    const filteredPoints = SmoothDrawing.filterPoints(points, 2);
    
    // 🌊 スムーズなベジェ曲線パスを生成
    const smoothPath = SmoothDrawing.createSmoothPath(filteredPoints);
    
    const updatedPath = {
      ...currentPathRef.current,
      path: smoothPath
    };
    
    setCurrentPath(updatedPath);
    currentPathRef.current = updatedPath;
  }, []);

  // PanResponder for touch handling - スムーズ描画対応版
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const currentTool = selectedToolRef.current;
        const shouldSet = currentTool !== null && currentTool !== undefined;
        setDebugInfo(`Should set: ${shouldSet}, tool:'${currentTool}'`);
        return shouldSet;
      },
      onMoveShouldSetPanResponder: () => selectedToolRef.current !== null,
      
      onPanResponderGrant: (event) => {
        const currentTool = selectedToolRef.current;
        if (!currentTool) {
          setDebugInfo('Grant: No tool selected');
          return;
        }
        
        const { locationX, locationY } = event.nativeEvent;
        const x = locationX || 50;
        const y = locationY || 50;
        
        const newPath = createNewPath();
        if (!newPath) {
          setDebugInfo('Grant: Failed to create path');
          return;
        }
        
        // 📐 座標配列を初期化
        currentPointsRef.current = [{ x, y }];
        
        // 初期パス（単一点）
        newPath.path = `M${x.toFixed(3)},${y.toFixed(3)}`;
        
        setCurrentPath(newPath);
        currentPathRef.current = newPath;
        setIsDrawing(true);
        setMoveCount(0);
        
        setDebugInfo(`Grant: x=${x.toFixed(1)}, y=${y.toFixed(1)}, tool=${currentTool}`);
      },
      
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        const x = locationX || 50;
        const y = locationY || 50;
        
        setMoveCount(prev => prev + 1);
        
        const currentTool = selectedToolRef.current;
        if (!currentTool || !currentPathRef.current) {
          setDebugInfo(`Move ${moveCount}: No tool or path`);
          return;
        }
        
        // 📐 新しい座標を配列に追加
        currentPointsRef.current.push({ x, y });
        
        // 🚀 座標配列からスムーズパスを生成
        updateCurrentPathFromPoints(currentPointsRef.current);
        
        setDebugInfo(`Move ${moveCount}: Points=${currentPointsRef.current.length}, tool=${currentTool}`);
      },
      
      onPanResponderRelease: () => {
        const pathExists = currentPathRef.current !== null;
        const pointCount = currentPointsRef.current.length;
        
        console.log('🎨 DrawingCanvas: onPanResponderRelease called', {
          pathExists,
          pointCount,
          currentPathsLength: pathsRef.current.length,
          currentTool: selectedToolRef.current
        });
        
        setDebugInfo(`Release: path=${pathExists ? 'exists' : 'null'}, points=${pointCount}`);
        
        if (currentPathRef.current && pointCount > 0) {
          // 🎯 最終的なスムーズパスを生成
          const finalFilteredPoints = SmoothDrawing.filterPoints(currentPointsRef.current, 1.5);
          const finalSmoothPath = SmoothDrawing.createSmoothPath(finalFilteredPoints);
          
          const finalPath = {
            ...currentPathRef.current,
            path: finalSmoothPath
          };
          
          // 🔧 常に最新のpaths配列を参照
          const newPaths = [...pathsRef.current, finalPath];
          
          console.log('🚀 DrawingCanvas: Saving new path', {
            finalPath: {
              tool: finalPath.tool,
              color: finalPath.color,
              timestamp: finalPath.timestamp,
              pathLength: finalPath.path.length
            },
            existingPathsLength: pathsRef.current.length,
            newPathsLength: newPaths.length,
            newPaths: newPaths.map((p, i) => ({ 
              index: i, 
              tool: p.tool, 
              timestamp: p.timestamp,
              pathLength: p.path.length
            }))
          });
          
          setDebugInfo(`Release: Saved smooth path with ${finalFilteredPoints.length} points`);
          onPathsChange(newPaths);
        } else {
          setDebugInfo(`Release: NOT saved - no path or points`);
          console.log('❌ DrawingCanvas: Path NOT saved - no path or points');
        }
        
        // 🧹 クリーンアップ
        setCurrentPath(null);
        currentPathRef.current = null;
        currentPointsRef.current = [];
        setIsDrawing(false);
        setMoveCount(0);
      },
      
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

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
      case 'eraser':
        return {
          ...baseStyle,
          color: 'white',
          strokeWidth: drawingPath.strokeWidth * 3.5, // 消しゴムは大きく
          blendMode: 'clear' as const,
        };
      default:
        return {
          ...baseStyle,
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
        };
    }
  };

  return (
    <View style={styles.container}>
      {/* デバッグ情報表示 - 開発時のみ表示 */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>📊 Debug: {debugInfo}</Text>
          <Text style={styles.debugText}>🎨 Tool: {selectedTool || 'null'}</Text>
          <Text style={styles.debugText}>🌈 Color: {selectedColor}</Text>
          <Text style={styles.debugText}>📏 Width: {strokeWidth}px</Text>
          <Text style={styles.debugText}>💾 Saved Paths: {paths.length}</Text>
          <Text style={styles.debugText}>✏️ Drawing: {isDrawing ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>📐 Points: {currentPointsRef.current?.length || 0}</Text>
          <Text style={styles.debugText}>🔄 Moves: {moveCount}</Text>
          
          {/* 📋 Paths配列の詳細表示 */}
          <Text style={styles.debugText}>--- Paths Details ---</Text>
          {paths.map((path, index) => (
            <Text key={index} style={styles.debugText} numberOfLines={1}>
              #{index}: {path.tool}({path.color.substring(0,7)}) t:{path.timestamp.toString().slice(-4)}
            </Text>
          ))}
          
          {/* 🚀 現在のパス情報 */}
          {currentPath && (
            <Text style={styles.debugText} numberOfLines={1}>
              🚀 Current: {currentPath.tool}({currentPath.color.substring(0,7)}) len:{currentPath.path.length}
            </Text>
          )}
          
          {/* 📦 Props vs State 比較 */}
          <Text style={styles.debugText}>Props→State: {paths.length} paths received</Text>
          <Text style={styles.debugText}>🌊 Smooth Drawing v2.1</Text>
        </View>
      )}
      
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Canvas
          ref={canvasRef}
          style={styles.canvas}
        >
          <Group>
            {/* 保存済みパスを描画 - 常に表示 */}
            {paths.map((drawingPath, index) => {
              const pathStyle = getPathStyle(drawingPath);
              try {
                const skiaPath = Skia.Path.MakeFromSVGString(drawingPath.path);
                return skiaPath ? (
                  <Path
                    key={`saved-${drawingPath.timestamp}-${index}`}
                    path={skiaPath}
                    {...pathStyle}
                  />
                ) : null;
              } catch (error) {
                console.log('Invalid saved path:', drawingPath.path);
                return null;
              }
            })}
            
            {/* 現在描画中のパスを描画 */}
            {currentPath && currentPath.path && (
              (() => {
                try {
                  const skiaPath = Skia.Path.MakeFromSVGString(currentPath.path);
                  return skiaPath ? (
                    <Path
                      key={`current-${currentPath.timestamp}`}
                      path={skiaPath}
                      {...getPathStyle(currentPath)}
                    />
                  ) : null;
                } catch (error) {
                  console.log('Invalid current path:', currentPath.path);
                  return null;
                }
              })()
            )}
          </Group>
        </Canvas>
      </View>
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

export default DrawingCanvas; 