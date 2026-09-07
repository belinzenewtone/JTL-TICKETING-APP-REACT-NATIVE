import { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Modal, Portal, Button, Divider, TextInput as PaperInput } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react-native';
import { tasksApi } from '@/api/client';
import { TaskCard } from '@/components/TaskCard';
import { EmptyState } from '@/components/EmptyState';
import { DatePickerField } from '@/components/DatePickerField';
import { useAppStore } from '@/store/useAppStore';
import type { Task, ImportanceLevel } from '@/types/database';

const IMPORTANCES: ImportanceLevel[] = ['urgent', 'important', 'neutral'];

export default function TasksScreen() {
    const queryClient = useQueryClient();
    const { taskFilter, taskImportance, taskSearch, setTaskFilter, setTaskImportance, setTaskSearch } = useAppStore();
    const [createVisible, setCreateVisible] = useState(false);
    const [newText, setNewText] = useState('');
    const [newImportance, setNewImportance] = useState<ImportanceLevel>('neutral');
    const [newDate, setNewDate] = useState('');

    const params: Record<string, string> = {};
    if (taskFilter === 'completed') params.completed = 'true';
    if (taskFilter === 'pending') params.completed = 'false';
    if (taskImportance !== 'all') params.importance = taskImportance;
    if (taskSearch.trim()) params.search = taskSearch.trim();

    const { data: tasks = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['tasks', params],
        queryFn: () => tasksApi.list(params).then(r => r.data as Task[]),
    });

    const createMutation = useMutation({
        mutationFn: (data: { text: string; importance: ImportanceLevel; date: string }) =>
            tasksApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setCreateVisible(false);
            setNewText('');
            setNewImportance('neutral');
            setNewDate('');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            tasksApi.update(id, { completed }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => tasksApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const handleCreate = () => {
        if (!newText.trim()) return;
        createMutation.mutate({
            text: newText.trim(),
            importance: newImportance,
            date: newDate || new Date().toISOString().split('T')[0],
        });
    };

    const pending = tasks.filter(t => !t.completed).length;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Tasks</Text>
                <Text style={styles.headerSub}>{pending} pending</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
                <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search tasks…"
                    placeholderTextColor="#9ca3af"
                    value={taskSearch}
                    onChangeText={setTaskSearch}
                    returnKeyType="search"
                />
                {taskSearch ? (
                    <TouchableOpacity onPress={() => setTaskSearch('')}>
                        <X size={16} color="#9ca3af" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
                {(['all', 'pending', 'completed'] as const).map(f => (
                    <TouchableOpacity key={f} style={[styles.chip, taskFilter === f && styles.chipActive]} onPress={() => setTaskFilter(f)}>
                        <Text style={[styles.chipText, taskFilter === f && styles.chipTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
                <View style={styles.dividerV} />
                {IMPORTANCES.map(i => (
                    <TouchableOpacity key={i} style={[styles.chip, taskImportance === i && styles.chipActive]} onPress={() => setTaskImportance(taskImportance === i ? 'all' : i)}>
                        <Text style={[styles.chipText, taskImportance === i && styles.chipTextActive]}>{i}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={tasks}
                keyExtractor={t => t.id}
                renderItem={({ item }) => (
                    <TaskCard
                        task={item}
                        onToggle={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })}
                        onDelete={() => deleteMutation.mutate(item.id)}
                    />
                )}
                contentContainerStyle={tasks.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
                ListEmptyComponent={
                    <EmptyState
                        title={isLoading ? 'Loading tasks…' : 'No tasks found'}
                        subtitle={isLoading ? '' : 'Tap + to add your first task'}
                    />
                }
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />}
            />

            <FAB icon={() => <Plus size={22} color="#ffffff" />} style={styles.fab} onPress={() => setCreateVisible(true)} />

            <Portal>
                <Modal visible={createVisible} onDismiss={() => setCreateVisible(false)} contentContainerStyle={[styles.modal, { maxHeight: '90%' }]}>
                    <Text style={styles.modalTitle}>New Task</Text>
                    <Divider style={{ marginBottom: 16 }} />

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <PaperInput
                            label="Task description"
                            value={newText}
                            onChangeText={setNewText}
                            mode="outlined"
                            multiline
                            numberOfLines={3}
                            style={styles.formInput}
                            outlineColor="#d1d5db"
                            activeOutlineColor="#059669"
                        />

                        <DatePickerField
                            label="Due date"
                            value={newDate}
                            onChangeDate={setNewDate}
                        />

                        <Text style={styles.filterLabel}>Importance</Text>
                        <View style={styles.chipRow}>
                            {IMPORTANCES.map(i => (
                                <TouchableOpacity key={i} style={[styles.chip, newImportance === i && styles.chipActive]} onPress={() => setNewImportance(i)}>
                                    <Text style={[styles.chipText, newImportance === i && styles.chipTextActive]}>
                                        {i.charAt(0).toUpperCase() + i.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Button mode="contained" buttonColor="#059669" loading={createMutation.isPending} onPress={handleCreate} style={{ marginTop: 16, marginBottom: 4 }}>
                            Add Task
                        </Button>
                    </ScrollView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
    headerSub: { fontSize: 14, color: '#059669', fontWeight: '600' },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    searchInput: { flex: 1, fontSize: 15, color: '#111827' },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
    dividerV: { width: 1, height: 24, backgroundColor: '#e5e7eb', marginHorizontal: 4, alignSelf: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
    chipActive: { backgroundColor: '#d1fae5', borderColor: '#059669' },
    chipText: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
    chipTextActive: { color: '#059669', fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#059669' },
    modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    formInput: { marginBottom: 10, backgroundColor: '#f9fafb' },
});
