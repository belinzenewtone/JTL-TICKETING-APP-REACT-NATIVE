/**
 * Shared profile screen — used by both (admin) and (portal) tab groups.
 * Eliminates ~95% code duplication between the two profile screens.
 */
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, Shield, LogOut, Smartphone } from 'lucide-react-native';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrator',
    IT_STAFF: 'IT Staff',
    USER: 'Staff User',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ADMIN:    { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    IT_STAFF: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    USER:     { bg: '#d1fae5', text: '#059669', border: '#a7f3d0' },
};

export function ProfileScreen() {
    const { user, clearAuth } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out', style: 'destructive',
                onPress: async () => {
                    await clearAuth();
                    queryClient.clear();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    if (!user) return null;

    const initials = user.name
        ?.split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? '??';

    const roleStyle = ROLE_COLORS[user.role] ?? ROLE_COLORS.USER;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <Text style={styles.pageTitle}>Profile</Text>

            <View style={styles.container}>
                {/* Avatar */}
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <Text style={styles.name}>{user.name}</Text>

                {/* Role badge */}
                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg, borderColor: roleStyle.border }]}>
                    <Text style={[styles.roleText, { color: roleStyle.text }]}>
                        {ROLE_LABELS[user.role] ?? user.role}
                    </Text>
                </View>

                {/* Info card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <View style={styles.iconWrap}>
                            <Mail size={16} color="#6b7280" />
                        </View>
                        <View style={styles.infoText}>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{user.email}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <View style={styles.iconWrap}>
                            <Shield size={16} color="#6b7280" />
                        </View>
                        <View style={styles.infoText}>
                            <Text style={styles.infoLabel}>Account Type</Text>
                            <Text style={styles.infoValue}>{ROLE_LABELS[user.role] ?? user.role}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <View style={styles.iconWrap}>
                            <Smartphone size={16} color="#6b7280" />
                        </View>
                        <View style={styles.infoText}>
                            <Text style={styles.infoLabel}>App Version</Text>
                            <Text style={styles.infoValue}>1.0.0</Text>
                        </View>
                    </View>
                </View>

                <Button
                    mode="outlined"
                    onPress={handleLogout}
                    textColor="#dc2626"
                    style={styles.logoutBtn}
                    contentStyle={styles.logoutContent}
                    icon={() => <LogOut size={18} color="#dc2626" />}
                >
                    Sign Out
                </Button>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    pageTitle: {
        fontSize: 26, fontWeight: '800', color: '#111827',
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    },
    container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14, borderWidth: 3, borderColor: '#a7f3d0',
    },
    avatarText: { fontSize: 28, fontWeight: '800', color: '#059669' },
    name: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
    roleBadge: {
        paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
        borderWidth: 1, marginBottom: 28,
    },
    roleText: { fontSize: 13, fontWeight: '600' },
    infoCard: {
        width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 4, elevation: 2, marginBottom: 24,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
    iconWrap: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
    },
    infoText: { flex: 1 },
    infoLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
    infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },
    logoutBtn: { width: '100%', borderColor: '#fca5a5', borderRadius: 12 },
    logoutContent: { height: 48 },
});
