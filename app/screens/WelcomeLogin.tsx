import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { signInWithGoogle, signInWithApple } from '../services/auth';
import { authHelpers } from '../services/firebase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

/**
 * WelcomeLoginスクリーン
 * 参考デザインに基づいた新しい認証UI
 * 
 * 機能:
 * - ログイン/新規登録画面の切り替え
 * - 3つのSSO認証ボタン（Google、LINE、Apple）
 * - Email/Password認証
 * - 利用規約・プライバシーポリシー同意チェック
 * - パスワード表示/非表示切り替え
 */

const WelcomeLogin: React.FC = () => {
  const navigation = useNavigation();
  const { user, isLoading, error, signIn, signUp, clearError } = useAuthStore();
  
  // 画面状態（ログイン or 新規登録）
  const [isSignUp, setIsSignUp] = useState(false);
  
  // フォーム状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 新規登録時のチェックボックス
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [acceptEmails, setAcceptEmails] = useState(false);
  
  // Apple認証の可用性
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // 認証済みユーザーは自動で遷移
  useEffect(() => {
    if (user) {
      console.log('✅ 認証済みユーザー、ダッシュボードに遷移');
      navigation.navigate('Dashboard' as never);
    }
  }, [user, navigation]);

  // Apple認証の可用性チェック
  useEffect(() => {
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
        console.log('🍎 Apple認証可用性:', isAvailable);
      }
    };
    
    checkAppleAuth();
  }, []);

  // エラークリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Email/Passwordログイン
  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    // 新規登録時の利用規約チェック
    if (isSignUp && !agreeToTerms) {
      Alert.alert('エラー', '利用規約およびプライバシーポリシーに同意してください');
      return;
    }

    try {
      setFormLoading(true);
      if (isSignUp) {
        await signUp(email.trim(), password);
        Alert.alert('成功', 'アカウントが作成されました');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: any) {
      console.error('Email認証エラー:', error);
      Alert.alert('エラー', error.message || '認証に失敗しました');
    } finally {
      setFormLoading(false);
    }
  };

  // Google認証
  const handleGoogleSignIn = async () => {
    try {
      setFormLoading(true);
      console.log('🚀 Google認証開始');
      
      const user = await signInWithGoogle();
      console.log('✅ Google認証成功:', user.email);
      
      // 成功通知を表示
      Alert.alert('ログイン完了', 'Googleアカウントでログインしました', [
        { text: 'OK', style: 'default' }
      ]);
      
    } catch (error: any) {
      console.error('Google認証エラー:', error);
      Alert.alert('エラー', error.message || 'Google認証に失敗しました');
    } finally {
      setFormLoading(false);
    }
  };

  // Apple認証
  const handleAppleSignIn = async () => {
    if (!appleAuthAvailable) {
      Alert.alert('エラー', 'Apple Sign Inが利用できません');
      return;
    }

    try {
      setFormLoading(true);
      console.log('🍎 Apple認証開始');
      
      const user = await signInWithApple();
      console.log('✅ Apple認証成功:', user.email);
      
      // 成功通知を表示
      Alert.alert('ログイン完了', 'Apple IDでログインしました', [
        { text: 'OK', style: 'default' }
      ]);
      
    } catch (error: any) {
      console.error('Apple認証エラー:', error);
      
      if (!error.message?.includes('キャンセル')) {
        Alert.alert('エラー', error.message || 'Apple認証に失敗しました');
      }
    } finally {
      setFormLoading(false);
    }
  };

  // パスワードリセット
  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('メールアドレスを入力してください', 'パスワードリセット用のメールアドレスを入力してください');
      return;
    }
    Alert.alert('準備中', 'パスワードリセット機能は準備中です');
  };

  // 画面切り替え
  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setAgreeToTerms(false);
    setAcceptEmails(false);
    clearError();
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>認証状態を確認中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>{isSignUp ? '新規登録' : 'ログイン'}</Text>
          </View>

          {/* SSO認証ボタン - Google、Apple */}
          <View style={styles.ssoContainer}>
            {/* Google認証 - 公式ロゴ */}
            <TouchableOpacity 
              style={styles.ssoButton}
              onPress={handleGoogleSignIn}
              disabled={formLoading}
            >
              <View style={styles.ssoIconContainer}>
                <Ionicons name="logo-google" size={24} color="#4285F4" />
              </View>
            </TouchableOpacity>

            {/* Apple認証（iOS限定） - 公式ロゴ */}
            {Platform.OS === 'ios' && appleAuthAvailable && (
              <TouchableOpacity 
                style={styles.ssoButton}
                onPress={handleAppleSignIn}
                disabled={formLoading}
              >
                <View style={styles.ssoIconContainer}>
                  <Ionicons name="logo-apple" size={24} color="#000" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* 区切り線 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* エラー表示 */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* メール登録フォーム */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>通常登録</Text>
            
            <TextInput
              style={styles.input}
              placeholder="メールアドレス"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!formLoading}
            />
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="パスワード"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!formLoading}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
            </View>

            {/* 新規登録時のチェックボックス */}
            {isSignUp && (
              <View style={styles.checkboxContainer}>
                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setAgreeToTerms(!agreeToTerms)}
                >
                  <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                    {agreeToTerms && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    利用規約およびプライバシーポリシーに同意する
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setAcceptEmails(!acceptEmails)}
                >
                  <View style={[styles.checkbox, acceptEmails && styles.checkboxChecked]}>
                    {acceptEmails && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    しゃべるノートからのお知らせメールを受け取る
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* メインアクションボタン */}
            <TouchableOpacity 
              style={[
                styles.primaryButton, 
                (formLoading || (!email.trim() || !password.trim() || (isSignUp && !agreeToTerms))) && styles.primaryButtonDisabled
              ]}
              onPress={handleEmailAuth}
              disabled={formLoading || !email.trim() || !password.trim() || (isSignUp && !agreeToTerms)}
            >
              {formLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? '新規登録' : 'ログイン'}
                </Text>
              )}
            </TouchableOpacity>

            {/* パスワードを忘れた場合（ログイン時のみ） */}
            {!isSignUp && (
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
                disabled={formLoading}
              >
                <Text style={styles.forgotPasswordText}>パスワードをお忘れの場合</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 画面切り替えリンク */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isSignUp ? '既にアカウントをお持ちの方 ' : 'まだアカウントを持っていませんか？ '}
            </Text>
            <TouchableOpacity onPress={switchMode} disabled={formLoading}>
              <Text style={styles.switchLink}>
                {isSignUp ? 'ログイン' : '新規登録'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* セキュリティ情報 */}
          <View style={styles.securityContainer}>
            <View style={styles.securityBadges}>
              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              </View>
              <View style={styles.securityBadge}>
                <Text style={styles.securityBadgeText}>APPI</Text>
              </View>
            </View>
            <Text style={styles.securityText}>データは安全に保護されています</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 60,
    paddingTop: 20,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // backButtonの分だけオフセット
  },
  ssoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  ssoButton: {
    width: 60,
    height: 60,
    marginHorizontal: 16,
  },
  ssoIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginHorizontal: 16,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#111827',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    paddingRight: 50,
    color: '#111827',
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  checkboxContainer: {
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#4F46E5',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  switchText: {
    fontSize: 14,
    color: '#6B7280',
  },
  switchLink: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  securityContainer: {
    alignItems: 'center',
  },
  securityBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  securityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  securityText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default WelcomeLogin; 