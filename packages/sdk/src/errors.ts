export class ZendeskError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ZendeskError";
  }
}

export class ZendeskAuthError extends ZendeskError {
  constructor(message = "Authentication failed. Check your API key.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "ZendeskAuthError";
  }
}

export class ZendeskNotFoundError extends ZendeskError {
  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" not found`, "NOT_FOUND", 404);
    this.name = "ZendeskNotFoundError";
  }
}
