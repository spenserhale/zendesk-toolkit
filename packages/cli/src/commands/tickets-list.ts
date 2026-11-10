import { encode } from "@toon-format/toon";
import { buildCommand } from "@stricli/core";
import {
  SORT_ORDERS,
  TICKET_LIST_SORT_FIELDS,
  ZendeskClient,
  loadConfig,
  summarizeTicket,
} from "@zendesk-toolkit/sdk";
import type { SortOrder } from "@zendesk-toolkit/sdk";
import { parseLimit } from "../flags.js";

type ListSortField = (typeof TICKET_LIST_SORT_FIELDS)[number];

interface ListFlags {
  readonly limit: number;
  readonly cursor?: string;
  readonly sort: ListSortField;
  readonly order: SortOrder;
  readonly json: boolean;
}

export const ticketsListCommand = buildCommand({
  docs: {
    brief: "List tickets, newest updated first",
  },
  parameters: {
    flags: {
      limit: {
        kind: "parsed",
        parse: parseLimit,
        brief: "Tickets per page (1-100)",
        default: "25",
      },
      cursor: {
        kind: "parsed",
        parse: String,
        brief: "Cursor from a previous page's next_cursor",
        optional: true,
      },
      sort: {
        kind: "enum",
        values: TICKET_LIST_SORT_FIELDS,
        brief: "Field to sort by",
        default: "updated_at",
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
  },
  async func(this: void, flags: ListFlags) {
    const config = await loadConfig();
    const client = new ZendeskClient(config);

    try {
      const result = await client.listTickets({
        limit: flags.limit,
        cursor: flags.cursor,
        sortBy: flags.sort,
        sortOrder: flags.order,
      });

      const payload = {
        ticket_count: result.tickets.length,
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        ...(result.has_more
          ? {
              hint: `more tickets available: rerun with --cursor=${result.next_cursor} (or raise --limit, max 100)`,
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
