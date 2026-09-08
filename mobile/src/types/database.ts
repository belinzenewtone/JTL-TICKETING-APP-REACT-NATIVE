// Copied from Next.js src/types/database.ts — keep in sync

export type UserRole = 'ADMIN' | 'IT_STAFF' | 'USER';
export type ImportanceLevel = 'urgent' | 'important' | 'neutral';
export type MachineReason = 'old-hardware' | 'faulty' | 'new-user';
export type MachineStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';
export type MachineItemType = 'desktop' | 'laptop' | 'supplies';

export interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    date: string;
    text: string;
    importance: ImportanceLevel;
    completed: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateTaskInput {
    date: string;
    text: string;
    importance: ImportanceLevel;
}

export type TicketCategory = 'email' | 'account-login' | 'password-reset' | 'hardware' | 'software' | 'network-vpn' | 'other';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type TicketSentiment = 'positive' | 'neutral' | 'frustrated' | 'angry';

export interface Ticket {
    id: string;
    number: number;
    ticket_date: string;
    employee_name: string;
    department: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    sentiment?: TicketSentiment;
    subject: string;
    description: string;
    resolution_notes: string;
    internal_notes: string | null;
    due_date: string | null;
    created_by: string | null;
    assigned_to: string | null;
    attachment_url: string | null;
    merged_into: string | null;
    created_at: string;
    updated_at: string;
    comment_count: number;
    public_comment_count: number;
}

export interface CreateTicketInput {
    ticket_date?: string;
    employee_name: string;
    department?: string;
    category: TicketCategory;
    priority: TicketPriority;
    status?: TicketStatus;
    sentiment?: TicketSentiment;
    subject: string;
    description?: string;
    attachment_url?: string | null;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    author_name: string;
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface KbArticle {
    id: string;
    title: string;
    content: string;
    category: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// ── Shared inline types — now exported for reuse ────────────────────────────

export interface StaffUser {
    id: string;
    name: string | null;
    email: string | null;
    role?: UserRole;
}

export interface ActivityEntry {
    id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    user_name: string;
    created_at: string;
}

export interface DashboardStats {
    tickets: {
        total: number;
        open: number;
        in_progress: number;
        resolved: number;
        closed: number;
        today: number;
        this_week: number;
        critical: number;
        overdue: number;
    };
    tasks: {
        total: number;
        completed: number;
        pending: number;
        urgent: number;
    };
    machines: {
        total: number;
        pending: number;
        approved: number;
        fulfilled: number;
        rejected: number;
    };
}

// ────────────────────────────────────────────────────────────────────────────

export interface MachineRequest {
    id: string;
    number: number;
    requester_name: string;
    user_name: string;
    work_email: string;
    reason: MachineReason;
    importance: ImportanceLevel;
    item_type: MachineItemType | null;
    item_count: number | null;
    supply_name: string | null;
    status: MachineStatus;
    notes: string | null;
    resolution_notes: string | null;
    internal_notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type ResolutionType = 'sorted' | 'alt-email' | 'alt-phone' | 'alt-both' | 'never-used' | 'licensing';

export interface Entry {
    id: string;
    entry_date: string;
    employee_name: string;
    work_email: string;
    employee_phone: string | null;
    alt_email_status: string | null;
    alt_email: string | null;
    resolution: ResolutionType;
    completed: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type RequisitionType = 'it-equipment' | 'office-supplies' | 'services' | 'other';

export interface Requisition {
    id: string;
    number: number;
    title: string;
    requisition_date: string | null;
    requested_for: string | null;
    requestor_name: string | null;
    requestor_email: string | null;
    supplier_name: string;
    item_quantity: number | null;
    total_amount: number | null;
    item_type: RequisitionType | null;
    current_stage: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}
