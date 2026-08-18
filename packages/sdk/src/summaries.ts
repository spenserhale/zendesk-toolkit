import type { Ticket } from "./types.js";

/**
 * The compact ticket projection used by list/search consumers. Full ticket
 * bodies are large; a summary keeps list output bounded and cheap to read.
 */
export interface TicketSummary {
  id: number;
  status: string;
  priority: string | null;
  type: string | null;
  subject: string | null;
  requester_id: number | null;
  assignee_id: number | null;
  created_at: string;
  updated_at: string;
}

export function summarizeTicket(ticket: Ticket): TicketSummary {
  return {
    id: ticket.id,
    status: ticket.status,
    priority: ticket.priority ?? null,
    type: ticket.type ?? null,
    subject: ticket.subject ?? null,
    requester_id: ticket.requester_id ?? null,
    assignee_id: ticket.assignee_id ?? null,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}
