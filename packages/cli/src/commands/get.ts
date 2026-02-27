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

      if (flags.json) {
        console.log(JSON.stringify(ticket, null, 2));
        return;
      }

      console.log(`Ticket #${ticket.id}`);
      console.log(`Subject:     ${ticket.subject ?? "(no subject)"}`);
      console.log(`Status:      ${ticket.status}`);
      console.log(`Priority:    ${ticket.priority ?? "(none)"}`);
      console.log(`Type:        ${ticket.type ?? "(none)"}`);
      console.log(`Requester:   ${ticket.requester_id ?? "(unknown)"}`);
      console.log(`Assignee:    ${ticket.assignee_id ?? "(unassigned)"}`);
      console.log(`Created:     ${ticket.created_at}`);
      console.log(`Updated:     ${ticket.updated_at}`);

      if (ticket.tags && ticket.tags.length > 0) {
        console.log(`Tags:        ${ticket.tags.join(", ")}`);
      }

      if (ticket.description) {
        console.log("\nDescription:");
        console.log(ticket.description);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
});
