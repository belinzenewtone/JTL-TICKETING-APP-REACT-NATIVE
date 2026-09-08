import { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider, TextInput as PaperInput, Modal, Portal } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft, CheckCircle2, XCircle, Trash2, Pencil,
    ChevronRight, Clock, Circle,
} from 'lucide-react-native';
import { procurementApi } from '@/api/client';

const STAGE_ORDER = [
    'draft','requestor','head_department','cio','head_hr','general_manager',
    'director_strategy','head_finance','chairman','procurement','awaiting_delivery','delivered',
];
const STAGE_LABELS: Record<string, string> = {
    draft: 'Draft', requestor: 'Requestor', head_department: 'Head of Dept',
    cio: 'CIO', head_hr: 'Head HR', general_manager: 'General Manager',
    director_strategy: 'Director Strategy', head_finance: 'Head Finance',
    chairman: 'Chairman', procurement: 'Procurement',
    awaiting_delivery: 'Awaiting Delivery', delivered: 'Delivered',
};

type Tab = 'overview' | 'pipeline' | 'items';

function stageIcon(stage: string, currentStage: string, stageApprovals: any[]) {
    const approved = stageApprovals.find((s: any) => s.stage === stage && !s.rejected);
    const rejected = stageApprovals.find((s: any) => s.stage === stage && s.rejected);
    const isCurrent = stage === currentStage;

    if (rejected) return { icon: <XCircle size={18} color="#dc2626" />, color: '#dc2626', bg: '#fee2e2' };
    if (approved) return { icon: <CheckCircle2 size={18} color="#059669" />, color: '#059669', bg: '#d1fae5' };
    if (isCurrent) return { icon: <Clock size={18} color="#b45309" />, color: '#b45309', bg: '#fef3c7' };
    return { icon: <Circle size={18} color="#d1d5db" />, color: '#9ca3af', bg: '#f9fafb' };
}

export default function ProcurementDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('overview');
    const [editVisible, setEditVisible] = useState(false);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [editForm, setEditForm] = useState({ title: '', requested_for: '', supplier_name: '', notes: '', total_amount: '', item_quantity: '' });

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['procurement-detail', id],
        queryFn: () => procurementApi.get(id).then(r => r.data as any),
    });

    const req = data?.requisition;
    const stages = (data?.stages ?? []) as any[];
    const items = (data?.items ?? []) as any[];

    const approveMutation = useMutation({
        mutationFn: (notes?: string) => procurementApi.approve(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['procurement-detail', id] });
            queryClient.invalidateQueries({ queryKey: ['procurement'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (reason: string) => procurementApi.reject(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['procurement-detail', id] });
            queryClient.invalidateQueries({ queryKey: ['procurement'] });
            setRejectVisible(false);
            setRejectReason('');
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => procurementApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['procurement-detail', id] });
            queryClient.invalidateQueries({ queryKey: ['procurement'] });
            setEditVisible(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => procurementApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['procurement'] });
            router.back();
        },
    });

    const handleApprove = () => {
        Alert.alert('Approve', 'Advance this requisition to the next stage?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Approve', onPress: () => approveMutation.mutate(undefined) },
        ]);
    };

    const handleDelete = () => {
        Alert.alert('Delete Requisition', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
        ]);
    };

    const openEdit = () => {
        if (!req) return;
        setEditForm({
            title: req.title ?? '',
            requested_for: req.requested_for ?? '',
            supplier_name: req.supplier_name ?? '',
            notes: req.notes ?? '',
            total_amount: String(req.total_amount ?? ''),
            item_quantity: String(req.item_quantity ?? ''),
        });
        setEditVisible(true);
    };

    if (isLoading || !req) {
        return (
            <SafeAreaView style={s.root} edges={['top']}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={22} color="#111827" /></TouchableOpacity>
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#9ca3af' }}>Loading…</Text>
                </View>
            </SafeAreaView>
        );
    }

    const stageIdx = STAGE_ORDER.indexOf(req.current_stage);
    const progress = Math.max(0, stageIdx) / (STAGE_ORDER.length - 1);
    const canApproveReject = req.current_stage !== 'draft' && req.current_stage !== 'delivered';

    return (
        <SafeAreaView style={s.root} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>REQ-{String(req.number ?? '').padStart(4,'0')}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity onPress={openEdit} style={s.iconBtn}><Pencil size={17} color="#6b7280" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={s.iconBtn}><Trash2 size={17} color="#dc2626" /></TouchableOpacity>
                </View>
            </View>

            {/* Progress bar */}
            <View style={s.progressSection}>
                <Text style={s.currentStageLabel}>{STAGE_LABELS[req.current_stage] ?? req.current_stage}</Text>
                <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${Math.round(progress*100)}%` as any }]} />
                </View>
                <Text style={s.stepLabel}>Step {Math.max(1, stageIdx + 1)} of {STAGE_ORDER.length}</Text>
            </View>

            {/* Tabs */}
            <View style={s.tabRow}>
                {(['overview','pipeline','items'] as Tab[]).map(t => (
                    <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                        <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
                {/* ── Overview ──────────────────────────────── */}
                {tab === 'overview' && (
                    <View>
                        <View style={s.card}>
                            <Text style={s.fieldLabel}>Title</Text>
                            <Text style={s.fieldValue}>{req.title}</Text>
                            <Divider style={s.div} />
                            <Text style={s.fieldLabel}>Requested For</Text>
                            <Text style={s.fieldValue}>{req.requested_for || '—'}</Text>
                            <Divider style={s.div} />
                            <Text style={s.fieldLabel}>Requestor</Text>
                            <Text style={s.fieldValue}>{req.requestor_name} {req.requestor_email ? `· ${req.requestor_email}` : ''}</Text>
                            <Divider style={s.div} />
                            <Text style={s.fieldLabel}>Supplier</Text>
                            <Text style={s.fieldValue}>{req.supplier_name}</Text>
                            <Divider style={s.div} />
                            <View style={{ flexDirection: 'row', gap: 24 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.fieldLabel}>Quantity</Text>
                                    <Text style={s.fieldValue}>{req.item_quantity ?? '—'}</Text>
                                </View>
                                <View style={{ flex: 2 }}>
                                    <Text style={s.fieldLabel}>Total Amount</Text>
                                    <Text style={[s.fieldValue, { color: '#059669', fontWeight: '700' }]}>KES {Number(req.total_amount ?? 0).toLocaleString()}</Text>
                                </View>
                            </View>
                            {req.notes ? (
                                <>
                                    <Divider style={s.div} />
                                    <Text style={s.fieldLabel}>Notes</Text>
                                    <Text style={s.fieldValue}>{req.notes}</Text>
                                </>
                            ) : null}
                            {req.requisition_date ? (
                                <>
                                    <Divider style={s.div} />
                                    <Text style={s.fieldLabel}>Date</Text>
                                    <Text style={s.fieldValue}>{req.requisition_date}</Text>
                                </>
                            ) : null}
                        </View>

                        {/* Approve / Reject actions */}
                        {canApproveReject && (
                            <View style={s.actionRow}>
                                <TouchableOpacity style={s.approveBtn} onPress={handleApprove}>
                                    <CheckCircle2 size={16} color="#059669" />
                                    <Text style={s.approveBtnText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.rejectBtn} onPress={() => setRejectVisible(true)}>
                                    <XCircle size={16} color="#dc2626" />
                                    <Text style={s.rejectBtnText}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Pipeline ──────────────────────────────── */}
                {tab === 'pipeline' && (
                    <View style={s.card}>
                        {STAGE_ORDER.map((stage, idx) => {
                            const info = stageIcon(stage, req.current_stage, stages);
                            const stageRecord = stages.find((st: any) => st.stage === stage);
                            return (
                                <View key={stage} style={s.pipelineRow}>
                                    <View style={[s.stageIconWrap, { backgroundColor: info.bg }]}>
                                        {info.icon}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.stageName, { color: info.color }]}>{STAGE_LABELS[stage]}</Text>
                                        {stageRecord && (
                                            <Text style={s.stageMeta}>
                                                {stageRecord.approved_by_name ?? ''}
                                                {stageRecord.signed_date ? ` · ${stageRecord.signed_date}` : ''}
                                                {stageRecord.notes ? ` · ${stageRecord.notes}` : ''}
                                                {stageRecord.rejected && stageRecord.rejection_reason ? `\nRejected: ${stageRecord.rejection_reason}` : ''}
                                            </Text>
                                        )}
                                    </View>
                                    {idx < STAGE_ORDER.length - 1 && (
                                        <ChevronRight size={14} color="#d1d5db" />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ── Items (PO Line Items) ──────────────────── */}
                {tab === 'items' && (
                    <View>
                        {items.length === 0 ? (
                            <View style={s.card}>
                                <Text style={{ color: '#9ca3af', textAlign: 'center', paddingVertical: 20 }}>No line items yet.</Text>
                            </View>
                        ) : items.map((item: any) => (
                            <View key={item.id} style={s.itemCard}>
                                <Text style={s.itemDesc}>{item.description}</Text>
                                <View style={s.itemMeta}>
                                    <Text style={s.itemMetaText}>Qty: {item.quantity}</Text>
                                    <Text style={s.itemMetaText}>Unit: KES {Number(item.unit_price ?? 0).toLocaleString()}</Text>
                                    <Text style={[s.itemMetaText, { fontWeight: '700', color: '#059669' }]}>
                                        Total: KES {Number((item.quantity ?? 0) * (item.unit_price ?? 0)).toLocaleString()}
                                    </Text>
                                </View>
                                {item.po_number ? <Text style={s.itemPO}>PO: {item.po_number}</Text> : null}
                            </View>
                        ))}
                        <View style={s.itemsTotalRow}>
                            <Text style={s.itemsTotalLabel}>Requisition Total</Text>
                            <Text style={s.itemsTotalValue}>KES {Number(req.total_amount ?? 0).toLocaleString()}</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <Portal>
                {/* Reject modal */}
                <Modal visible={rejectVisible} onDismiss={() => setRejectVisible(false)} contentContainerStyle={s.modal}>
                    <Text style={s.modalTitle}>Reject Requisition</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <PaperInput label="Reason for rejection" value={rejectReason} onChangeText={setRejectReason} mode="outlined" multiline numberOfLines={3} style={{ marginBottom: 10, backgroundColor: '#f9fafb' }} outlineColor="#d1d5db" activeOutlineColor="#dc2626" autoFocus />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Button mode="outlined" onPress={() => setRejectVisible(false)} style={{ flex: 1 }}>Cancel</Button>
                        <Button mode="contained" buttonColor="#dc2626" loading={rejectMutation.isPending} onPress={() => rejectMutation.mutate(rejectReason.trim() || 'Rejected')} style={{ flex: 1 }}>Reject</Button>
                    </View>
                </Modal>

                {/* Edit modal */}
                <Modal visible={editVisible} onDismiss={() => setEditVisible(false)} contentContainerStyle={[s.modal, { maxHeight: '90%' }]}>
                    <Text style={s.modalTitle}>Edit Requisition</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput label="Title" value={editForm.title} onChangeText={v => setEditForm(f => ({ ...f, title: v }))} mode="outlined" style={s.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Requested For" value={editForm.requested_for} onChangeText={v => setEditForm(f => ({ ...f, requested_for: v }))} mode="outlined" style={s.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Supplier Name" value={editForm.supplier_name} onChangeText={v => setEditForm(f => ({ ...f, supplier_name: v }))} mode="outlined" style={s.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <PaperInput label="Qty" value={editForm.item_quantity} onChangeText={v => setEditForm(f => ({ ...f, item_quantity: v }))} mode="outlined" keyboardType="numeric" style={[s.fi, { flex: 1 }]} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                            <PaperInput label="Total (KES)" value={editForm.total_amount} onChangeText={v => setEditForm(f => ({ ...f, total_amount: v }))} mode="outlined" keyboardType="numeric" style={[s.fi, { flex: 2 }]} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        </View>
                        <PaperInput label="Notes" value={editForm.notes} onChangeText={v => setEditForm(f => ({ ...f, notes: v }))} mode="outlined" multiline numberOfLines={2} style={s.fi} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 }}>
                            <Button mode="outlined" onPress={() => setEditVisible(false)} style={{ flex: 1 }}>Cancel</Button>
                            <Button mode="contained" buttonColor="#059669" loading={updateMutation.isPending} onPress={() => updateMutation.mutate({ ...editForm, item_quantity: parseInt(editForm.item_quantity) || 1, total_amount: parseFloat(editForm.total_amount) || 0 })} style={{ flex: 1 }}>Save</Button>
                        </View>
                    </ScrollView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
    iconBtn: { padding: 8 },
    progressSection: { paddingHorizontal: 16, marginBottom: 8 },
    currentStageLabel: { fontSize: 13, fontWeight: '600', color: '#b45309', marginBottom: 6 },
    progressBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, marginBottom: 4 },
    progressFill: { height: 6, backgroundColor: '#059669', borderRadius: 3 },
    stepLabel: { fontSize: 11, color: '#9ca3af' },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginHorizontal: 16, marginBottom: 8 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#059669' },
    tabText: { fontSize: 14, color: '#6b7280' },
    tabTextActive: { color: '#059669', fontWeight: '700' },
    scroll: { padding: 16, paddingTop: 0, paddingBottom: 40 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
    fieldLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    fieldValue: { fontSize: 15, color: '#111827', marginBottom: 4 },
    div: { marginVertical: 10 },
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#d1fae5', borderRadius: 12, paddingVertical: 12 },
    approveBtnText: { color: '#059669', fontWeight: '700', fontSize: 14 },
    rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 12 },
    rejectBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
    pipelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    stageIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    stageName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    stageMeta: { fontSize: 12, color: '#9ca3af', lineHeight: 17 },
    itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
    itemDesc: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 6 },
    itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    itemMetaText: { fontSize: 12, color: '#6b7280' },
    itemPO: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
    itemsTotalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 1 },
    itemsTotalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
    itemsTotalValue: { fontSize: 16, fontWeight: '800', color: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    fi: { marginBottom: 10, backgroundColor: '#f9fafb' },
});
