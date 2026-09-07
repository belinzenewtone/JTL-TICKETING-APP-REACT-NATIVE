/**
 * Portal ticket detail — lets end users (USER role) view their own ticket,
 * read IT responses, and add public replies. Internal notes are hidden.
 */
import { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider, TextInput as PaperInput, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, MessageSquare, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';
import { ticketsApi, commentsApi } from '@/api/client';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { useAuthStore } from '@/store/useAuthStore';
import type { Ticket, TicketComment } from '@/types/database';

function formatDate(s: string) {
    try {
        return new Date(s).toLocaleString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return s; }
}

function formatShortDate(s: string) {
    try {
        return new Date(s).toLocaleString('en-KE', {
            day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return s; }
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    open:        <AlertCircle size={15} color="#1d4ed8" />,
    'in-progress': <Clock size={15} color="#b45309" />,
    resolved:    <CheckCircle2 size={15} color="#059669" />,
    closed:      <CheckCircle2 size={15} color="#6b7280" />,
};

const CATEGORY_LABELS: Record<string, string> = {
    'email': '📧 Email',
    'account-login': '🔐 Account / Login',
    'password-reset': '🔑 Password Reset',
    'hardware': '🖥️ Hardware',
    'software': '💾 Software',
    'network-vpn': '🌐 Network / VPN',
    'other': '📋 Other',
};

export default function PortalTicketDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [comment, setComment] = useState('');

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['portal-ticket', id],
        queryFn: () => ticketsApi.get(id).then((r: { data: Ticket }) => r.data),
    });

    const { data: rawComments = [] } = useQuery({
        queryKey: ['portal-comments', id],
        queryFn: () => commentsApi.list(id).then((r: { data: TicketComment[] }) => r.data),
        enabled: !!ticket,
    });

    // End-users must never see internal notes
    const comments = rawComments.filter((c: TicketComment) => !c.is_internal);

    const commentMutation = useMutation({
        mutationFn: (content: string) =>
            commentsApi.create({ ticket_id: id, content, is_internal: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portal-comments', id] });
            queryClient.invalidateQueries({ queryKey: ['portal-tickets'] });
            setComment('');
        },
    });

    /* ── Loading ── */
    if (isLoading || !ticket) {
        return (
            <SafeAreaView style={styles.root} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={22} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Loading…</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#059669" />
                </View>
            </SafeAreaView>
        );
    }

    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={22} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ticket #{ticket.number}</Text>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>

                    {/* ── Status hero ── */}
                    <View style={[styles.heroCard, isResolved && styles.heroResolved]}>
                        <View style={styles.heroRow}>
                            {STATUS_ICON[ticket.status]}
                            <Text style={[styles.heroStatus, isResolved && { color: '#059669' }]}>
                                {ticket.status === 'in-progress' ? 'In Progress' :
                                    ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                            </Text>
                        </View>
                        <Text style={styles.heroSubject} numberOfLines={3}>{ticket.subject}</Text>
                        <View style={styles.badgeRow}>
                            <PriorityBadge priority={ticket.priority} />
                            {ticket.category && (
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>
                                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.heroDate}>
                            Submitted {formatDate(ticket.ticket_date)}
                        </Text>
                    </View>

                    {/* ── Description ── */}
                    {ticket.description ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Your Description</Text>
                            <Text style={styles.descText}>{ticket.description}</Text>
                        </View>
                    ) : null}

                    {/* ── Resolution (if resolved) ── */}
                    {ticket.resolution_notes ? (
                        <View style={styles.resolutionCard}>
                            <View style={styles.resolutionHeader}>
                                <CheckCircle2 size={16} color="#059669" />
                                <Text style={styles.resolutionTitle}>IT Resolution</Text>
                            </View>
                            <Text style={styles.resolutionText}>{ticket.resolution_notes}</Text>
                        </View>
                    ) : null}

                    {/* ── Comments ── */}
                    <View style={styles.section}>
                        <View style={styles.commentsHeader}>
                            <MessageSquare size={15} color="#6b7280" />
                            <Text style={styles.sectionLabel}>
                                Updates {comments.length > 0 ? `(${comments.length})` : ''}
                            </Text>
                        </View>

                        {comments.length === 0 ? (
                            <View style={styles.noComments}>
                                <Text style={styles.noCommentsText}>
                                    No updates yet. IT Support will respond here.
                                </Text>
                            </View>
                        ) : (
                            comments.map((c: TicketComment) => {
                                const isMyMessage = c.user_id === user?.id;
                                return (
                                    <View
                                        key={c.id}
                                        style={[
                                            styles.bubble,
                                            isMyMessage ? styles.bubbleMe : styles.bubbleThem,
                                        ]}
                                    >
                                        {!isMyMessage && (
                                            <Text style={styles.bubbleAuthor}>{c.author_name}</Text>
                                        )}
                                        <Text style={[
                                            styles.bubbleText,
                                            isMyMessage && { color: '#fff' },
                                        ]}>
                                            {c.content}
                                        </Text>
                                        <Text style={[
                                            styles.bubbleTime,
                                            isMyMessage && { color: 'rgba(255,255,255,0.65)' },
                                        ]}>
                                            {formatShortDate(c.created_at)}
                                        </Text>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                {/* ── Reply bar (hidden if closed) ── */}
                {!isResolved ? (
                    <View style={styles.replyBar}>
                        <PaperInput
                            value={comment}
                            onChangeText={setComment}
                            placeholder="Add a reply…"
                            mode="outlined"
                            multiline
                            style={styles.replyInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, !comment.trim() && styles.sendBtnDisabled]}
                            onPress={() => comment.trim() && commentMutation.mutate(comment.trim())}
                            disabled={!comment.trim() || commentMutation.isPending}
                        >
                            {commentMutation.isPending
                                ? <ActivityIndicator size={16} color="#fff" />
                                : <Send size={18} color="#ffffff" />
                            }
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.closedBar}>
                        <CheckCircle2 size={15} color="#059669" />
                        <Text style={styles.closedBarText}>This ticket is {ticket.status}. No further replies needed.</Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
        backgroundColor: '#fff',
    },
    backBtn: { padding: 4, marginRight: 10 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
    scroll: { padding: 16, paddingBottom: 24 },

    /* Hero */
    heroCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
        borderLeftWidth: 4, borderLeftColor: '#3b82f6',
    },
    heroResolved: { borderLeftColor: '#059669' },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    heroStatus: { fontSize: 13, fontWeight: '700', color: '#1d4ed8', textTransform: 'capitalize' },
    heroSubject: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10, lineHeight: 24 },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
    categoryBadge: {
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
        backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
    },
    categoryText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
    heroDate: { fontSize: 12, color: '#9ca3af' },

    /* Sections */
    section: { marginBottom: 16 },
    sectionLabel: {
        fontSize: 12, fontWeight: '700', color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    descText: {
        fontSize: 14, color: '#374151', lineHeight: 22,
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },

    /* Resolution */
    resolutionCard: {
        backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 16,
    },
    resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    resolutionTitle: { fontSize: 13, fontWeight: '700', color: '#059669' },
    resolutionText: { fontSize: 14, color: '#166534', lineHeight: 22 },

    /* Chat bubbles */
    commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    noComments: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    noCommentsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
    bubble: {
        maxWidth: '82%', borderRadius: 16, padding: 12, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    bubbleMe: {
        alignSelf: 'flex-end', backgroundColor: '#059669',
        borderBottomRightRadius: 4,
    },
    bubbleThem: {
        alignSelf: 'flex-start', backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        borderWidth: 1, borderColor: '#e5e7eb',
    },
    bubbleAuthor: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
    bubbleText: { fontSize: 14, color: '#111827', lineHeight: 20 },
    bubbleTime: { fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },

    /* Reply bar */
    replyBar: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6',
        backgroundColor: '#fff',
    },
    replyInput: { flex: 1, backgroundColor: '#f9fafb', maxHeight: 120 },
    sendBtn: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    },
    sendBtnDisabled: { backgroundColor: '#d1d5db' },

    /* Closed bar */
    closedBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 14, backgroundColor: '#f0fdf4',
        borderTopWidth: 1, borderTopColor: '#bbf7d0',
    },
    closedBarText: { fontSize: 13, color: '#059669', flex: 1, lineHeight: 18 },
});
