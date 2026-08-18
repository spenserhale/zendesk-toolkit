import { buildApplication, buildRouteMap } from "@stricli/core";
import pkg from "../package.json" with { type: "json" };
import { getCommand } from "./commands/get.js";
import { commentsCommand } from "./commands/comments.js";
import { upgradeCommand } from "./commands/upgrade.js";

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
