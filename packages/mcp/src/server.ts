import { FastMCP } from "fastmcp";
import { registerResourceTools } from "./tools/resources.js";

const server = new FastMCP({
  name: "zendesk-toolkit",
  version: "0.1.0",
});

// Register tool groups
registerResourceTools(server);

export default server;
