import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.framestack.app',
  appName: 'Framestack',
  webDir: 'dist/public',
  server: {
    // Use the live pplx.app site so the app hits the real backend
    url: 'https://framestack-pliplaplu.pplx.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0b0c14',
    allowMixedContent: false,
  },
};

export default config;
