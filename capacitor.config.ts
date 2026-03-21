import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.picklescore.app',
  appName: 'PickleScore',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1e1e2e',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'none',
    },
    StatusBar: {
      style: 'Dark',
      overlaysWebView: false,
    },
  },
};

export default config;
