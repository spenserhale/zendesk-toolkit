import type {
  ZendeskConfig,
  Resource,
  ListResourcesParams,
  CreateResourceParams,
  PaginatedResponse,
  Ticket,
  TicketComment,
  ShowTicketResponse,
  ListTicketCommentsResponse,
} from "./types.js";
import {
  ZendeskConfigSchema,
  ErrorResponseSchema,
  ShowTicketResponseSchema,
  ListTicketCommentsResponseSchema,
} from "./types.js";
import { ZendeskError, ZendeskAuthError } from "./errors.js";
import { ZodError } from "zod";

export class ZendeskClient {
  private readonly config: ZendeskConfig;

  constructor(config: Partial<ZendeskConfig> & { apiKey: string }) {
    try {
      this.config = ZendeskConfigSchema.parse(config);
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues
          .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
          .join("; ");
        throw new Error(`Invalid Zendesk config (${details})`);
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private buildUrl(path: string): string {
    if (path.startsWith("https://") || path.startsWith("http://")) {
      return path;
    }

    const baseUrl = this.config.baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private getAuthorizationHeader(): string {
    const raw = this.config.apiKey.trim();
    const lower = raw.toLowerCase();

    if (lower.startsWith("bearer ") || lower.startsWith("basic ")) {
      return raw;
    }

    // Zendesk API token auth format from docs: "{email}/token:{api_token}".
    if (raw.includes("/token:")) {
      return `Basic ${Buffer.from(raw).toString("base64")}`;
    }

    return `Bearer ${raw}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = this.buildUrl(path);

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.getAuthorizationHeader(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      if (res.status === 401) throw new ZendeskAuthError();

      const errorBody = await res.json().catch(() => null);
      const parsed = ErrorResponseSchema.safeParse(errorBody);

      throw new ZendeskError(
        parsed.success ? parsed.data.error.message : `HTTP ${res.status}`,
        parsed.success ? parsed.data.error.code : "UNKNOWN",
        res.status
      );
    }

    return res.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Resource operations -- add your own here
  // -------------------------------------------------------------------------

  async listResources(
    params: ListResourcesParams = { page: 1, limit: 20 }
  ): Promise<PaginatedResponse<Resource>> {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
    });
    return this.request("GET", `/resources?${query}`);
  }

  async getResource(id: string): Promise<Resource> {
    return this.request("GET", `/resources/${id}`);
  }

  async createResource(params: CreateResourceParams): Promise<Resource> {
    return this.request("POST", "/resources", params);
  }

  async deleteResource(id: string): Promise<void> {
    await this.request("DELETE", `/resources/${id}`);
  }

  async getTicket(id: string): Promise<Ticket> {
    const response = await this.request<ShowTicketResponse>(
      "GET",
      `/api/v2/tickets/${id}.json`
    );

    return ShowTicketResponseSchema.parse(response).ticket;
  }

  async getTicketComments(id: string): Promise<TicketComment[]> {
    const comments: TicketComment[] = [];
    let nextPage: string | null = `/api/v2/tickets/${id}/comments.json?sort_order=asc`;

    while (nextPage) {
      const response = await this.request<ListTicketCommentsResponse>(
        "GET",
        nextPage
      );
      const parsed = ListTicketCommentsResponseSchema.parse(response);
      comments.push(...parsed.comments);
      nextPage = parsed.next_page ?? null;
    }

    return comments;
  }

  async getTicketThread(id: string): Promise<{
    ticket: Ticket;
    comments: TicketComment[];
  }> {
    const [ticket, comments] = await Promise.all([
      this.getTicket(id),
      this.getTicketComments(id),
    ]);

    return { ticket, comments };
  }
}
