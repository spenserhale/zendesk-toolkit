export interface ZendeskErrorDetails {
  /** The offending input, when it is safe to echo (never a secret). */
  got?: string;
  validValues?: readonly string[];
  /** The next command or fix to try. */
  hint?: string;
  cause?: unknown;
}

export class ZendeskError extends Error {
  public readonly got?: string;
  public readonly validValues?: readonly string[];
  public readonly hint?: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    details: ZendeskErrorDetails = {}
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "ZendeskError";
    this.got = details.got;
    this.validValues = details.validValues;
    this.hint = details.hint;
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

/** Bad or unavailable local configuration, including the OS keychain (CLI exit 3). */
export class ZendeskConfigError extends ZendeskError {
  constructor(message: string, details: ZendeskErrorDetails = {}) {
    super(message, "CONFIG_ERROR", undefined, details);
    this.name = "ZendeskConfigError";
  }
}

/** Invalid caller input caught before any side effect (CLI exit 2). */
export class ZendeskValidationError extends ZendeskError {
  constructor(message: string, details: ZendeskErrorDetails = {}) {
    super(message, "VALIDATION_ERROR", undefined, details);
    this.name = "ZendeskValidationError";
  }
}
