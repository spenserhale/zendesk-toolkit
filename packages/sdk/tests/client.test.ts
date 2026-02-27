import { afterEach, describe, expect, it } from "bun:test";
import { ZendeskClient } from "../src/client.js";

describe("ZendeskClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should require an API key", () => {
    expect(() => new ZendeskClient({ apiKey: "" })).toThrow();
  });

  it("should accept a valid config", () => {
    const client = new ZendeskClient({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
    });
    expect(client).toBeDefined();
  });

  it("should get ticket details from the Show Ticket endpoint", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.zendesk.com/api/v2/tickets/123.json");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-key",
      });
      return new Response(
        JSON.stringify({
          ticket: {
            id: 123,
            subject: "Printer issue",
            status: "open",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = new ZendeskClient({
      apiKey: "test-key",
      baseUrl: "https://example.zendesk.com",
    });

    const ticket = await client.getTicket("123");
    expect(ticket.id).toBe(123);
    expect(ticket.subject).toBe("Printer issue");
  });

  it("should convert Zendesk api token credentials to Basic auth", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const authHeader = headers.get("Authorization");
      expect(authHeader?.startsWith("Basic ")).toBe(true);
      expect(authHeader).toBe(
        "Basic " + Buffer.from("user@example.com/token:abc123").toString("base64")
      );

      return new Response(
        JSON.stringify({
          ticket: {
            id: 123,
            status: "open",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = new ZendeskClient({
      apiKey: "user@example.com/token:abc123",
      baseUrl: "https://example.zendesk.com",
    });

    await client.getTicket("123");
  });

  it("should follow comment pagination to return the full ticket thread", async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);

      if (requestedUrls.length === 1) {
        return new Response(
          JSON.stringify({
            comments: [
              {
                id: 1,
                author_id: 100,
                body: "Initial message",
                created_at: "2025-01-01T00:00:00Z",
              },
            ],
            next_page:
              "https://example.zendesk.com/api/v2/tickets/123/comments.json?page=2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          comments: [
            {
              id: 2,
              author_id: 200,
              body: "Agent reply",
              created_at: "2025-01-01T01:00:00Z",
            },
          ],
          next_page: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = new ZendeskClient({
      apiKey: "test-key",
      baseUrl: "https://example.zendesk.com",
    });

    const comments = await client.getTicketComments("123");

    expect(requestedUrls).toEqual([
      "https://example.zendesk.com/api/v2/tickets/123/comments.json?sort_order=asc",
      "https://example.zendesk.com/api/v2/tickets/123/comments.json?page=2",
    ]);
    expect(comments).toHaveLength(2);
    expect(comments[0]?.id).toBe(1);
    expect(comments[1]?.id).toBe(2);
  });
});
