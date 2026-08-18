import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const ZendeskConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  baseUrl: z.string().url().default("https://example.zendesk.com"),
});

export type ZendeskConfig = z.infer<typeof ZendeskConfigSchema>;

// ---------------------------------------------------------------------------
// API Resource schemas -- add your own here
// ---------------------------------------------------------------------------

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Resource = z.infer<typeof ResourceSchema>;

export const ListResourcesParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type ListResourcesParams = z.infer<typeof ListResourcesParamsSchema>;

export const CreateResourceParamsSchema = z.object({
  name: z.string().min(1),
});

export type CreateResourceParams = z.infer<typeof CreateResourceParamsSchema>;

// ---------------------------------------------------------------------------
// Tickets API schemas
// ---------------------------------------------------------------------------

export const TicketSchema = z
  .object({
    id: z.number().int(),
    subject: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    status: z.string(),
    priority: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    requester_id: z.number().int().nullable().optional(),
    submitter_id: z.number().int().nullable().optional(),
    assignee_id: z.number().int().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    tags: z.array(z.string()).optional(),
    url: z.string().url().optional(),
  })
  .passthrough();

export type Ticket = z.infer<typeof TicketSchema>;

export const TicketCommentSchema = z
  .object({
    id: z.number().int(),
    author_id: z.number().int(),
    body: z.string().optional(),
    plain_body: z.string().optional(),
    html_body: z.string().optional(),
    public: z.boolean().optional(),
    created_at: z.string(),
  })
  .passthrough();

export type TicketComment = z.infer<typeof TicketCommentSchema>;

export const ZendeskUserSchema = z
  .object({
    id: z.number().int(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  })
  .passthrough();

export type ZendeskUser = z.infer<typeof ZendeskUserSchema>;

export const ShowTicketResponseSchema = z
  .object({
    ticket: TicketSchema,
    users: z.array(ZendeskUserSchema).optional(),
  })
  .passthrough();

export type ShowTicketResponse = z.infer<typeof ShowTicketResponseSchema>;

export const ListTicketCommentsResponseSchema = z
  .object({
    comments: z.array(TicketCommentSchema),
    users: z.array(ZendeskUserSchema).optional(),
    next_page: z.string().nullable().optional(),
    previous_page: z.string().nullable().optional(),
    count: z.number().int().optional(),
  })
  .passthrough();

export type ListTicketCommentsResponse = z.infer<
  typeof ListTicketCommentsResponseSchema
>;

// ---------------------------------------------------------------------------
// API Response wrappers
// ---------------------------------------------------------------------------

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  });

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------------------
// Ticket list / search schemas
// ---------------------------------------------------------------------------

export const TICKET_LIST_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "id",
  "status",
  "subject",
] as const;

export const TICKET_SEARCH_SORT_FIELDS = [
  "relevance",
  "created_at",
  "updated_at",
  "priority",
  "status",
] as const;

export const SORT_ORDERS = ["asc", "desc"] as const;

export const SortOrderSchema = z.enum(SORT_ORDERS);

export type SortOrder = z.infer<typeof SortOrderSchema>;

export const ListTicketsParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  sortBy: z.enum(TICKET_LIST_SORT_FIELDS).default("updated_at"),
  sortOrder: SortOrderSchema.default("desc"),
});

export type ListTicketsParams = z.input<typeof ListTicketsParamsSchema>;

export const SearchTicketsParamsSchema = z.object({
  query: z.string().trim().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(100).default(25),
  page: z.number().int().min(1).default(1),
  sortBy: z.enum(TICKET_SEARCH_SORT_FIELDS).default("relevance"),
  sortOrder: SortOrderSchema.default("desc"),
});

export type SearchTicketsParams = z.input<typeof SearchTicketsParamsSchema>;

export const ListTicketsResponseSchema = z
  .object({
    tickets: z.array(TicketSchema),
    meta: z
      .object({
        has_more: z.boolean().optional(),
        after_cursor: z.string().nullable().optional(),
        before_cursor: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    links: z
      .object({
        next: z.string().nullable().optional(),
        prev: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    count: z.number().int().optional(),
  })
  .passthrough();

export type ListTicketsResponse = z.infer<typeof ListTicketsResponseSchema>;

// Search returns mixed result types (tickets, users, organizations); each item
// carries a `result_type` discriminator.
export const SearchResultSchema = z
  .object({
    result_type: z.string().optional(),
  })
  .passthrough();

export const SearchTicketsResponseSchema = z
  .object({
    results: z.array(SearchResultSchema),
    next_page: z.string().nullable().optional(),
    previous_page: z.string().nullable().optional(),
    count: z.number().int().optional(),
  })
  .passthrough();

export type SearchTicketsResponse = z.infer<typeof SearchTicketsResponseSchema>;

export type ListTicketsResult = {
  tickets: Ticket[];
  has_more: boolean;
  /** Pass back as `cursor` to fetch the next page; null when exhausted. */
  next_cursor: string | null;
};

export type SearchTicketsResult = {
  /** The query actually sent to Zendesk, including the `type:ticket` filter. */
  query: string;
  tickets: Ticket[];
  /** Total matches reported by Zendesk; null when the API omits it. */
  count: number | null;
  page: number;
  has_more: boolean;
  next_page: number | null;
};
