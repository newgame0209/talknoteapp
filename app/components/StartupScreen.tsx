import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { styled } from 'nativewind';

// ブランド用シンプルなスタートアップ画面
// 認証・DB 初期化待機中に表示される (本番環境専用)

const StyledView = styled(View);
const StyledText = styled(Text);

interface StartupScreenProps {
  message?: string;
}

const StartupScreen: React.FC<StartupScreenProps> = ({ message = '起動中…' }) => {
  return (
    <StyledView className="flex-1 items-center justify-center bg-indigo-600">
      {/* アプリ名 or ロゴ */}
      <StyledText className="text-white text-3xl font-extrabold tracking-wider">しゃべるノート</StyledText>
      {/* 説明テキスト */}
      <StyledText className="text-white/80 mt-2 text-sm">{message}</StyledText>
      {/* 読み込みインジケータ */}
      <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: 24 }} />
    </StyledView>
  );
};

export default StartupScreen; 