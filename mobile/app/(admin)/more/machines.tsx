import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
    ArrowLeft, Plus, Monitor, Pencil, Trash2, MessageSquare,
    Send, Lock, Globe, CheckCircle2,
} from 'lucide-react-native';
import { machinesApi, commentsApi } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/store/useAuthStore';
import type { MachineRequest, MachineStatus, MachineReason, MachineItemType, ImportanceLevel } from '@/types/database';

const STATUSES: MachineStatus[] = ['pending', 'approved', 'fulfilled', 'rejected'];
const REASONS: MachineReason[] = ['old-hardware', 'faulty', 'new-user'];
const ITEM_TYPES: MachineItemType[] = ['desktop', 'laptop', 'supplies'];
const IMPORTANCE: ImportanceLevel[] = ['urgent', 'important', 'neutral'];

const REASON_LABELS: Record<MachineReason, string> = {
    'old-hardware': 'Old Hardware',
    'faulty': 'Faulty / Broken',
    'new-user': 'New User',
};
const ITEM_LABELS: Record<MachineItemType, string> = {
    desktop: 'Desktop', laptop: 'Laptop', supplies: 'Supplies',
};
const STATUS_COLOR: Record<MachineStatus, { bg: string; text: string }> = {
    pending:   { bg: '#fef3c7', text: '#b45309' },
    approved:  { bg: '#d1fae5', text: '#059669' },
    fulfilled: { bg: '#dbeafe', text: '#1d4ed8' },
    rejected:  { bg: '#fee2e2', text: '#dc2626' },
};

const BLANK_FORM = {
    requester_name: '', user_name: '', work_email: '',
    reason: 'faulty' as MachineReason,
    item_type: 'desktop' as MachineItemType,
    item_count: '1', supply_name: '',
    importance: 'neutral' as ImportanceLevel,
    notes: '', resolution_notes: '', internal_notes: '',
};

// ── Comments modal ───────────────────────────────────────────────────────────
function CommentsModal({ machine, onClose }: { machine: MachineRequest; onClose: () => void }) {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [text, setText] = useState('');
    const [isInternal, setIsInternal] = useState(false);

    // We reuse ticket comments API with a machine_id concept via ticket_id field
    // The web app stores machine comments with ticket_id = machine.id
    const { data: comments = [], refetch } = useQuery({
        queryKey: ['machine-comments', machine.id],
        queryFn: () => commentsApi.listForMachine(machine.id).then(r => r.data as any[]),
    });

    const sendMutation = useMutation({
        mutationFn: (data: any) => commentsApi.createForMachine(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['machine-comments', machine.id] });
            setText('');
        },
    });

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={cStyles.header}>
                <Text style={cStyles.title}>Updates — #{machine.number}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                    <Text style={cStyles.closeBtn}>Done</Text>
                </TouchableOpacity>
            </View>
            <Divider />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
                {comments.length === 0 && (
                    <Text style={cStyles.empty}>No updates yet.</Text>
                )}
                {comments.map((c: any) => (
                    <View key={c.id} style={[cStyles.bubble, c.is_internal && cStyles.internalBubble]}>
                        <View style={cStyles.bubbleHeader}>
                            {c.is_internal && <Lock size={10} color="#b45309" />}
                            <Text style={cStyles.author}>{c.author_name}</Text>
                            <Text style={cStyles.dateText}>{new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</Text>
                        </View>
                        <Text style={cStyles.content}>{c.content}</Text>
                    </View>
                ))}
            </ScrollView>
            <View style={cStyles.inputArea}>
                {user?.role !== 'USER' && (
                    <TouchableOpacity style={cStyles.toggle} onPress={() => setIsInternal(v => !v)}>
                        {isInternal ? <Lock size={13} color="#b45309" /> : <Globe size={13} color="#6b7280" />}
                        <Text style={[cStyles.toggleText, isInternal && { color: '#b45309' }]}>
                            {isInternal ? 'Internal note' : 'Public reply'}
                        </Text>
                    </TouchableOpacity>
                )}
                <View style={cStyles.inputRow}>
                    <PaperInput
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a comment…"
                        mode="outlined"
                        multiline
                        style={cStyles.input}
                        outlineColor="#d1d5db"
                        activeOutlineColor="#059669"
                    />
                    <TouchableOpacity
                        style={[cStyles.sendBtn, !text.trim() && { backgroundColor: '#d1d5db' }]}
                        disabled={!text.trim() || sendMutation.isPending}
                        onPress={() => sendMutation.mutate({ machine_id: machine.id, content: text.trim(), is_internal: isInternal })}
                    >
                        <Send size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function MachineCard({ item, onEdit, onDelete, onStatusChange, onComments }: {
    item: MachineRequest;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (id: string, status: MachineStatus) => void;
    onComments: () => void;
}) {
    const c = STATUS_COLOR[item.status];
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardNum}>#{item.number}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.badge, { backgroundColor: c.bg }]}>
                        <Text style={[styles.badgeText, { color: c.text }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onEdit} hitSlop={8}>
                        <Pencil size={14} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} hitSlop={8}>
                        <Trash2 size={14} color="#d1d5db" />
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.cardName}>{item.user_name}</Text>
            <Text style={styles.cardMeta}>{item.requester_name}{item.work_email ? ` · ${item.work_email}` : ''}</Text>

            <View style={styles.tagsRow}>
                {item.item_type && (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{ITEM_LABELS[item.item_type as MachineItemType] ?? item.item_type}{item.item_count ? ` ×${item.item_count}` : ''}</Text>
                    </View>
                )}
                {item.supply_name ? (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{item.supply_name}</Text>
                    </View>
                ) : null}
                <View style={styles.tag}>
                    <Text style={styles.tagText}>{REASON_LABELS[item.reason] ?? item.reason}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: item.importance === 'urgent' ? '#fee2e2' : '#f3f4f6' }]}>
                    <Text style={[styles.tagText, item.importance === 'urgent' && { color: '#dc2626' }]}>{item.importance}</Text>
                </View>
            </View>

            {item.notes ? <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text> : null}

            {item.resolution_notes ? (
                <View style={styles.resBox}>
                    <CheckCircle2 size={12} color="#059669" />
                    <Text style={styles.resText} numberOfLines={2}>{item.resolution_notes}</Text>
                </View>
            ) : null}

            {/* Action row */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.commentsBtn} onPress={onComments}>
                    <MessageSquare size={13} color="#6b7280" />
                    <Text style={styles.commentsBtnText}>Updates</Text>
                </TouchableOpacity>
                {item.status === 'pending' && (
                    <>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => onStatusChange(item.id, 'approved')}>
                            <Text style={styles.approveBtnText}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => onStatusChange(item.id, 'rejected')}>
                            <Text style={styles.rejectBtnText}>✕ Reject</Text>
                        </TouchableOpacity>
                    </>
                )}
                {item.status === 'approved' && (
                    <TouchableOpacity style={[styles.approveBtn, { flex: 2, backgroundColor: '#dbeafe' }]} onPress={() => onStatusChange(item.id, 'fulfilled')}>
                        <Text style={[styles.approveBtnText, { color: '#1d4ed8' }]}>Mark Fulfilled</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MachinesScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [statusFilter, setStatusFilter] = useState<MachineStatus | 'all'>('all');
    const [createVisible, setCreateVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<MachineRequest | null>(null);
    const [commentsItem, setCommentsItem] = useState<MachineRequest | null>(null);
    const [form, setForm] = useState({ ...BLANK_FORM });

    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;

    const { data: machines = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['machines', params],
        queryFn: () => machinesApi.list(params).then(r => r.data as MachineRequest[]),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => machinesApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines'] }),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => machinesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['machines'] });
            setCreateVisible(false);
            setForm({ ...BLANK_FORM });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => machinesApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines'] }),
    });

    const handleStatusChange = (id: string, status: MachineStatus) => {
        updateMutation.mutate({ id, data: { status } });
    };

    const handleDelete = (item: MachineRequest) => {
        Alert.alert('Delete Request', `Delete request #${item.number}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
        ]);
    };

    const openEdit = (item: MachineRequest) => {
        setEditingItem(item);
        setForm({
            requester_name: item.requester_name ?? '',
            user_name: item.user_name ?? '',
            work_email: item.work_email ?? '',
            reason: item.reason as MachineReason,
            item_type: (item.item_type as MachineItemType) ?? 'desktop',
            item_count: String(item.item_count ?? 1),
            supply_name: item.supply_name ?? '',
            importance: item.importance as ImportanceLevel,
            notes: item.notes ?? '',
            resolution_notes: item.resolution_notes ?? '',
            internal_notes: item.internal_notes ?? '',
        });
    };

    const handleCreate = () => {
        if (!form.requester_name || !form.work_email) return;
        createMutation.mutate({
            ...form,
            item_count: parseInt(form.item_count) || 1,
            supply_name: form.item_type === 'supplies' ? form.supply_name : null,
            date: new Date().toISOString().split('T')[0],
        });
    };

    const handleUpdate = () => {
        if (!editingItem) return;
        updateMutation.mutate({
            id: editingItem.id,
            data: {
                ...form,
                item_count: parseInt(form.item_count) || 1,
                supply_name: form.item_type === 'supplies' ? form.supply_name : null,
            },
        }, { onSuccess: () => setEditingItem(null) });
    };

    const FormFields = ({ f, setF }: { f: typeof BLANK_FORM; setF: (fn: (p: typeof BLANK_FORM) => typeof BLANK_FORM) => void }) => (
        <>
            <PaperInput label="Requester Name" value={f.requester_name} onChangeText={v => setF(p => ({ ...p, requester_name: v }))} mode="outlined" style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
            <PaperInput label="User / For Whom" value={f.user_name} onChangeText={v => setF(p => ({ ...p, user_name: v }))} mode="outlined" style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
            <PaperInput label="Work Email (@jtl.co.ke)" value={f.work_email} onChangeText={v => setF(p => ({ ...p, work_email: v }))} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />

            <Text style={styles.pickerLabel}>Item Type</Text>
            <View style={styles.chipRow}>
                {ITEM_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[styles.chip, f.item_type === t && styles.chipActive]} onPress={() => setF(p => ({ ...p, item_type: t }))}>
                        <Text style={[styles.chipText, f.item_type === t && styles.chipTextActive]}>{ITEM_LABELS[t]}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {f.item_type === 'supplies' ? (
                <PaperInput label="Supply Name" value={f.supply_name} onChangeText={v => setF(p => ({ ...p, supply_name: v }))} mode="outlined" style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
            ) : (
                <Text style={styles.pickerLabel}>Reason</Text>
            )}
            {f.item_type !== 'supplies' && (
                <View style={styles.chipRow}>
                    {REASONS.map(r => (
                        <TouchableOpacity key={r} style={[styles.chip, f.reason === r && styles.chipActive]} onPress={() => setF(p => ({ ...p, reason: r }))}>
                            <Text style={[styles.chipText, f.reason === r && styles.chipTextActive]}>{REASON_LABELS[r]}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <PaperInput label="Quantity" value={f.item_count} onChangeText={v => setF(p => ({ ...p, item_count: v }))} mode="outlined" keyboardType="numeric" style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />

            <Text style={styles.pickerLabel}>Importance</Text>
            <View style={styles.chipRow}>
                {IMPORTANCE.map(i => (
                    <TouchableOpacity key={i} style={[styles.chip, f.importance === i && styles.chipActive]} onPress={() => setF(p => ({ ...p, importance: i }))}>
                        <Text style={[styles.chipText, f.importance === i && styles.chipTextActive]}>{i.charAt(0).toUpperCase() + i.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <PaperInput label="Notes" value={f.notes} onChangeText={v => setF(p => ({ ...p, notes: v }))} mode="outlined" multiline numberOfLines={2} style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
            <PaperInput label="Resolution Notes (public)" value={f.resolution_notes} onChangeText={v => setF(p => ({ ...p, resolution_notes: v }))} mode="outlined" multiline numberOfLines={2} style={styles.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
            {user?.role !== 'USER' && (
                <PaperInput label="Internal IT Notes" value={f.internal_notes} onChangeText={v => setF(p => ({ ...p, internal_notes: v }))} mode="outlined" multiline numberOfLines={2} style={[styles.fi, { backgroundColor: '#fffbeb' }]} outlineColor="#f59e0b" activeOutlineColor="#b45309" />
            )}
        </>
    );

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Machine Requests</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                {[
                    { label: 'Pending', val: machines.filter(m => m.status === 'pending').length, color: '#b45309', bg: '#fef3c7' },
                    { label: 'Approved', val: machines.filter(m => m.status === 'approved').length, color: '#059669', bg: '#d1fae5' },
                    { label: 'Fulfilled', val: machines.filter(m => m.status === 'fulfilled').length, color: '#1d4ed8', bg: '#dbeafe' },
                ].map(s => (
                    <View key={s.label} style={[styles.statPill, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
                        <Text style={styles.statLbl}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Status filter chips */}
            <View style={styles.filterRow}>
                {(['all', ...STATUSES] as const).map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.chip, statusFilter === s && styles.chipActive]}
                        onPress={() => setStatusFilter(s)}
                    >
                        <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={machines}
                keyExtractor={m => m.id}
                contentContainerStyle={machines.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No machine requests'}
                        subtitle="No requests match the current filter"
                        icon={<Monitor size={40} color="#9ca3af" />}
                    />
                }
                renderItem={({ item }) => (
                    <MachineCard
                        item={item}
                        onEdit={() => openEdit(item)}
                        onDelete={() => handleDelete(item)}
                        onStatusChange={handleStatusChange}
                        onComments={() => setCommentsItem(item)}
                    />
                )}
            />

            <FAB icon={() => <Plus size={22} color="#fff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                {/* Create modal */}
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>New Machine Request</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <FormFields f={form} setF={setForm as any} />
                        <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={handleCreate} style={{ marginTop: 8, marginBottom: 4 }}>
                            Submit Request
                        </Button>
                    </ScrollView>
                </Modal>

                {/* Edit modal */}
                <Modal visible={!!editingItem} onDismiss={() => setEditingItem(null)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>Edit Request #{editingItem?.number}</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <FormFields f={form} setF={setForm as any} />
                        <Text style={styles.pickerLabel}>Status</Text>
                        <View style={styles.chipRow}>
                            {STATUSES.map(s => (
                                <TouchableOpacity key={s} style={[styles.chip, form.importance /* dummy */ && form.requester_name && false && styles.chipActive]} onPress={() => {
                                    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: { status: s } });
                                }}>
                                    <Text style={styles.chipText}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 }}>
                            <Button mode="outlined" onPress={() => setEditingItem(null)} style={{ flex: 1 }}>Cancel</Button>
                            <Button mode="contained" buttonColor="#059669" loading={updateMutation.isPending} onPress={handleUpdate} style={{ flex: 1 }}>Save</Button>
                        </View>
                    </ScrollView>
                </Modal>

                {/* Comments modal */}
                <Modal visible={!!commentsItem} onDismiss={() => setCommentsItem(null)} contentContainerStyle={[styles.modal, { maxHeight: '90%' }]}>
                    {commentsItem && <CommentsModal machine={commentsItem} onClose={() => setCommentsItem(null)} />}
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
    statNum: { fontSize: 18, fontWeight: '800' },
    statLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chipText: { fontSize: 12, color: '#6b7280' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardNum: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    cardName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
    cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    tagText: { fontSize: 11, color: '#374151' },
    cardNotes: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 8 },
    resBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginBottom: 10 },
    resText: { flex: 1, fontSize: 12, color: '#059669', lineHeight: 17 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    commentsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f3f4f6' },
    commentsBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
    approveBtn: { flex: 1, backgroundColor: '#d1fae5', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    approveBtnText: { color: '#059669', fontWeight: '700', fontSize: 13 },
    rejectBtn: { flex: 1, backgroundColor: '#fee2e2', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    rejectBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    fi: { marginBottom: 10, backgroundColor: '#f9fafb' },
    pickerLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
});

const cStyles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 17, fontWeight: '700', color: '#111827' },
    closeBtn: { fontSize: 15, color: '#059669', fontWeight: '600' },
    empty: { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 14 },
    bubble: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 8 },
    internalBubble: { backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
    bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    author: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
    dateText: { fontSize: 11, color: '#9ca3af' },
    content: { fontSize: 14, color: '#374151', lineHeight: 20 },
    inputArea: { padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
    toggleText: { fontSize: 12, color: '#6b7280' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: { flex: 1, backgroundColor: '#f9fafb' },
    sendBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
