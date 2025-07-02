import { Dimensions, Platform } from 'react-native';

/**
 * デバイスがタブレット（iPad含む）かどうかを判定
 * @returns {boolean} タブレットの場合はtrue
 */
export const isTablet = (): boolean => {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = width / height;
  const screenSize = Math.min(width, height);
  
  // iPad Mini以上のサイズを対象（画面の短辺が600px以上）
  return screenSize >= 600;
};

/**
 * デバイスがiPadかどうかを判定
 * @returns {boolean} iPadの場合はtrue
 */
export const isIPad = (): boolean => {
  return Platform.OS === 'ios' && isTablet();
};

/**
 * デバイスがAndroidタブレットかどうかを判定
 * @returns {boolean} Androidタブレットの場合はtrue
 */
export const isAndroidTablet = (): boolean => {
  return Platform.OS === 'android' && isTablet();
};

/**
 * デバイス情報を取得
 * @returns {object} デバイス情報オブジェクト
 */
export const getDeviceInfo = () => {
  const { width, height } = Dimensions.get('window');
  const isTab = isTablet();
  
  return {
    isTablet: isTab,
    isIPad: isIPad(),
    isAndroidTablet: isAndroidTablet(),
    screenWidth: width,
    screenHeight: height,
    aspectRatio: width / height,
    deviceType: isTab ? 'tablet' : 'mobile',
  };
}; 