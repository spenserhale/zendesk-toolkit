import { buildCommand } from "@stricli/core";
import type { TicketComment } from "@zendesk-toolkit/sdk";
import { ZendeskClient, resolveConfig } from "@zendesk-toolkit/sdk";

interface ThreadFlags {
  readonly json: boolean;
}

function getCommentText(comment: TicketComment): string {
  return (
    comment.plain_body ??
    comment.body ??
    comment.html_body ??
    "(comment body unavailable)"
  );
}

export const threadCommand = buildCommand({
  docs: {
    brief: "Get a full ticket thread (all comments)",
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
  async func(this: void, flags: ThreadFlags, id: string) {
    const config = resolveConfig();
    const client = new ZendeskClient(config);

    try {
      const thread = await client.getTicketThread(id);

      if (flags.json) {
        console.log(JSON.stringify(thread, null, 2));
        return;
      }

      const ticket = thread.ticket;
      console.log(`Ticket #${ticket.id} thread`);
      console.log(`Subject:     ${ticket.subject ?? "(no subject)"}`);
      console.log(`Status:      ${ticket.status}`);
      console.log(`Created:     ${ticket.created_at}`);
      console.log(`Updated:     ${ticket.updated_at}`);
      console.log(`Comments:    ${thread.comments.length}`);

      if (thread.comments.length === 0) {
        console.log("\nNo comments found.");
        return;
      }

      for (const [index, comment] of thread.comments.entries()) {
        const visibility =
          comment.public === false ? "internal note" : "public comment";
        const body = getCommentText(comment).trim();

        console.log(
          `\n[${index + 1}] ${comment.created_at} | author ${comment.author_id} | ${visibility}`
        );
        console.log(body.length > 0 ? body : "(empty comment)");
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
});
