import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  useTouchHandler,
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
  const pathRef = useRef<string>('');

  // 現在描画中のパスを作成
  const createNewPath = useCallback(() => {
    if (!selectedTool) return null;
    
    return {
      path: '',
      color: selectedColor,
      strokeWidth: strokeWidth,
      tool: selectedTool,
      timestamp: Date.now(),
    };
  }, [selectedTool, selectedColor, strokeWidth]);

  // タッチハンドラー
  const touchHandler = useTouchHandler({
    onStart: (touchInfo) => {
      if (!selectedTool) return;
      
      const { x, y } = touchInfo;
      const newPath = createNewPath();
      if (!newPath) return;
      
      const skiaPath = Skia.Path.Make();
      skiaPath.moveTo(x, y);
      pathRef.current = skiaPath.toSVGString();
      
      newPath.path = pathRef.current;
      setCurrentPath(newPath);
    },
    onActive: (touchInfo) => {
      if (!selectedTool || !currentPath) return;
      
      const { x, y } = touchInfo;
      const skiaPath = Skia.Path.MakeFromSVGString(pathRef.current);
      
      if (skiaPath) {
        skiaPath.lineTo(x, y);
        pathRef.current = skiaPath.toSVGString();
        
        setCurrentPath(prev => prev ? {
          ...prev,
          path: pathRef.current
        } : null);
      }
    },
    onEnd: () => {
      if (currentPath && pathRef.current) {
        const newPaths = [...paths, { ...currentPath, path: pathRef.current }];
        onPathsChange(newPaths);
        setCurrentPath(null);
        pathRef.current = '';
      }
    },
  });

  // ツール別のスタイル設定
  const getPathStyle = (drawingPath: DrawingPath) => {
    switch (drawingPath.tool) {
      case 'pen':
        return {
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
          style: 'stroke' as const,
          strokeCap: 'round' as const,
          strokeJoin: 'round' as const,
        };
      case 'pencil':
        return {
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
          style: 'stroke' as const,
          strokeCap: 'round' as const,
          strokeJoin: 'round' as const,
          opacity: 0.7,
        };
      case 'marker':
        return {
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth * 2, // マーカーは太め
          style: 'stroke' as const,
          strokeCap: 'round' as const,
          strokeJoin: 'round' as const,
          opacity: 0.6,
        };
      case 'eraser':
        return {
          color: 'white',
          strokeWidth: drawingPath.strokeWidth * 3, // 消しゴムは太め
          style: 'stroke' as const,
          strokeCap: 'round' as const,
          strokeJoin: 'round' as const,
          blendMode: 'clear' as const,
        };
      default:
        return {
          color: drawingPath.color,
          strokeWidth: drawingPath.strokeWidth,
          style: 'stroke' as const,
        };
    }
  };

  return (
    <View style={styles.container}>
      <Canvas
        ref={canvasRef}
        style={styles.canvas}
        onTouch={touchHandler}
      >
        <Group>
          {/* 保存済みパスを描画 */}
          {paths.map((drawingPath, index) => {
            const pathStyle = getPathStyle(drawingPath);
            return (
              <Path
                key={`${drawingPath.timestamp}-${index}`}
                path={drawingPath.path}
                {...pathStyle}
              />
            );
          })}
          
          {/* 現在描画中のパスを描画 */}
          {currentPath && (
            <Path
              path={currentPath.path}
              {...getPathStyle(currentPath)}
            />
          )}
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default DrawingCanvas; 