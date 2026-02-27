import { describe, expect, it } from "bun:test";
import { ZendeskClient } from "../src/client.js";

describe("ZendeskClient", () => {
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
});
