import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, TextInput, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, X, Plus, Trash2, BookOpen, Pencil } from 'lucide-react-native';
import { kbApi } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import type { KbArticle } from '@/types/database';
import type { TicketCategory } from '@/types/database';

const CATEGORIES: TicketCategory[] = ['email', 'account-login', 'password-reset', 'hardware', 'software', 'network-vpn', 'other'];
const CATEGORY_LABELS: Record<TicketCategory, string> = {
    'email': 'Email', 'account-login': 'Account Login', 'password-reset': 'Password Reset',
    'hardware': 'Hardware', 'software': 'Software', 'network-vpn': 'Network/VPN', 'other': 'Other',
};

export default function KnowledgeBaseScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');

    // Create modal state
    const [createVisible, setCreateVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState<TicketCategory>('other');

    // Edit modal state
    const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState<TicketCategory>('other');

    // View modal state
    const [viewArticle, setViewArticle] = useState<KbArticle | null>(null);

    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (categoryFilter !== 'all') params.category = categoryFilter;

    const { data: articles = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['kb', params],
        queryFn: () => kbApi.list(params).then(r => r.data as KbArticle[]),
    });

    const createMutation = useMutation({
        mutationFn: (data: { title: string; content: string; category: TicketCategory }) => kbApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kb'] });
            setCreateVisible(false);
            setNewTitle('');
            setNewContent('');
            setNewCategory('other');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: { title: string; content: string; category: TicketCategory } }) =>
            kbApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kb'] });
            setEditingArticle(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => kbApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb'] }),
    });

    const openEdit = (article: KbArticle) => {
        setEditingArticle(article);
        setEditTitle(article.title);
        setEditContent(article.content);
        setEditCategory((article.category as TicketCategory) ?? 'other');
    };

    const handleUpdate = () => {
        if (!editingArticle || !editTitle.trim()) return;
        updateMutation.mutate({ id: editingArticle.id, data: { title: editTitle.trim(), content: editContent.trim(), category: editCategory } });
    };

    const handleDelete = (article: KbArticle) => {
        Alert.alert('Delete Article', `Delete "${article.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(article.id) },
        ]);
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Knowledge Base</Text>
            </View>

            <View style={styles.searchRow}>
                <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput style={styles.searchInput} placeholder="Search articles…" placeholderTextColor="#9ca3af" value={search} onChangeText={setSearch} />
                {search ? <TouchableOpacity onPress={() => setSearch('')}><X size={16} color="#9ca3af" /></TouchableOpacity> : null}
            </View>

            {/* Category filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.chip, categoryFilter === 'all' && styles.chipActive]}
                    onPress={() => setCategoryFilter('all')}
                >
                    <Text style={[styles.chipText, categoryFilter === 'all' && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {CATEGORIES.map(c => (
                    <TouchableOpacity
                        key={c}
                        style={[styles.chip, categoryFilter === c && styles.chipActive]}
                        onPress={() => setCategoryFilter(c)}
                    >
                        <Text style={[styles.chipText, categoryFilter === c && styles.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FlatList
                data={articles}
                keyExtractor={a => a.id}
                contentContainerStyle={articles.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading…' : 'No articles yet'}
                        subtitle="Create your first knowledge base article"
                        icon={<BookOpen size={40} color="#9ca3af" />}
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.articleCard} onPress={() => setViewArticle(item)} activeOpacity={0.75}>
                        <View style={styles.articleHeader}>
                            <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                            <View style={styles.articleActions}>
                                <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8} style={{ marginRight: 10 }}>
                                    <Pencil size={15} color="#6b7280" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
                                    <Trash2 size={15} color="#d1d5db" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={styles.articlePreview} numberOfLines={3}>{item.content}</Text>
                        {item.category && (
                            <View style={styles.catBadge}>
                                <Text style={styles.catText}>{CATEGORY_LABELS[item.category as TicketCategory] ?? item.category}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />

            <FAB icon={() => <Plus size={22} color="#fff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                {/* Create modal */}
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>New Article</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput label="Title" value={newTitle} onChangeText={setNewTitle} mode="outlined" style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />
                        <PaperInput label="Content" value={newContent} onChangeText={setNewContent} mode="outlined" multiline numberOfLines={6} style={styles.formInput} outlineColor="#d1d5db" activeOutlineColor="#059669" />

                        <Text style={styles.pickerLabel}>Category</Text>
                        <View style={styles.chipRowWrap}>
                            {CATEGORIES.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.chip, newCategory === c && styles.chipActive]}
                                    onPress={() => setNewCategory(c)}
                                >
                                    <Text style={[styles.chipText, newCategory === c && styles.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={() => createMutation.mutate({ title: newTitle, content: newContent, category: newCategory })} style={{ marginTop: 8, marginBottom: 4 }}>
                            Create Article
                        </Button>
                    </ScrollView>
                </Modal>

                {/* Edit modal */}
                <Modal visible={!!editingArticle} onDismiss={() => setEditingArticle(null)} contentContainerStyle={[styles.modal, { maxHeight: '92%' }]}>
                    <Text style={styles.modalTitle}>Edit Article</Text>
                    <Divider style={{ marginBottom: 16 }} />
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput
                            label="Title"
                            value={editTitle}
                            onChangeText={setEditTitle}
                            mode="outlined"
                            style={styles.formInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                        />
                        <PaperInput
                            label="Content"
                            value={editContent}
                            onChangeText={setEditContent}
                            mode="outlined"
                            multiline
                            numberOfLines={6}
                            style={styles.formInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                        />

                        <Text style={styles.pickerLabel}>Category</Text>
                        <View style={styles.chipRowWrap}>
                            {CATEGORIES.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.chip, editCategory === c && styles.chipActive]}
                                    onPress={() => setEditCategory(c)}
                                >
                                    <Text style={[styles.chipText, editCategory === c && styles.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={[styles.rowButtons, { marginBottom: 4 }]}>
                            <Button mode="outlined" onPress={() => setEditingArticle(null)} style={{ flex: 1 }}>Cancel</Button>
                            <Button
                                mode="contained"
                                buttonColor="#059669"
                                loading={updateMutation.isPending}
                                onPress={handleUpdate}
                                style={{ flex: 1 }}
                            >
                                Save
                            </Button>
                        </View>
                    </ScrollView>
                </Modal>

                {/* View article modal */}
                <Modal visible={!!viewArticle} onDismiss={() => setViewArticle(null)} contentContainerStyle={[styles.modal, { maxHeight: '80%' }]}>
                    {viewArticle && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{viewArticle.title}</Text>
                            {viewArticle.category && (
                                <View style={[styles.catBadge, { marginBottom: 12 }]}>
                                    <Text style={styles.catText}>{CATEGORY_LABELS[viewArticle.category as TicketCategory] ?? viewArticle.category}</Text>
                                </View>
                            )}
                            <Divider style={{ marginBottom: 12 }} />
                            <Text style={styles.articleBody}>{viewArticle.content}</Text>
                            <View style={styles.rowButtons}>
                                <Button mode="outlined" onPress={() => { setViewArticle(null); openEdit(viewArticle); }} style={{ flex: 1 }}>
                                    Edit
                                </Button>
                                <Button mode="contained" buttonColor="#059669" onPress={() => setViewArticle(null)} style={{ flex: 1 }}>
                                    Close
                                </Button>
                            </View>
                        </ScrollView>
                    )}
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
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    searchInput: { flex: 1, fontSize: 15, color: '#111827' },
    filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 6, flexDirection: 'row' },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipText: { fontSize: 12, color: '#6b7280' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    articleCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 16, marginVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
    articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    articleTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827', marginRight: 8 },
    articleActions: { flexDirection: 'row', alignItems: 'center' },
    articlePreview: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 8 },
    catBadge: { alignSelf: 'flex-start', backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    catText: { fontSize: 11, color: '#7c3aed', fontWeight: '600', textTransform: 'capitalize' },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
    pickerLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    articleBody: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 16 },
    rowButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
