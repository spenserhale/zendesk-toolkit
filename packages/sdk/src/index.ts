export { ZendeskClient } from "./client.js";
export { resolveConfig, loadConfig, redactedConfig, DEFAULT_BASE_URL } from "./config.js";
export type {
  Env,
  KeychainState,
  ResolvedConfig,
  ResolveConfigOptions,
  LoadConfigOptions,
  RedactedConfig,
} from "./config.js";
export {
  KEYCHAIN_SERVICE,
  CREDENTIAL_KEYS,
  CREDENTIAL_RESOURCES,
  bunSecretStore,
  readKeychainValues,
  resourceCredentialKeys,
  resourceForCredentialKey,
} from "./secrets.js";
export type {
  SecretStore,
  CredentialResource,
  KeychainStatus,
  KeychainReadResult,
} from "./secrets.js";
export { summarizeTicket } from "./summaries.js";
export type { TicketSummary } from "./summaries.js";
export {
  ZendeskError,
  ZendeskAuthError,
  ZendeskNotFoundError,
  ZendeskConfigError,
  ZendeskValidationError,
} from "./errors.js";
export type { ZendeskErrorDetails } from "./errors.js";
export type {
  ZendeskConfig,
  Resource,
  ListResourcesParams,
  CreateResourceParams,
  PaginatedResponse,
  ErrorResponse,
  Ticket,
  TicketComment,
  ZendeskUser,
  ShowTicketResponse,
  ListTicketCommentsResponse,
  SortOrder,
  ListTicketsParams,
  ListTicketsResponse,
  ListTicketsResult,
  SearchTicketsParams,
  SearchTicketsResponse,
  SearchTicketsResult,
} from "./types.js";
export {
  ZendeskConfigSchema,
  ResourceSchema,
  ListResourcesParamsSchema,
  CreateResourceParamsSchema,
  ErrorResponseSchema,
  TicketSchema,
  TicketCommentSchema,
  ZendeskUserSchema,
  ShowTicketResponseSchema,
  ListTicketCommentsResponseSchema,
  SortOrderSchema,
  ListTicketsParamsSchema,
  ListTicketsResponseSchema,
  SearchTicketsParamsSchema,
  SearchTicketsResponseSchema,
  SearchResultSchema,
  SORT_ORDERS,
  TICKET_LIST_SORT_FIELDS,
  TICKET_SEARCH_SORT_FIELDS,
} from "./types.js";
