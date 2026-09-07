import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, FlatList, Pressable,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}
function toISO(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface Props {
    value: string; // YYYY-MM-DD or ''
    onChangeDate: (iso: string) => void;
    label?: string;
}

export function DatePickerField({ value, onChangeDate, label = 'Due date' }: Props) {
    const today = new Date();
    const parsed = value ? new Date(value + 'T00:00:00') : null;

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());
    const [selected, setSelected] = useState<string>(value);

    const openPicker = useCallback(() => {
        const base = selected ? new Date(selected + 'T00:00:00') : today;
        setViewYear(base.getFullYear());
        setViewMonth(base.getMonth());
        setOpen(true);
    }, [selected]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const selectDay = (day: number) => {
        const iso = toISO(viewYear, viewMonth, day);
        setSelected(iso);
        onChangeDate(iso);
        setOpen(false);
    };

    const clear = () => {
        setSelected('');
        onChangeDate('');
        setOpen(false);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    // Build grid: blanks for leading days + actual days
    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to full rows
    while (cells.length % 7 !== 0) cells.push(null);

    const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedISO = selected || '';

    const displayText = selected
        ? new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

    return (
        <>
            {/* Field button */}
            <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.75}>
                <View style={styles.fieldInner}>
                    <Calendar size={16} color={selected ? '#059669' : '#9ca3af'} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        <Text style={[styles.fieldValue, !selected && styles.fieldPlaceholder]}>
                            {displayText || 'Select a date'}
                        </Text>
                    </View>
                    {selected ? (
                        <Pressable onPress={clear} hitSlop={10}>
                            <X size={14} color="#9ca3af" />
                        </Pressable>
                    ) : null}
                </View>
            </TouchableOpacity>

            {/* Calendar modal */}
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        {/* Month header */}
                        <View style={styles.monthNav}>
                            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                                <ChevronLeft size={20} color="#374151" />
                            </TouchableOpacity>
                            <Text style={styles.monthLabel}>
                                {MONTHS[viewMonth]} {viewYear}
                            </Text>
                            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                                <ChevronRight size={20} color="#374151" />
                            </TouchableOpacity>
                        </View>

                        {/* Day-of-week header */}
                        <View style={styles.dayRow}>
                            {DAYS.map(d => (
                                <Text key={d} style={styles.dayHeader}>{d}</Text>
                            ))}
                        </View>

                        {/* Calendar grid */}
                        <View style={styles.grid}>
                            {cells.map((day, idx) => {
                                if (!day) return <View key={idx} style={styles.cell} />;
                                const iso = toISO(viewYear, viewMonth, day);
                                const isSelected = iso === selectedISO;
                                const isToday = iso === todayISO;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            styles.cell,
                                            isSelected && styles.cellSelected,
                                            !isSelected && isToday && styles.cellToday,
                                        ]}
                                        onPress={() => selectDay(day)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.cellText,
                                            isSelected && styles.cellTextSelected,
                                            !isSelected && isToday && styles.cellTextToday,
                                        ]}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={clear} style={styles.clearBtn}>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancelBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    field: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        marginBottom: 10,
        overflow: 'hidden',
    },
    fieldInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    fieldLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
    fieldValue: { fontSize: 15, color: '#111827' },
    fieldPlaceholder: { color: '#9ca3af', fontSize: 14 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12 },

    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    navBtn: { padding: 6 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },

    dayRow: { flexDirection: 'row', marginBottom: 8 },
    dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' },

    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    cellSelected: { backgroundColor: '#059669', borderRadius: 99 },
    cellToday: { borderWidth: 1.5, borderColor: '#059669', borderRadius: 99 },
    cellText: { fontSize: 14, color: '#374151' },
    cellTextSelected: { color: '#fff', fontWeight: '700' },
    cellTextToday: { color: '#059669', fontWeight: '700' },

    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    clearBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    clearText: { fontSize: 14, color: '#dc2626' },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    cancelText: { fontSize: 14, color: '#6b7280' },
});
