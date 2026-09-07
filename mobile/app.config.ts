import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'JTL Ticketing',
    slug: 'jtl-ticketing',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic', // support light + dark mode
    newArchEnabled: true,
    splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
    },
    android: {
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#ffffff',
        },
        package: 'com.jtl.ticketing',
        permissions: [],
    },
    ios: {
        bundleIdentifier: 'com.jtl.ticketing',
        buildNumber: '1',
        supportsTablet: true,
    },
    plugins: [
        'expo-router',
        'expo-secure-store',
        'expo-asset',
        ['expo-splash-screen', { backgroundColor: '#ffffff', image: './assets/splash.png' }],
    ],
    scheme: 'jtl-ticketing',
    experiments: {
        typedRoutes: true,
    },
    extra: {
        // Set EXPO_PUBLIC_API_URL in .env to override (e.g. for staging/dev)
        apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://ticketingjtl.vercel.app/api/mobile',
    },
});
