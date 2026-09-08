import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, X, Plus, CheckCircle2, Circle, Mail, Pencil } from 'lucide-react-native';
import { entriesApi } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import type { Entry, ResolutionType } from '@/types/database';

const RESOLUTIONS: ResolutionType[] = ['sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'licensing'];
const RESOLUTION_LABELS: Record<ResolutionType, string> = {
    'sorted': 'Sorted', 'alt-email': 'Alt Email', 'alt-phone': 'Alt Phone',
    'alt-both': 'Alt Both', 'never-used': 'Never Used', 'licensing': 'Licensing',
};
const ALT_STATUS_OPTIONS = ['sorted', 'alt-email', 'alt-phone', 'alt-both', 'never-used', 'n/a'];

const RES_COLORS: Record<ResolutionType, { bg: string; text: string }> = {
    'sorted':     { bg: '#d1fae5', text: '#059669' },
    'alt-email':  { bg: '#dbeafe', text: '#1d4ed8' },
    'alt-phone':  { bg: '#ede9fe', text: '#7c3aed' },
    'alt-both':   { bg: '#fce7f3', text: '#be185d' },
    'never-used': { bg: '#f3f4f6', text: '#6b7280' },
    'licensing':  { bg: '#fef3c7', text: '#b45309' },
};

function EntryCard({ item, onToggle, onDelete, onEdit }: { item: Entry; onToggle: () => void; onDelete: () => void; onEdit: () => void }) {
    const res = RES_COLORS[item.resolution] ?? { bg: '#f3f4f6', text: '#6b7280' };
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {item.completed
                        ? <CheckCircle2 size={22} color="#059669" />
                        : <Circle size={22} color="#d1d5db" />
                    }
                </TouchableOpacity>
                <View style={styles.cardMeta}>
                    <Text style={[styles.cardName, item.completed && styles.strikethrough]}>{item.employee_name}</Text>
                    <Text style={styles.cardEmail}>{item.work_email}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: res.bg }]}>
                    <Text style={[styles.badgeText, { color: res.text }]}>{RESOLUTION_LABELS[item.resolution] ?? item.resolution}</Text>
                </View>
            </View>
            {item.alt_email_status && item.alt_email_status !== 'n/a' && (
                <Text style={styles.cardAlt}>Alt status: {item.alt_email_status}{item.alt_email ? ` · ${item.alt_email}` : ''}</Text>
            )}
            <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>{item.entry_date}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Pencil size={14} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.deleteBtn}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

export default function EntriesScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'sorted'>('all');
    const [createVisible, setCreateVisible] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
    const [form, setForm] = useState({
        employee_name: '',
        work_email: '',
        employee_phone: '',
        alt_email_status: 'n/a',
        alt_email: '',
        resolution: 'sorted' as ResolutionType,
    });
    const [editForm, setEditForm] = useState({ ...form });

    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filter === 'pending') params.completed = 'false';
    if (filter === 'sorted') params.completed = 'true';

    const { data: entries = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['entries', params],
        queryFn: () => entriesApi.list(params).then(r => r.data as Entry[]),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => entriesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            setEditingEntry(null);
        },
    });

    const openEdit = (entry: Entry) => {
        setEditingEntry(entry);
        setEditForm({
            employee_name: entry.employee_name,
            work_email: entry.work_email,
            employee_phone: entry.employee_phone ?? '',
            alt_email_status: entry.alt_email_status ?? 'n/a',
            alt_email: entry.alt_email ?? '',
            resolution: entry.resolution,
        });
    };

    const toggleMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            entriesApi.update(id, { completed }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => entriesApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
    });

    const createMutation = useMutation({
        mutationFn: (data: typeof form & { entry_date: string }) => entriesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            setCreateVisible(false);
            setForm({ employee_name: '', work_email: '', employee_phone: '', alt_email_status: 'n/a', alt_email: '', resolution: 'sorted' });
        },
    });

    const handleCreate = () => {
        if (!form.employee_name || !form.work_email || !form.resolution) return;
        createMutation.mutate({ ...form, entry_date: new Date().toISOString().split('T')[0] });
    };

    const confirmDelete = (id: string) => {
        Alert.alert('Delete Entry', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
        ]);
    };

    const sorted = entries.filter((e: Entry) => e.completed).length;
    const pending = entries.filter((e: Entry) => !e.completed).length;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Email Dashboard</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: '#f3f4f6' }]}>
                    <Text style={styles.statNum}>{entries.length}</Text>
                    <Text style={styles.statLbl}>Total</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: '#d1fae5' }]}>
                    <Text style={[styles.statNum, { color: '#059669' }]}>{sorted}</Text>
                    <Text style={styles.statLbl}>Sorted</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.statNum, { color: '#b45309' }]}>{pending}</Text>
                    <Text style={styles.statLbl}>Pending</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email…"
                    placeholderTextColor="#9ca3af"
                    value={search}
                    onChangeText={setSearch}
                />
                {search ? <TouchableOpacity onPress={() => setSearch('')}><X size={16} color="#9ca3af" /></TouchableOpacity> : null}
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
                {(['all', 'pending', 'sorted'] as const).map(f => (
                    <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
                        <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={entries}
                keyExtractor={(e: Entry) => e.id}
                contentContainerStyle={entries.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No entries found'}
                        subtitle="Tap + to log a new email issue"
                        icon={<Mail size={40} color="#9ca3af" />}
                    />
                }
                renderItem={({ item }: { item: Entry }) => (
                    <EntryCard
                        item={item}
                        onToggle={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })}
                        onDelete={() => confirmDelete(item.id)}
                        onEdit={() => openEdit(item)}
                    />
                )}
            />

            <FAB icon={() => <Plus size={22} color="#fff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>New Entry</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput label="Employee Name" value={form.employee_name} onChangeText={v => setForm(f => ({ ...f, employee_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Work Email" value={form.work_email} onChangeText={v => setForm(f => ({ ...f, work_email: v }))} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Phone (optional)" value={form.employee_phone} onChangeText={v => setForm(f => ({ ...f, employee_phone: v }))} mode="outlined" keyboardType="phone-pad" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Text style={styles.pickerLabel}>Alt Email Status</Text>
                        <View style={styles.chipRow}>
                            {ALT_STATUS_OPTIONS.map(s => (
                                <TouchableOpacity key={s} style={[styles.chip, form.alt_email_status === s && styles.chipActive]} onPress={() => setForm(f => ({ ...f, alt_email_status: s }))}>
                                    <Text style={[styles.chipText, form.alt_email_status === s && styles.chipTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {(form.alt_email_status === 'alt-email' || form.alt_email_status === 'alt-both') && (
                            <PaperInput label="Alt Email" value={form.alt_email} onChangeText={v => setForm(f => ({ ...f, alt_email: v }))} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        )}

                        <Text style={styles.pickerLabel}>Resolution</Text>
                        <View style={styles.chipRow}>
                            {RESOLUTIONS.map(r => (
                                <TouchableOpacity key={r} style={[styles.chip, form.resolution === r && styles.chipActive]} onPress={() => setForm(f => ({ ...f, resolution: r }))}>
                                    <Text style={[styles.chipText, form.resolution === r && styles.chipTextActive]}>{RESOLUTION_LABELS[r]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={handleCreate} style={{ marginTop: 12, marginBottom: 4 }}>
                            Log Entry
                        </Button>
                    </ScrollView>
                </Modal>

                {/* Edit modal */}
                <Modal visible={!!editingEntry} onDismiss={() => setEditingEntry(null)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>Edit Entry</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput label="Employee Name" value={editForm.employee_name} onChangeText={v => setEditForm(f => ({ ...f, employee_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Work Email" value={editForm.work_email} onChangeText={v => setEditForm(f => ({ ...f, work_email: v }))} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Phone (optional)" value={editForm.employee_phone} onChangeText={v => setEditForm(f => ({ ...f, employee_phone: v }))} mode="outlined" keyboardType="phone-pad" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Text style={styles.pickerLabel}>Alt Email Status</Text>
                        <View style={styles.chipRow}>
                            {ALT_STATUS_OPTIONS.map(s => (
                                <TouchableOpacity key={s} style={[styles.chip, editForm.alt_email_status === s && styles.chipActive]} onPress={() => setEditForm(f => ({ ...f, alt_email_status: s }))}>
                                    <Text style={[styles.chipText, editForm.alt_email_status === s && styles.chipTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {(editForm.alt_email_status === 'alt-email' || editForm.alt_email_status === 'alt-both') && (
                            <PaperInput label="Alt Email" value={editForm.alt_email} onChangeText={v => setEditForm(f => ({ ...f, alt_email: v }))} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        )}

                        <Text style={styles.pickerLabel}>Resolution</Text>
                        <View style={styles.chipRow}>
                            {RESOLUTIONS.map(r => (
                                <TouchableOpacity key={r} style={[styles.chip, editForm.resolution === r && styles.chipActive]} onPress={() => setEditForm(f => ({ ...f, resolution: r }))}>
                                    <Text style={[styles.chipText, editForm.resolution === r && styles.chipTextActive]}>{RESOLUTION_LABELS[r]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 4 }}>
                            <Button mode="outlined" onPress={() => setEditingEntry(null)} style={{ flex: 1 }}>Cancel</Button>
                            <Button mode="contained" buttonColor="#059669" loading={updateMutation.isPending} onPress={() => editingEntry && updateMutation.mutate({ id: editingEntry.id, data: editForm })} style={{ flex: 1 }}>Save</Button>
                        </View>
                    </ScrollView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { padding: 4, marginRight: 10 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827' },
    statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    statPill: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    statNum: { fontSize: 18, fontWeight: '800', color: '#111827' },
    statLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, elevation: 1 },
    searchInput: { flex: 1, fontSize: 14, color: '#111827' },
    filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chipText: { fontSize: 12, color: '#6b7280' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, elevation: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    strikethrough: { textDecorationLine: 'line-through', color: '#9ca3af' },
    cardEmail: { fontSize: 12, color: '#6b7280', marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    cardAlt: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardDate: { fontSize: 11, color: '#9ca3af' },
    deleteBtn: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
    pickerLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
});
