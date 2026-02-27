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
