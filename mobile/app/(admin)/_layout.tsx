import { Tabs } from 'expo-router';
import { Ticket, CheckSquare, Grid, User } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';

// Logout now lives in the Profile tab — no header button needed
export default function AdminLayout() {
    // Fetch dashboard stats for badge counts (stale after 60s, silent background refetch)
    const { data: stats } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.stats().then(r => r.data as any),
        staleTime: 60_000,
    });

    const openTickets: number = stats?.tickets?.open ?? 0;
    const pendingTasks: number = stats?.tasks?.pending ?? 0;

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#059669',
                tabBarInactiveTintColor: '#9ca3af',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#f3f4f6',
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    height: 60,
                    paddingBottom: 8,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="tickets"
                options={{
                    title: 'Tickets',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ticket size={size} color={color} />,
                    tabBarBadge: openTickets > 0 ? openTickets : undefined,
                    tabBarBadgeStyle: { backgroundColor: '#059669', fontSize: 10 },
                }}
            />
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tasks',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <CheckSquare size={size} color={color} />,
                    tabBarBadge: pendingTasks > 0 ? pendingTasks : undefined,
                    tabBarBadgeStyle: { backgroundColor: '#b45309', fontSize: 10 },
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Grid size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <User size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
