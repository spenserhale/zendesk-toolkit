import { encode } from "@toon-format/toon";
import type { FastMCP } from "fastmcp";
import { z } from "zod";
import type { TicketComment } from "@zendesk-toolkit/sdk";
import {
  SORT_ORDERS,
  TICKET_LIST_SORT_FIELDS,
  TICKET_SEARCH_SORT_FIELDS,
  ZendeskClient,
  resolveConfig,
  summarizeTicket,
} from "@zendesk-toolkit/sdk";

const outputFormatSchema = z.enum(["json", "toon"]);
type OutputFormat = z.infer<typeof outputFormatSchema>;

function getClient(): ZendeskClient {
  const config = resolveConfig();
  return new ZendeskClient(config);
}

function render(data: unknown, format: OutputFormat): string {
  if (format === "toon") {
    return encode(data, { keyFolding: "safe" });
  }

  return JSON.stringify(data, null, 2);
}

function getCommentBody(comment: TicketComment): string {
  return (
    comment.plain_body ??
    comment.body ??
    comment.html_body ??
    "(comment body unavailable)"
  );
}

export function registerResourceTools(server: FastMCP) {
  server.addTool({
    name: "list_resources",
    description: "List Zendesk resources with pagination",
    parameters: z.object({
      page: z.number().int().positive().default(1).describe("Page number"),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .default(20)
        .describe("Items per page"),
    }),
    execute: async (args) => {
      const client = getClient();
      const result = await client.listResources({
        page: args.page,
        limit: args.limit,
      });

      return JSON.stringify(result, null, 2);
    },
  });

  server.addTool({
    name: "get_resource",
    description: "Get a Zendesk resource by its ID",
    parameters: z.object({
      id: z.string().describe("The resource ID"),
    }),
    execute: async (args) => {
      const client = getClient();
      const resource = await client.getResource(args.id);
      return JSON.stringify(resource, null, 2);
    },
  });

  server.addTool({
    name: "create_resource",
    description: "Create a new Zendesk resource",
    parameters: z.object({
      name: z.string().min(1).describe("Name for the new resource"),
    }),
    execute: async (args) => {
      const client = getClient();
      const resource = await client.createResource({ name: args.name });
      return JSON.stringify(resource, null, 2);
    },
  });

  server.addTool({
    name: "delete_resource",
    description: "Delete a Zendesk resource by its ID",
    parameters: z.object({
      id: z.string().describe("The resource ID to delete"),
    }),
    execute: async (args) => {
      const client = getClient();
      await client.deleteResource(args.id);
      return `Successfully deleted resource ${args.id}`;
    },
  });

  server.addTool({
    name: "get_ticket",
    description: "Get the main details for a Zendesk ticket by ID",
    parameters: z.object({
      id: z.string().describe("The ticket ID"),
      format: outputFormatSchema
        .default("json")
        .describe("Output format: json or toon"),
    }),
    execute: async (args) => {
      const client = getClient();
      const ticket = await client.getTicket(args.id);

      const ticketDetails = {
        id: ticket.id,
        subject: ticket.subject ?? null,
        status: ticket.status,
        priority: ticket.priority ?? null,
        type: ticket.type ?? null,
        requester_id: ticket.requester_id ?? null,
        assignee_id: ticket.assignee_id ?? null,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        tags: ticket.tags ?? [],
        description: ticket.description ?? null,
      };

      return render(ticketDetails, args.format);
    },
  });

  server.addTool({
    name: "get_ticket_comments",
    description: "Get all comments for a ticket, including ticket summary details",
    parameters: z.object({
      id: z.string().describe("The ticket ID"),
      format: outputFormatSchema
        .default("toon")
        .describe("Output format: json or toon"),
    }),
    execute: async (args) => {
      const client = getClient();
      const [ticket, comments] = await Promise.all([
        client.getTicket(args.id),
        client.getTicketComments(args.id),
      ]);

      const payload = {
        ticket: {
          id: ticket.id,
          subject: ticket.subject ?? null,
          status: ticket.status,
          priority: ticket.priority ?? null,
          type: ticket.type ?? null,
          requester_id: ticket.requester_id ?? null,
          assignee_id: ticket.assignee_id ?? null,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
        },
        comment_count: comments.length,
        comments: comments.map((comment) => ({
          id: comment.id,
          created_at: comment.created_at,
          author_id: comment.author_id,
          visibility: comment.public === false ? "internal" : "public",
          body: getCommentBody(comment),
        })),
      };

      return render(payload, args.format);
    },
  });

  server.addTool({
    name: "list_tickets",
    description: "List tickets, newest updated first, one bounded page at a time",
    parameters: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Tickets per page"),
      cursor: z
        .string()
        .optional()
        .describe("next_cursor from a previous call"),
      sort_by: z.enum(TICKET_LIST_SORT_FIELDS).default("updated_at"),
      sort_order: z.enum(SORT_ORDERS).default("desc"),
      format: outputFormatSchema
        .default("toon")
        .describe("Output format: json or toon"),
    }),
    execute: async (args) => {
      const client = getClient();
      const result = await client.listTickets({
        limit: args.limit,
        cursor: args.cursor,
        sortBy: args.sort_by,
        sortOrder: args.sort_order,
      });

      return render(
        {
          ticket_count: result.tickets.length,
          has_more: result.has_more,
          next_cursor: result.next_cursor,
          ...(result.has_more
            ? { hint: "pass next_cursor as cursor to fetch the following page" }
            : {}),
          tickets: result.tickets.map(summarizeTicket),
        },
        args.format
      );
    },
  });

  server.addTool({
    name: "search_tickets",
    description:
      "Search tickets with Zendesk search syntax (e.g. status:open priority:urgent)",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .describe("Zendesk search query; scoped to type:ticket automatically"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Results per page"),
      page: z.number().int().min(1).max(1000).default(1),
      sort_by: z.enum(TICKET_SEARCH_SORT_FIELDS).default("relevance"),
      sort_order: z.enum(SORT_ORDERS).default("desc"),
      format: outputFormatSchema
        .default("toon")
        .describe("Output format: json or toon"),
    }),
    execute: async (args) => {
      const client = getClient();
      const result = await client.searchTickets({
        query: args.query,
        limit: args.limit,
        page: args.page,
        sortBy: args.sort_by,
        sortOrder: args.sort_order,
      });

      return render(
        {
          query: result.query,
          total_count: result.count,
          page: result.page,
          ticket_count: result.tickets.length,
          has_more: result.has_more,
          next_page: result.next_page,
          ...(result.has_more
            ? {
                hint: "request next_page for more, or narrow the query to cut result volume",
              }
            : {}),
          tickets: result.tickets.map(summarizeTicket),
        },
        args.format
      );
    },
  });
}
