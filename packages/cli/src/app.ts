import { buildApplication, buildRouteMap } from "@stricli/core";
import { getCommand } from "./commands/get.js";
import { commentsCommand } from "./commands/comments.js";

const ticketRoutes = buildRouteMap({
  routes: {
    get: getCommand,
    comments: commentsCommand,
  },
  docs: {
    brief: "Read Zendesk tickets and ticket comments",
  },
});

const routes = buildRouteMap({
  routes: {
    tickets: ticketRoutes,
  },
  docs: {
    brief: "Zendesk integration tools",
  },
});

export const app = buildApplication(routes, {
  name: "zendesk",
  versionInfo: {
    currentVersion: "0.1.0",
  },
});
