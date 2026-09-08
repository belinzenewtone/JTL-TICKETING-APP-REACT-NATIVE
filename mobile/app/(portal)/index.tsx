import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl, ScrollView, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Monitor } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { portalApi } from '@/api/client';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/store/useAuthStore';
import type { Ticket, TicketCategory, MachineRequest, MachineItemType, ImportanceLevel } from '@/types/database';

const CATEGORY_LABELS: Record<string, string> = {
    'email': 'Email',
    'account-login': 'Account / Login',
    'password-reset': 'Password Reset',
    'hardware': 'Hardware',
    'software': 'Software',
    'network-vpn': 'Network / VPN',
    'other': 'Other',
};
const CATEGORIES: TicketCategory[] = ['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other'];
const ITEM_TYPES: MachineItemType[] = ['desktop', 'laptop', 'supplies'];
const ITEM_LABELS: Record<MachineItemType, string> = { desktop: 'Desktop', laptop: 'Laptop', supplies: 'Supplies' };
const REASONS = ['old-hardware', 'faulty', 'new-user'];
const REASON_LABELS: Record<string, string> = { 'old-hardware': 'Old Hardware', faulty: 'Faulty', 'new-user': 'New User' };
const IMPORTANCE: ImportanceLevel[] = ['urgent', 'important', 'neutral'];
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#fef3c7', text: '#b45309' },
    approved:  { bg: '#d1fae5', text: '#059669' },
    fulfilled: { bg: '#dbeafe', text: '#1d4ed8' },
    rejected:  { bg: '#fee2e2', text: '#dc2626' },
};

type ActiveTab = 'tickets' | 'requests';

function TicketItem({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.ticketCard} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.ticketHeader}>
                <Text style={styles.ticketNum}>#{ticket.number}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <ChevronRight size={14} color="#9ca3af" />
                </View>
            </View>
            <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
            {ticket.category && (
                <Text style={styles.ticketCategory}>
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </Text>
            )}
            <Text style={styles.ticketDate}>
                {new Date(ticket.ticket_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            {ticket.resolution_notes ? (
                <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>✓ Resolution</Text>
                    <Text style={styles.resolutionText} numberOfLines={2}>{ticket.resolution_notes}</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

function MachineItem({ item }: { item: MachineRequest }) {
    const c = STATUS_COLOR[item.status] ?? { bg: '#f3f4f6', text: '#6b7280' };
    return (
        <View style={styles.machineCard}>
            <View style={styles.machineHeader}>
                <Text style={styles.machineNum}>REQ-{String(item.number ?? '').padStart(3, '0')}</Text>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                    <Text style={[styles.badgeText, { color: c.text }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                </View>
            </View>
            <View style={styles.machineTags}>
                {item.item_type && (
                    <View style={styles.tag}><Text style={styles.tagText}>{ITEM_LABELS[item.item_type as MachineItemType] ?? item.item_type}</Text></View>
                )}
                <View style={[styles.tag, item.importance === 'urgent' && { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.tagText, item.importance === 'urgent' && { color: '#dc2626' }]}>{item.importance}</Text>
                </View>
            </View>
            {item.notes ? <Text style={styles.machineNotes} numberOfLines={2}>{item.notes}</Text> : null}
            {item.resolution_notes ? (
                <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>✓ Update</Text>
                    <Text style={styles.resolutionText} numberOfLines={2}>{item.resolution_notes}</Text>
                </View>
            ) : null}
            <Text style={styles.ticketDate}>{new Date(item.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
    );
}

export default function PortalScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<ActiveTab>('tickets');

    // Ticket submit modal
    const [createVisible, setCreateVisible] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<TicketCategory>('other');

    // Machine request submit modal
    const [machineVisible, setMachineVisible] = useState(false);
    const [machineForm, setMachineForm] = useState({
        item_type: 'desktop' as MachineItemType,
        reason: 'faulty',
        importance: 'neutral' as ImportanceLevel,
        supply_name: '',
        item_count: '1',
        notes: '',
    });

    const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets, isRefetching: ticketsRefetching } = useQuery({
        queryKey: ['portal-tickets'],
        queryFn: () => portalApi.myTickets().then(r => r.data as Ticket[]),
    });

    const { data: machineReqs = [], isLoading: machineLoading, refetch: refetchMachines, isRefetching: machineRefetching } = useQuery({
        queryKey: ['portal-machines'],
        queryFn: () => portalApi.myMachineRequests().then(r => r.data as MachineRequest[]),
    });

    const submitMutation = useMutation({
        mutationFn: (data: { subject: string; description: string; category: TicketCategory }) =>
            portalApi.submit(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            setCreateVisible(false);
            setSubject('');
            setDescription('');
            setCategory('other');
        },
    });

    const submitMachineMutation = useMutation({
        mutationFn: (data: any) => portalApi.submitMachineRequest(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-machines'] });
            setMachineVisible(false);
            setMachineForm({ item_type: 'desktop', reason: 'faulty', importance: 'neutral', supply_name: '', item_count: '1', notes: '' });
        },
    });

    const handleSubmit = () => {
        if (!subject.trim()) return;
        submitMutation.mutate({ subject: subject.trim(), description: description.trim(), category });
    };

    const handleMachineSubmit = () => {
        submitMachineMutation.mutate({
            ...machineForm,
            item_count: parseInt(machineForm.item_count) || 1,
            supply_name: machineForm.item_type === 'supplies' ? machineForm.supply_name : null,
            date: new Date().toISOString().split('T')[0],
            requester_name: user?.name ?? '',
            work_email: user?.email ?? '',
        });
    };

    const open = tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
                    <Text style={styles.headerSub}>{open} ticket{open !== 1 ? 's' : ''} in progress</Text>
                </View>
            </View>

            {/* Stats bar */}
            <View style={styles.statsBar}>
                {[
                    { label: 'Tickets', value: tickets.length, color: '#059669' },
                    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: '#1d4ed8' },
                    { label: 'Requests', value: machineReqs.length, color: '#be185d' },
                    { label: 'Pending', value: machineReqs.filter(m => m.status === 'pending').length, color: '#b45309' },
                ].map(s => (
                    <View key={s.label} style={styles.statItem}>
                        <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity style={[styles.tab, activeTab === 'tickets' && styles.tabActive]} onPress={() => setActiveTab('tickets')}>
                    <Text style={[styles.tabText, activeTab === 'tickets' && styles.tabTextActive]}>My Tickets</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'requests' && styles.tabActive]} onPress={() => setActiveTab('requests')}>
                    <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Item Requests</Text>
                </TouchableOpacity>
            </View>

            {/* Tickets list */}
            {activeTab === 'tickets' && (
                <FlatList
                    data={tickets}
                    keyExtractor={t => t.id}
                    renderItem={({ item }) => (
                        <TicketItem ticket={item} onPress={() => router.push(`/(portal)/tickets/${item.id}`)} />
                    )}
                    contentContainerStyle={tickets.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                    ListEmptyComponent={
                        <EmptyState
                            title={ticketsLoading ? 'Loading…' : 'No tickets yet'}
                            subtitle="Submit a new ticket and our IT team will assist you"
                        />
                    }
                    refreshControl={<RefreshControl refreshing={ticketsRefetching} onRefresh={refetchTickets} tintColor="#059669" />}
                />
            )}

            {/* Machine requests list */}
            {activeTab === 'requests' && (
                <FlatList
                    data={machineReqs}
                    keyExtractor={m => m.id}
                    renderItem={({ item }) => <MachineItem item={item} />}
                    contentContainerStyle={machineReqs.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                    ListEmptyComponent={
                        <EmptyState
                            title={machineLoading ? 'Loading…' : 'No requests yet'}
                            subtitle="Request a new device or supplies from IT"
                            icon={<Monitor size={40} color="#9ca3af" />}
                        />
                    }
                    refreshControl={<RefreshControl refreshing={machineRefetching} onRefresh={refetchMachines} tintColor="#059669" />}
                />
            )}

            {/* FABs */}
            {activeTab === 'tickets' && (
                <FAB
                    icon={() => <Plus size={22} color="#ffffff" />}
                    label="Submit Ticket"
                    style={styles.fab}
                    onPress={() => setCreateVisible(true)}
                />
            )}
            {activeTab === 'requests' && (
                <FAB
                    icon={() => <Plus size={22} color="#ffffff" />}
                    label="Request Item"
                    style={[styles.fab, { backgroundColor: '#be185d' }]}
                    onPress={() => setMachineVisible(true)}
                />
            )}

            <Portal>
                {/* Submit ticket modal */}
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '90%' }]}>
                    <Text style={styles.modalTitle}>Submit a Ticket</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput
                            label="Subject"
                            value={subject}
                            onChangeText={setSubject}
                            mode="outlined"
                            style={styles.formInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                            placeholder="Briefly describe your issue"
                        />
                        <PaperInput
                            label="Description (optional)"
                            value={description}
                            onChangeText={setDescription}
                            mode="outlined"
                            multiline
                            numberOfLines={4}
                            style={styles.formInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                            placeholder="Provide more detail…"
                        />

                        <Text style={styles.filterLabel}>Category</Text>
                        <View style={styles.chipRow}>
                            {CATEGORIES.map(c => (
                                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                                        {CATEGORY_LABELS[c] ?? c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Button mode="contained" buttonColor="#059669" loading={submitMutation.isPending} onPress={handleSubmit} style={{ marginTop: 16, marginBottom: 4 }}>
                            Submit Ticket
                        </Button>
                    </ScrollView>
                </Modal>

                {/* Submit machine request modal */}
                <Modal visible={machineVisible} onDismiss={() => setMachineVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>Request an Item</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <Text style={styles.filterLabel}>What do you need?</Text>
                        <View style={styles.chipRow}>
                            {ITEM_TYPES.map(t => (
                                <TouchableOpacity key={t} style={[styles.chip, machineForm.item_type === t && styles.chipActive]} onPress={() => setMachineForm(f => ({ ...f, item_type: t }))}>
                                    <Text style={[styles.chipText, machineForm.item_type === t && styles.chipTextActive]}>{ITEM_LABELS[t]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {machineForm.item_type === 'supplies' ? (
                            <PaperInput label="Supply Name" value={machineForm.supply_name} onChangeText={v => setMachineForm(f => ({ ...f, supply_name: v }))} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        ) : (
                            <>
                                <Text style={styles.filterLabel}>Reason</Text>
                                <View style={styles.chipRow}>
                                    {REASONS.map(r => (
                                        <TouchableOpacity key={r} style={[styles.chip, machineForm.reason === r && styles.chipActive]} onPress={() => setMachineForm(f => ({ ...f, reason: r }))}>
                                            <Text style={[styles.chipText, machineForm.reason === r && styles.chipTextActive]}>{REASON_LABELS[r]}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <PaperInput label="Quantity" value={machineForm.item_count} onChangeText={v => setMachineForm(f => ({ ...f, item_count: v }))} mode="outlined" keyboardType="numeric" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Text style={styles.filterLabel}>Priority</Text>
                        <View style={styles.chipRow}>
                            {IMPORTANCE.map(i => (
                                <TouchableOpacity key={i} style={[styles.chip, machineForm.importance === i && styles.chipActive]} onPress={() => setMachineForm(f => ({ ...f, importance: i }))}>
                                    <Text style={[styles.chipText, machineForm.importance === i && styles.chipTextActive]}>{i.charAt(0).toUpperCase() + i.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <PaperInput label="Notes (optional)" value={machineForm.notes} onChangeText={v => setMachineForm(f => ({ ...f, notes: v }))} mode="outlined" multiline numberOfLines={3} style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Button mode="contained" buttonColor="#be185d" loading={submitMachineMutation.isPending} onPress={handleMachineSubmit} style={{ marginTop: 16, marginBottom: 4 }}>
                            Submit Request
                        </Button>
                    </ScrollView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    greeting: { fontSize: 24, fontWeight: '800', color: '#111827' },
    headerSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    statsBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginHorizontal: 16, marginBottom: 8 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#059669' },
    tabText: { fontSize: 14, color: '#6b7280' },
    tabTextActive: { color: '#059669', fontWeight: '700' },
    ticketCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    ticketNum: { fontSize: 12, fontWeight: '700', color: '#059669' },
    ticketSubject: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
    ticketCategory: { fontSize: 12, color: '#6b7280', marginBottom: 3 },
    ticketDate: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
    machineCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, elevation: 1 },
    machineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    machineNum: { fontSize: 12, fontWeight: '700', color: '#be185d' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    machineTags: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    tagText: { fontSize: 11, color: '#374151' },
    machineNotes: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 6 },
    resolutionBox: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 8 },
    resolutionLabel: { fontSize: 11, fontWeight: '600', color: '#059669', marginBottom: 4, textTransform: 'uppercase' },
    resolutionText: { fontSize: 13, color: '#374151', lineHeight: 19 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipText: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
});
