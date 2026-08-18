import { buildApplication, buildRouteMap } from "@stricli/core";
import pkg from "../package.json" with { type: "json" };
import { getCommand } from "./commands/get.js";
import { commentsCommand } from "./commands/comments.js";
import { ticketsListCommand } from "./commands/tickets-list.js";
import { ticketsSearchCommand } from "./commands/tickets-search.js";
import { upgradeCommand } from "./commands/upgrade.js";

const ticketRoutes = buildRouteMap({
  routes: {
    list: ticketsListCommand,
    search: ticketsSearchCommand,
    get: getCommand,
    comments: commentsCommand,
  },
  docs: {
    brief: "List, search, and read Zendesk tickets and ticket comments",
  },
});

const routes = buildRouteMap({
  routes: {
    tickets: ticketRoutes,
    upgrade: upgradeCommand,
  },
  docs: {
    brief: "Zendesk integration tools",
  },
});

export const app = buildApplication(routes, {
  name: "zendesk",
  versionInfo: {
    currentVersion: pkg.version,
  },
});
