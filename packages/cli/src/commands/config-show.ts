import { buildCommand } from "@stricli/core";
import { loadConfig, redactedConfig } from "@zendesk-toolkit/sdk";
import { runCommand } from "../lib/errors.js";
import { emit, formatFlags, type FormatFlagValues } from "../lib/output.js";

export const configShowCommand = buildCommand({
  docs: {
    brief: "Show the resolved configuration and where each value came from",
    fullDescription:
      "Secrets are shown as set/missing, never in plain text. Sources distinguish environment " +
      "variables, dotenv files (envfile:<path>), the OS keychain, and built-in defaults. " +
      "keychain.status is ok, disabled (ZENDESK_KEYCHAIN=0), or unavailable.",
  },
  parameters: {
    flags: { ...formatFlags },
  },
  async func(this: void, flags: FormatFlagValues) {
    await runCommand(async () => {
      const config = redactedConfig(await loadConfig());
      emit(config, flags, { text: () => JSON.stringify(config, null, 2) });
    });
  },
});
