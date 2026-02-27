import { encode } from "@toon-format/toon";
import { buildCommand } from "@stricli/core";
import type { TicketComment } from "@zendesk-toolkit/sdk";
import { ZendeskClient, resolveConfig } from "@zendesk-toolkit/sdk";

interface CommentsFlags {
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

export const commentsCommand = buildCommand({
  docs: {
    brief: "Get full ticket comments for a ticket ID",
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
  async func(this: void, flags: CommentsFlags, id: string) {
    const config = resolveConfig();
    const client = new ZendeskClient(config);

    try {
      const [ticket, comments] = await Promise.all([
        client.getTicket(id),
        client.getTicketComments(id),
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
          body: getCommentText(comment),
        })),
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
