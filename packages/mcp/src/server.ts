import { FastMCP } from "fastmcp";
import pkg from "../package.json" with { type: "json" };
import { registerResourceTools } from "./tools/resources.js";

const server = new FastMCP({
  name: "zendesk-toolkit",
  version: pkg.version as `${number}.${number}.${number}`,
});

// Register tool groups
registerResourceTools(server);

export default server;
