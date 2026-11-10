import { ZendeskError } from "@zendesk-toolkit/sdk";

/** Exit codes shared across the toolkits' CLIs. */
export const EXIT_CODES = {
  network: 1,
  validation: 2,
  config: 3,
  not_found: 4,
  auth: 5,
  rate_limit: 6,
} as const;

export function exitCodeFor(error: unknown): number {
  if (error instanceof ZendeskError) {
    if (error.code === "VALIDATION_ERROR") return EXIT_CODES.validation;
    if (error.code === "CONFIG_ERROR") return EXIT_CODES.config;
    if (error.code === "NOT_FOUND" || error.statusCode === 404) return EXIT_CODES.not_found;
    if (error.code === "AUTH_ERROR" || error.statusCode === 401 || error.statusCode === 403) {
      return EXIT_CODES.auth;
    }
    if (error.statusCode === 429) return EXIT_CODES.rate_limit;
  }
  return EXIT_CODES.network;
}

export function formatError(error: unknown): string {
  if (error instanceof ZendeskError) {
    const parts = [`error[${error.code}]: ${error.message}`];
    if (error.got !== undefined) parts.push(`  got: "${error.got}"`);
    if (error.validValues && error.validValues.length > 0) {
      parts.push(`  valid: ${error.validValues.join(", ")}`);
    }
    if (error.hint) parts.push(`  hint: ${error.hint}`);
    return parts.join("\n");
  }
  return `error: ${error instanceof Error ? error.message : String(error)}`;
}

/** Run a command body, printing typed errors to stderr and exiting with their code. */
export async function runCommand<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    process.exit(exitCodeFor(error));
  }
}
