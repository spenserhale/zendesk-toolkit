export { ZendeskClient } from "./client.js";
export { resolveConfig } from "./config.js";
export { ZendeskError, ZendeskAuthError, ZendeskNotFoundError } from "./errors.js";
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
} from "./types.js";
