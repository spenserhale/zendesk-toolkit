import { buildCommand } from "@stricli/core";
import { buildAgentContext } from "../agent-context.js";
import { runCommand } from "../lib/errors.js";
import { emit, formatFlags, type FormatFlagValues } from "../lib/output.js";

export const agentContextCommand = buildCommand({
  docs: {
    brief: "Emit a machine-readable description of every command, flag, exit code, and env var",
    fullDescription:
      "Defaults to JSON (use --toon to override). Derived from the live Stricli route tree, so it " +
      "stays in sync with --help.",
  },
  parameters: { flags: { ...formatFlags } },
  async func(this: void, flags: FormatFlagValues) {
    await runCommand(async () => {
      const { app } = await import("../app.js");
      emit(buildAgentContext(app.root), flags, {}, "json");
    });
  },
});
