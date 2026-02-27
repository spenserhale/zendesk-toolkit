import { buildApplication, buildRouteMap } from "@stricli/core";
import { getCommand } from "./commands/get.js";
import { threadCommand } from "./commands/thread.js";

const ticketRoutes = buildRouteMap({
  routes: {
    get: getCommand,
    thread: threadCommand,
  },
  docs: {
    brief: "Read Zendesk tickets and ticket threads",
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
