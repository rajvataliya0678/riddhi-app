import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vriddhi.app',
  appName: 'Vriddhi',
  webDir: 'public',
  server: {
    url: 'https://vriddhi-app-eight.vercel.app',
    cleartext: true
  }
};

export default config;
