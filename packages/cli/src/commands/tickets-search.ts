import { encode } from "@toon-format/toon";
import { buildCommand } from "@stricli/core";
import {
  SORT_ORDERS,
  TICKET_SEARCH_SORT_FIELDS,
  ZendeskClient,
  resolveConfig,
  summarizeTicket,
} from "@zendesk-toolkit/sdk";
import type { SortOrder } from "@zendesk-toolkit/sdk";
import { parseLimit, parsePage } from "../flags.js";

type SearchSortField = (typeof TICKET_SEARCH_SORT_FIELDS)[number];

interface SearchFlags {
  readonly limit: number;
  readonly page: number;
  readonly sort: SearchSortField;
  readonly order: SortOrder;
  readonly json: boolean;
}

export const ticketsSearchCommand = buildCommand({
  docs: {
    brief: "Search tickets with Zendesk search syntax",
    fullDescription: [
      "Search tickets with Zendesk search syntax.",
      "",
      "The query is scoped to `type:ticket` unless it already names a type.",
      "Examples:",
      '  zendesk tickets search "status:open priority:urgent"',
      '  zendesk tickets search "requester:you@example.com created>2026-01-01"',
      '  zendesk tickets search "printer jam" --sort=created_at --limit=50',
    ].join("\n"),
  },
  parameters: {
    flags: {
      limit: {
        kind: "parsed",
        parse: parseLimit,
        brief: "Results per page (1-100)",
        default: "25",
      },
      page: {
        kind: "parsed",
        parse: parsePage,
        brief: "Page number of results",
        default: "1",
      },
      sort: {
        kind: "enum",
        values: TICKET_SEARCH_SORT_FIELDS,
        brief: "Field to sort by (relevance is Zendesk's default)",
        default: "relevance",
      },
      order: {
        kind: "enum",
        values: SORT_ORDERS,
        brief: "Sort direction",
        default: "desc",
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        default: false,
      },
    },
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Zendesk search query, e.g. \"status:open priority:urgent\"",
          parse: String,
        },
      ],
    },
  },
  async func(this: void, flags: SearchFlags, query: string) {
    const config = resolveConfig();
    const client = new ZendeskClient(config);

    try {
      const result = await client.searchTickets({
        query,
        limit: flags.limit,
        page: flags.page,
        sortBy: flags.sort,
        sortOrder: flags.order,
      });

      const payload = {
        query: result.query,
        total_count: result.count,
        page: result.page,
        ticket_count: result.tickets.length,
        has_more: result.has_more,
        next_page: result.next_page,
        ...(result.has_more
          ? {
              hint: `more matches available: rerun with --page=${result.next_page}, or narrow the query (e.g. add status:open or created>2026-01-01)`,
            }
          : {}),
        tickets: result.tickets.map(summarizeTicket),
      };

      if (flags.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(encode(payload, { keyFolding: "safe" }));
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
});
