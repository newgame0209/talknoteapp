import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { signOut } from '../services/auth';
import { Ionicons } from '@expo/vector-icons';

const Settings: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 一時的なログアウト機能（UI確認用）
  const handleLogout = async () => {
    Alert.alert(
      'ログアウト',
      '新しいログイン画面のデザインを確認するためにログアウトしますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              console.log('✅ ログアウト完了');
              navigation.navigate('WelcomeLogin' as never);
            } catch (error: any) {
              console.error('❌ ログアウトエラー:', error);
              Alert.alert('エラー', 'ログアウトに失敗しました');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>設定</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>アカウント情報</Text>
        <Text style={styles.userInfo}>
          {user?.email || 'ユーザー情報なし'}
        </Text>

        {/* 一時的なログアウトボタン（UI確認用） */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔍 デザイン確認用</Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>ログアウト（新しいログイン画面を確認）</Text>
          </TouchableOpacity>
          <Text style={styles.debugNote}>
            ※ 新しいログイン画面のデザインを確認するための一時的な機能です
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  debugSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  debugNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default Settings; 