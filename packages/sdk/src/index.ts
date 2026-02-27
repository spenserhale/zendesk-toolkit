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
} from "./types.js";
export {
  ZendeskConfigSchema,
  ResourceSchema,
  ListResourcesParamsSchema,
  CreateResourceParamsSchema,
  ErrorResponseSchema,
} from "./types.js";
