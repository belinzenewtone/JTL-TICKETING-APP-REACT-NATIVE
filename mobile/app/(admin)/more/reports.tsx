import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, BarChart3, CheckSquare, Mail, Monitor, ShoppingCart, Ticket } from 'lucide-react-native';
import { reportsApi } from '@/api/client';

const RANGES = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
] as const;

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
    return (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
            {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
        </View>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                {icon}
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.cardGrid}>{children}</View>
        </View>
    );
}

export default function ReportsScreen() {
    const router = useRouter();
    const [range, setRange] = useState<'today' | 'week' | 'month' | 'year'>('month');

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['reports', range],
        queryFn: () => reportsApi.get(range).then(r => r.data as any),
    });

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Reports</Text>
            </View>

            {/* Range tabs */}
            <View style={styles.rangeRow}>
                {RANGES.map(r => (
                    <TouchableOpacity
                        key={r.key}
                        style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
                        onPress={() => setRange(r.key)}
                    >
                        <Text style={[styles.rangeChipText, range === r.key && styles.rangeChipTextActive]}>
                            {r.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {data && (
                <Text style={styles.period}>
                    {data.period.from} → {data.period.to}
                </Text>
            )}

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor="#059669" />}
            >
                {!data && isLoading ? (
                    <Text style={styles.loading}>Loading report…</Text>
                ) : data ? (
                    <>
                        <Section title="Tickets" icon={<Ticket size={18} color="#059669" />}>
                            <StatCard label="Total" value={data.tickets.total} color="#059669" />
                            <StatCard label="Open" value={data.tickets.open} color="#b45309" />
                            <StatCard label="Resolved" value={data.tickets.resolved} color="#1d4ed8" />
                            <StatCard label="Critical" value={data.tickets.critical} color="#dc2626" />
                        </Section>

                        <Section title="Tasks" icon={<CheckSquare size={18} color="#7c3aed" />}>
                            <StatCard label="Total" value={data.tasks.total} color="#7c3aed" />
                            <StatCard label="Completed" value={data.tasks.completed} color="#059669" />
                            <StatCard label="Pending" value={data.tasks.pending} color="#b45309" />
                            <StatCard label="Urgent" value={data.tasks.urgent} color="#dc2626" />
                        </Section>

                        <Section title="Email Entries" icon={<Mail size={18} color="#0284c7" />}>
                            <StatCard label="Total" value={data.entries.total} color="#0284c7" />
                            <StatCard label="Sorted" value={data.entries.sorted} color="#059669" />
                            <StatCard label="Pending" value={data.entries.pending} color="#b45309" />
                        </Section>

                        <Section title="Machine Requests" icon={<Monitor size={18} color="#be185d" />}>
                            <StatCard label="Total" value={data.machines.total} color="#be185d" />
                            <StatCard label="Fulfilled" value={data.machines.fulfilled} color="#059669" />
                            <StatCard label="Pending" value={data.machines.pending} color="#b45309" />
                        </Section>

                        <Section title="Procurement" icon={<ShoppingCart size={18} color="#b45309" />}>
                            <StatCard label="Total" value={data.procurement.total} color="#b45309" />
                            <StatCard label="Active" value={data.procurement.active} color="#1d4ed8" />
                            <StatCard label="Delivered" value={data.procurement.delivered} color="#059669" />
                        </Section>

                        {data.tickets.by_category?.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <BarChart3 size={18} color="#059669" />
                                    <Text style={styles.sectionTitle}>Tickets by Category</Text>
                                </View>
                                {data.tickets.by_category.map((c: { category: string; count: number }) => (
                                    <View key={c.category} style={styles.catRow}>
                                        <Text style={styles.catLabel}>{c.category.replace(/-/g, ' ')}</Text>
                                        <View style={styles.catBarBg}>
                                            <View style={[styles.catBarFill, {
                                                width: `${Math.round((c.count / Math.max(data.tickets.total, 1)) * 100)}%` as any
                                            }]} />
                                        </View>
                                        <Text style={styles.catCount}>{c.count}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { padding: 4, marginRight: 10 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827' },
    rangeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 6 },
    rangeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    rangeChipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    rangeChipText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
    rangeChipTextActive: { color: '#059669', fontWeight: '700' },
    period: { fontSize: 12, color: '#9ca3af', paddingHorizontal: 16, marginBottom: 8 },
    scroll: { padding: 16, paddingTop: 4, paddingBottom: 32 },
    loading: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
    section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: { flex: 1, minWidth: '45%', borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6 },
    statValue: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    statSub: { fontSize: 11, color: '#9ca3af' },
    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    catLabel: { fontSize: 12, color: '#374151', width: 110, textTransform: 'capitalize' },
    catBarBg: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
    catBarFill: { height: 8, backgroundColor: '#059669', borderRadius: 4 },
    catCount: { fontSize: 12, color: '#6b7280', width: 24, textAlign: 'right' },
});
