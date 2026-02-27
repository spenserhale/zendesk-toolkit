import { encode } from "@toon-format/toon";
import { buildCommand } from "@stricli/core";
import { ZendeskClient, resolveConfig } from "@zendesk-toolkit/sdk";

interface GetFlags {
  readonly json: boolean;
}

export const getCommand = buildCommand({
  docs: {
    brief: "Get ticket details by ID",
  },
  parameters: {
    flags: {
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
          brief: "Ticket ID",
          parse: String,
        },
      ],
    },
  },
  async func(this: void, flags: GetFlags, id: string) {
    const config = resolveConfig();
    const client = new ZendeskClient(config);

    try {
      const ticket = await client.getTicket(id);
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

      if (flags.json) {
        console.log(JSON.stringify(ticketDetails, null, 2));
        return;
      }

      console.log(encode(ticketDetails, { keyFolding: "safe" }));
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
});
