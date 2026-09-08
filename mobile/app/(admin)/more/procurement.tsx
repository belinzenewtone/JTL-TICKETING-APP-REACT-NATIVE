import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, ShoppingCart, CheckCircle2, XCircle, ChevronRight } from 'lucide-react-native';
import { procurementApi } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import type { Requisition, RequisitionType } from '@/types/database';

const TYPES: RequisitionType[] = ['it-equipment', 'office-supplies', 'services', 'other'];
const TYPE_LABELS: Record<RequisitionType, string> = {
    'it-equipment': 'IT Equipment', 'office-supplies': 'Office Supplies',
    'services': 'Services', 'other': 'Other',
};
const STAGE_ORDER = [
    'draft','requestor','head_department','cio','head_hr','general_manager',
    'director_strategy','head_finance','chairman','procurement','awaiting_delivery','delivered',
];
const STAGE_LABELS: Record<string, string> = {
    draft: 'Draft', requestor: 'Requestor', head_department: 'Head of Dept',
    cio: 'CIO', head_hr: 'Head HR', general_manager: 'General Manager',
    director_strategy: 'Director Strategy', head_finance: 'Head Finance',
    chairman: 'Chairman', procurement: 'Procurement', awaiting_delivery: 'Awaiting Delivery',
    delivered: 'Delivered',
};

const STAGE_COLOR: Record<string, { bg: string; text: string }> = {
    draft:           { bg: '#f3f4f6', text: '#6b7280' },
    delivered:       { bg: '#d1fae5', text: '#059669' },
};
function stageColor(stage: string) {
    if (stage === 'draft') return STAGE_COLOR.draft;
    if (stage === 'delivered') return STAGE_COLOR.delivered;
    return { bg: '#dbeafe', text: '#1d4ed8' };
}

function RequisitionCard({ item, onPress, onApprove, onReject }: {
    item: Requisition; onPress: () => void;
    onApprove: () => void; onReject: () => void;
}) {
    const c = stageColor(item.current_stage);
    const stageIdx = STAGE_ORDER.indexOf(item.current_stage);
    const progress = Math.max(0, stageIdx) / (STAGE_ORDER.length - 1);
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.cardNum}>REQ-{String(item.number ?? '').padStart(4, '0')}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                    <Text style={[styles.badgeText, { color: c.text }]}>{STAGE_LABELS[item.current_stage] ?? item.current_stage}</Text>
                </View>
            </View>

            <Text style={styles.cardMeta}>For: {item.requested_for ?? '—'} · {item.supplier_name}</Text>
            <Text style={styles.cardAmount}>KES {Number(item.total_amount ?? 0).toLocaleString()}</Text>

            {/* Progress bar */}
            <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>Step {Math.max(1, stageIdx + 1)} of {STAGE_ORDER.length}</Text>

            {/* Action buttons if not draft/delivered */}
            {item.current_stage !== 'draft' && item.current_stage !== 'delivered' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
                        <CheckCircle2 size={14} color="#059669" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
                        <XCircle size={14} color="#dc2626" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function ProcurementScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [createVisible, setCreateVisible] = useState(false);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [form, setForm] = useState({
        title: '', type: 'other' as RequisitionType,
        item_quantity: '1', requested_for: '',
        supplier_name: '', total_amount: '', notes: '',
    });

    const params: Record<string, string> = {};
    if (stageFilter !== 'all') params.stage = stageFilter;

    const { data: reqs = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['procurement', params],
        queryFn: () => procurementApi.list(params).then(r => r.data as Requisition[]),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => procurementApi.approve(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement'] }),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => procurementApi.reject(id, reason),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement'] }),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => procurementApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['procurement'] });
            setCreateVisible(false);
            setForm({ title: '', type: 'other', item_quantity: '1', requested_for: '', supplier_name: '', total_amount: '', notes: '' });
        },
    });

    const handleApprove = (id: string) => {
        Alert.alert('Approve', 'Advance this requisition to the next stage?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Approve', onPress: () => approveMutation.mutate(id) },
        ]);
    };

    const handleReject = (id: string) => {
        setRejectId(id);
        setRejectReason('');
        setRejectVisible(true);
    };

    const submitReject = () => {
        if (!rejectId) return;
        rejectMutation.mutate({ id: rejectId, reason: rejectReason.trim() || 'Rejected' });
        setRejectVisible(false);
        setRejectId(null);
        setRejectReason('');
    };

    const handleCreate = () => {
        if (!form.title || !form.supplier_name) return;
        createMutation.mutate({
            ...form,
            item_quantity: parseInt(form.item_quantity) || 1,
            total_amount: parseFloat(form.total_amount) || 0,
            requisition_date: new Date().toISOString().split('T')[0],
        });
    };

    const filterTabs = ['all', 'draft', 'requestor', 'delivered'];

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Procurement</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                {[
                    { label: 'Total', val: reqs.length, color: '#111827', bg: '#f3f4f6' },
                    { label: 'Active', val: reqs.filter((r: Requisition) => !['draft','delivered'].includes(r.current_stage)).length, color: '#1d4ed8', bg: '#dbeafe' },
                    { label: 'Delivered', val: reqs.filter((r: Requisition) => r.current_stage === 'delivered').length, color: '#059669', bg: '#d1fae5' },
                ].map(s => (
                    <View key={s.label} style={[styles.statPill, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
                        <Text style={styles.statLbl}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Filter tabs */}
            <View style={styles.filterRow}>
                {filterTabs.map(t => (
                    <TouchableOpacity key={t} style={[styles.chip, stageFilter === t && styles.chipActive]} onPress={() => setStageFilter(t)}>
                        <Text style={[styles.chipText, stageFilter === t && styles.chipTextActive]}>
                            {t === 'all' ? 'All' : STAGE_LABELS[t] ?? t}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={reqs}
                keyExtractor={(r: Requisition) => r.id}
                contentContainerStyle={reqs.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No requisitions'}
                        subtitle="Tap + to create a procurement request"
                        icon={<ShoppingCart size={40} color="#9ca3af" />}
                    />
                }
                renderItem={({ item }: { item: Requisition }) => (
                    <RequisitionCard
                        item={item}
                        onPress={() => {}}
                        onApprove={() => handleApprove(item.id)}
                        onReject={() => handleReject(item.id)}
                    />
                )}
            />

            <FAB icon={() => <Plus size={22} color="#fff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                {/* Reject reason modal */}
                <Modal visible={rejectVisible} onDismiss={() => setRejectVisible(false)} contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>Reject Requisition</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <PaperInput
                        label="Reason for rejection"
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        mode="outlined"
                        multiline
                        numberOfLines={3}
                        style={styles.formInput}
                        outlineColor="#d1d5db"
                        activeOutlineColor="#dc2626"
                        autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <Button mode="outlined" onPress={() => setRejectVisible(false)} style={{ flex: 1 }}>Cancel</Button>
                        <Button
                            mode="contained"
                            buttonColor="#dc2626"
                            loading={rejectMutation.isPending}
                            onPress={submitReject}
                            style={{ flex: 1 }}
                        >
                            Reject
                        </Button>
                    </View>
                </Modal>

                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>New Requisition</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput label="Title" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Requested For" value={form.requested_for} onChangeText={v => setForm(f => ({ ...f, requested_for: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Supplier Name" value={form.supplier_name} onChangeText={v => setForm(f => ({ ...f, supplier_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Text style={styles.pickerLabel}>Type</Text>
                        <View style={styles.chipRow}>
                            {TYPES.map(t => (
                                <TouchableOpacity key={t} style={[styles.chip, form.type === t && styles.chipActive]} onPress={() => setForm(f => ({ ...f, type: t }))}>
                                    <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.row}>
                            <PaperInput label="Qty" value={form.item_quantity} onChangeText={v => setForm(f => ({ ...f, item_quantity: v }))} mode="outlined" keyboardType="numeric" style={[styles.formInput, { flex: 1, marginRight: 8 }]} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                            <PaperInput label="Total (KES)" value={form.total_amount} onChangeText={v => setForm(f => ({ ...f, total_amount: v }))} mode="outlined" keyboardType="numeric" style={[styles.formInput, { flex: 2 }]} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        </View>

                        <PaperInput label="Notes (optional)" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} mode="outlined" multiline numberOfLines={2} style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={handleCreate} style={{ marginTop: 8, marginBottom: 4 }}>
                            Create Requisition
                        </Button>
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
    statNum: { fontSize: 18, fontWeight: '800' },
    statLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chipText: { fontSize: 12, color: '#6b7280' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    cardNum: { fontSize: 11, fontWeight: '700', color: '#059669', marginBottom: 2 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827', maxWidth: 200 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    badgeText: { fontSize: 10, fontWeight: '600' },
    cardMeta: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
    cardAmount: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
    progressBg: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, marginBottom: 4 },
    progressFill: { height: 4, backgroundColor: '#059669', borderRadius: 2 },
    progressLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 8 },
    actionRow: { flexDirection: 'row', gap: 10 },
    approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#d1fae5', borderRadius: 10, paddingVertical: 8 },
    approveBtnText: { color: '#059669', fontWeight: '700', fontSize: 13 },
    rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#fee2e2', borderRadius: 10, paddingVertical: 8 },
    rejectBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
    row: { flexDirection: 'row' },
    pickerLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
});
