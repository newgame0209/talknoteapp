import { 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithCustomToken,
} from 'firebase/auth';
import { auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – GoogleSignin is a CommonJS module; dynamic import handled by Metro
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { resetLocalDatabase } from './database';

/**
 * Google Sign-In の初期化
 * react-native-google-signin用の正しい設定
 * ⚠️ SERVER_CLIENT_IDを使用（GoogleService-Info.plistから確認済み）
 */
GoogleSignin.configure({
  scopes: ['email', 'profile'],
  iosClientId: '309882614658-gql2t1kodc74bt80qeaqbq89gsguehm1.apps.googleusercontent.com',
  webClientId: '309882614658-3o2hdltohh0ge5lthr1p9v2tejpm9kqd.apps.googleusercontent.com',
  offlineAccess: false,
  hostedDomain: '',
  forceCodeForRefreshToken: true,
});

/**
 * 🚀 Google認証（react-native-google-signin使用）
 * 確実で安定した実装
 */
export const signInWithGoogle = async (): Promise<User> => {
  try {
    console.log('🚀 Google認証開始（react-native-google-signin）');

    // Google Sign-Inの可用性チェック
    const hasGoogleServices = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    
    if (!hasGoogleServices) {
      throw new Error('Google Play Servicesが利用できません');
    }

    console.log('✅ Google Play Services利用可能');

    // Googleアカウント選択画面を表示
    let signInResult: any = await GoogleSignin.signIn();
    console.log('[DEBUG] Google signIn raw result:', signInResult);

    // Expo Go 環境では { type: 'success', data: {...} } 形式で返る場合がある
    if (signInResult && signInResult.type === 'success' && signInResult.data) {
      signInResult = signInResult.data;
    }

    if (!signInResult || !signInResult.user) {
      throw new Error('Google Sign-In でユーザー情報が取得できませんでした');
    }

    const userInfo = signInResult;
    
    console.log('✅ Google認証成功:', {
      email: userInfo.user.email,
      name: userInfo.user.name,
      hasIdToken: !!userInfo.idToken,
    });

    if (!userInfo.idToken) {
      throw new Error('ID Tokenが取得できませんでした');
    }

    // FirebaseのGoogleAuthProviderでサインイン
    const credential = GoogleAuthProvider.credential(userInfo.idToken);
    const userCredential = await signInWithCredential(auth, credential);

    console.log('🎉 Firebase認証成功:', {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
    });

    // 認証状態を永続化
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userId', userCredential.user.uid);
    await AsyncStorage.setItem('idToken', userInfo.idToken);
    
    await AsyncStorage.setItem('lastUid', userCredential.user.uid);
    
    return userCredential.user;

  } catch (error: any) {
    console.error('❌ Google認証エラー:', error);
    
    // キャンセルの場合は特別なメッセージ
    if (error.code === 'SIGN_IN_CANCELLED') {
      throw new Error('Google認証がキャンセルされました');
    }
    
    throw new Error(`Google認証に失敗しました: ${error.message || error}`);
  }
};

/**
 * 🔗 LINE認証（WebベースOAuth2実装）
 * WebBrowserを使用してLINE Login APIを呼び出し
 */
export const signInWithLine = async (): Promise<User> => {
  try {
    console.log('🔗 LINE認証開始（Web OAuth2）');

    const channelId = '2007522487';
    // Expo Go 開発中は Expo AuthSession のプロキシ URL を使用
    // @ts-expect-error 型定義に useProxy が含まれていないバグ回避
    const redirectUri: string = AuthSession.makeRedirectUri({ useProxy: true });
    const state = Math.random().toString(36).substring(2, 15);
    const nonce = Math.random().toString(36).substring(2, 15);

    // LINE OAuth2認証URL
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&` +
      `client_id=${channelId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}&` +
      `scope=profile%20openid&` +
      `nonce=${nonce}`;

    console.log('🌐 LINE認証URLを開いています...');
    console.log('RedirectURI:', redirectUri);
    console.log('AuthURL:', authUrl);

    // WebBrowserでLINE認証画面を表示
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl, 
      redirectUri,
      {
        showInRecents: true,
        createTask: false,
      }
    );

    console.log('🔍 WebBrowser結果:', result.type);
    
    if (result.type !== 'success') {
      if (result.type === 'cancel') {
        throw new Error('LINE認証がキャンセルされました');
      }
      throw new Error(`LINE認証に失敗しました: ${result.type}`);
    }

    // 成功時のみurlプロパティが存在する
    const resultUrl = (result as any).url;
    console.log('🔍 WebBrowser URL:', resultUrl);

    if (!resultUrl) {
      throw new Error('LINE認証でリダイレクトURLが取得できませんでした');
    }

    // URLからauthorization codeを抽出
    const urlParams = new URLSearchParams(resultUrl.split('?')[1]);
    const code = urlParams.get('code');
    const returnedState = urlParams.get('state');

    if (!code) {
      throw new Error('LINE認証コードが取得できませんでした');
    }

    if (returnedState !== state) {
      throw new Error('LINE認証のセキュリティ検証に失敗しました');
    }

    console.log('✅ LINE認証コード取得成功');

    // アクセストークンを取得
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: 'f8bb9f7af957053eb83498ed600d61ef', // あなたのLINEチャンネルシークレット
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('TOKEN ERROR:', errorText);
      throw new Error('LINEアクセストークンの取得に失敗しました');
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ LINEアクセストークン取得成功');

    // ユーザープロフィールを取得
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('LINEプロフィール情報の取得に失敗しました');
    }

    const profileData = await profileResponse.json();
    console.log('✅ LINEプロフィール取得成功:', {
      userId: profileData.userId,
      displayName: profileData.displayName,
    });

    // Firebaseカスタムトークンを取得（開発用モック）
    const customToken = await verifyLineTokenWithFirebase(tokenData.access_token, profileData);
    
    // FirebaseのCustom Authenticationでサインイン
    const userCredential = await signInWithCustomToken(auth, customToken);

    console.log('🎉 Firebase LINE認証成功:', {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
    });

    // 認証状態を永続化
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userId', userCredential.user.uid);
    await AsyncStorage.setItem('idToken', tokenData.access_token);
    
    await AsyncStorage.setItem('lastUid', userCredential.user.uid);
    
    return userCredential.user;

  } catch (error: any) {
    console.error('❌ LINE認証エラー:', error);
    
    // キャンセルの場合は特別なメッセージ
    if (error.message?.includes('キャンセル')) {
      throw new Error('LINE認証がキャンセルされました');
    }
    
    throw new Error(`LINE認証に失敗しました: ${error.message || error}`);
  }
};

/**
 * LINEアクセストークンをFirebaseで検証してカスタムトークンを取得
 * ※本来はバックエンドAPIで処理すべき内容（開発用の簡易実装）
 */
const verifyLineTokenWithFirebase = async (lineAccessToken: string, profileData: any): Promise<string> => {
  try {
    console.log('🔄 LINE認証の検証中（開発用モック）...');
    
    // モック: プロフィール情報を含むカスタムトークン風の文字列を生成
    const mockCustomToken = btoa(JSON.stringify({
      iss: 'talknote-firebase-admin',
      sub: `line_${profileData.userId}`,
      aud: 'talknote-firebase',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      provider: 'line',
      lineUserId: profileData.userId,
      displayName: profileData.displayName,
      pictureUrl: profileData.pictureUrl,
      lineAccessToken: lineAccessToken
    }));

    console.log('✅ LINE認証検証完了（開発用）');
    return `mock.${mockCustomToken}.signature`;

  } catch (error: any) {
    console.error('❌ LINE認証検証エラー:', error);
    throw new Error(`LINE認証の検証に失敗しました: ${error.message}`);
  }
};

/**
 * 🍎 Apple認証（expo-apple-authentication使用）
 * Firebase側の設定完了済み
 */
export const signInWithApple = async (): Promise<User> => {
  try {
    console.log('🍎 Apple認証開始');

    // Apple認証の可用性チェック
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign Inが利用できません（iOS 13以降が必要）');
    }

    console.log('✅ Apple認証利用可能');

    // nonceの生成（セキュリティ強化）
    const nonce = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    console.log('🔐 Nonce生成完了');

    // NOTE: expo-apple-authentication の API には clientId オプションがなく、
    // aud はアプリの Bundle ID になります。
    // Firebase 側で「Bundle ID = com.yumishijikken.talknote」を登録することで
    // 認証が通ります。
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    console.log('✅ Apple認証成功:', {
      user: appleCredential.user,
      email: appleCredential.email,
      fullName: appleCredential.fullName,
      hasIdentityToken: !!appleCredential.identityToken,
    });

    if (!appleCredential.identityToken) {
      throw new Error('Apple Identity Tokenが取得できませんでした');
    }

    // FirebaseのOAuthProviderでサインイン
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken,
      rawNonce: nonce,
    });

    const userCredential = await signInWithCredential(auth, credential);

    console.log('🎉 Firebase Apple認証成功:', {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
    });

    // 認証状態を永続化
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userId', userCredential.user.uid);
    await AsyncStorage.setItem('idToken', appleCredential.identityToken);
    
    await AsyncStorage.setItem('lastUid', userCredential.user.uid);
    
    return userCredential.user;

  } catch (error: any) {
    console.error('❌ Apple認証エラー:', error);
    
    // キャンセルの場合は特別なメッセージ
    if (error.code === 'ERR_CANCELED') {
      throw new Error('Apple認証がキャンセルされました');
    }
    
    throw new Error(`Apple認証に失敗しました: ${error.message || error}`);
  }
};

/**
 * 📧 Email/Password認証
 */
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    console.log('📧 Email認証開始:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    console.log('✅ Email認証成功:', userCredential.user.email);
    
    // 認証状態を永続化
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userId', userCredential.user.uid);
    
    // ID Tokenを取得して保存
    const idToken = await userCredential.user.getIdToken();
    await AsyncStorage.setItem('idToken', idToken);
    
    await AsyncStorage.setItem('lastUid', userCredential.user.uid);
    
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ Email認証エラー:', error);
    throw new Error(error.message || 'Email認証に失敗しました');
  }
};

/**
 * 📝 新規ユーザー登録
 */
export const createAccount = async (email: string, password: string): Promise<User> => {
  try {
    console.log('📝 新規登録開始:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    console.log('✅ 新規登録成功:', userCredential.user.email);
    
    // 認証状態を永続化
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userId', userCredential.user.uid);
    
    // ID Tokenを取得して保存
    const idToken = await userCredential.user.getIdToken();
    await AsyncStorage.setItem('idToken', idToken);
    
    await AsyncStorage.setItem('lastUid', userCredential.user.uid);
    
    return userCredential.user;
  } catch (error: any) {
    console.error('❌ 新規登録エラー:', error);
    throw new Error(error.message || '新規登録に失敗しました');
  }
};

/**
 * 🚪 ログアウト
 */
export const signOut = async (): Promise<void> => {
  try {
    console.log('🚪 ログアウト開始');
    
    // Firebaseからサインアウト
    await firebaseSignOut(auth);
    console.log('✅ Firebase サインアウト完了');
    
    // ローカルストレージをクリア
    await AsyncStorage.multiRemove([
      'isAuthenticated',
      'userId',
      'idToken'
    ]);
    console.log('✅ ローカルストレージクリア完了');
    
    // サインアウト時点ではローカルDBは保持し、次回ログイン時にUID差分で判定してリセット
    console.log('🚪 Signed out successfully');
  } catch (error: any) {
    console.error('❌ ログアウトエラー:', error);
    throw new Error('サインアウトに失敗しました');
  }
};

/**
 * 🔑 現在のID Tokenを取得（API要求用）
 */
export const getCurrentIdToken = async (): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }
    
    // 新しいID Tokenを取得（自動更新）
    const idToken = await currentUser.getIdToken(true);
    await AsyncStorage.setItem('idToken', idToken);
    
    return idToken;
  } catch (error) {
    console.error('❌ ID Token取得エラー:', error);
    return null;
  }
};

/**
 * 👤 認証状態の監視
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * 🔍 ローカル認証状態をチェック
 */
export const checkLocalAuth = async (): Promise<boolean> => {
  try {
    const isAuthenticated = await AsyncStorage.getItem('isAuthenticated');
    return isAuthenticated === 'true';
  } catch (error) {
    console.error('❌ ローカル認証状態チェックエラー:', error);
    return false;
  }
}; 