const { withProjectBuildGradle, withPodfile } = require('@expo/config-plugins');

/**
 * Adds ML Kit Digital Ink Recognition native dependencies to Android & iOS projects.
 * Android : implementation("com.google.mlkit:digital-ink-recognition:18.3.0")
 * iOS     : pod 'GoogleMLKit/DigitalInkRecognition', '3.2.0'
 */
module.exports = function withDigitalInk(config) {
  // --- Android build.gradle ---
  config = withProjectBuildGradle(config, (gradleConfig) => {
    const dependencyLine = '    implementation("com.google.mlkit:digital-ink-recognition:18.3.0")';
    if (!gradleConfig.modResults.contents.includes('digital-ink-recognition')) {
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(/dependencies\s*{/, (match) => {
        return match + '\n' + dependencyLine;
      });
    }
    return gradleConfig;
  });

  // --- iOS Podfile ---
  config = withPodfile(config, (podfileConfig) => {
    const podLine = "  pod 'GoogleMLKit/DigitalInkRecognition', '~> 4.0.0'";
    
    // Podfileの内容をチェックして、まだ追加されていない場合のみ追加
    if (!podfileConfig.modResults.contents.includes('GoogleMLKit/DigitalInkRecognition')) {
      // target 'YourAppName' do の後に追加
      podfileConfig.modResults.contents = podfileConfig.modResults.contents.replace(
        /(target\s+['"][^'"]+['"]\s+do\s*\n)/,
        `$1${podLine}\n`
      );
    }
    return podfileConfig;
  });

  return config;
}; 