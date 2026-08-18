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

  it("should list tickets with a bounded page size and cursor pagination", async () => {
    let requestedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          tickets: [
            {
              id: 7,
              subject: "Printer jam",
              status: "open",
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-02T00:00:00Z",
            },
          ],
          meta: { has_more: true, after_cursor: "cursor-2" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = new ZendeskClient({
      apiKey: "test-key",
      baseUrl: "https://example.zendesk.com",
    });

    const result = await client.listTickets({ limit: 5, cursor: "cursor-1" });
    const url = new URL(requestedUrl);

    expect(url.pathname).toBe("/api/v2/tickets.json");
    expect(url.searchParams.get("page[size]")).toBe("5");
    expect(url.searchParams.get("page[after]")).toBe("cursor-1");
    expect(url.searchParams.get("sort")).toBe("-updated_at");
    expect(result.tickets).toHaveLength(1);
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).toBe("cursor-2");
  });

  it("should report no next cursor when the ticket list is exhausted", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tickets: [],
          meta: { has_more: false, after_cursor: "stale-cursor" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const client = new ZendeskClient({ apiKey: "test-key" });
    const result = await client.listTickets();

    expect(result.has_more).toBe(false);
    expect(result.next_cursor).toBeNull();
  });

  it("should scope searches to tickets and drop other result types", async () => {
    let requestedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          results: [
            {
              result_type: "ticket",
              id: 11,
              subject: "Urgent outage",
              status: "open",
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-03T00:00:00Z",
            },
            { result_type: "user", id: 99, name: "Agent Smith" },
          ],
          next_page:
            "https://example.zendesk.com/api/v2/search.json?query=type%3Aticket&page=2",
          count: 42,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = new ZendeskClient({
      apiKey: "test-key",
      baseUrl: "https://example.zendesk.com",
    });

    const result = await client.searchTickets({
      query: "status:open priority:urgent",
      limit: 10,
      sortBy: "created_at",
    });
    const url = new URL(requestedUrl);

    expect(url.pathname).toBe("/api/v2/search.json");
    expect(url.searchParams.get("query")).toBe(
      "type:ticket status:open priority:urgent"
    );
    expect(url.searchParams.get("per_page")).toBe("10");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("sort_by")).toBe("created_at");
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]?.id).toBe(11);
    expect(result.count).toBe(42);
    expect(result.has_more).toBe(true);
    expect(result.next_page).toBe(2);
  });

  it("should keep a caller-supplied type filter and omit sort_by for relevance", async () => {
    let requestedUrl = "";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = new ZendeskClient({ apiKey: "test-key" });
    const result = await client.searchTickets({ query: "type:ticket printer" });
    const url = new URL(requestedUrl);

    expect(url.searchParams.get("query")).toBe("type:ticket printer");
    expect(url.searchParams.has("sort_by")).toBe(false);
    expect(result.has_more).toBe(false);
    expect(result.next_page).toBeNull();
  });

  it("should reject an empty search query and out-of-range limits", async () => {
    const client = new ZendeskClient({ apiKey: "test-key" });

    await expect(client.searchTickets({ query: "  " })).rejects.toThrow();
    await expect(client.listTickets({ limit: 500 })).rejects.toThrow();
  });
});
