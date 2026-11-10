import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfig } from "@zendesk-toolkit/sdk";
import { listCredentials } from "../../lib/auth.js";
import { runCommand } from "../../lib/errors.js";
import { csvCell, emit, formatFlags, type FormatFlagValues } from "../../lib/output.js";

export const authListCommand = buildCommand({
  docs: {
    brief: "Show which credentials are in the keychain and which source is active",
    fullDescription:
      "Lists every credential key with its keychain state (set/missing/unknown) and the source " +
      "that currently wins (env, envfile:<path>, keychain, or missing). Values are never printed.",
  },
  parameters: {
    flags: { ...formatFlags },
  },
  async func(this: void, flags: FormatFlagValues) {
    await runCommand(async () => {
      const store = bunSecretStore();
      const config = await loadConfig({ secretStore: store });
      const result = await listCredentials(store, config);
      emit(result, flags, {
        text: () =>
          [
            `store: ${result.store} (${result.keychain_status})`,
            ...result.credentials.map(
              (row) =>
                `${row.key.padEnd(18)} keychain=${row.keychain.padEnd(7)} active=${row.active_source}`
            ),
          ].join("\n"),
        csv: () =>
          [
            "resource,key,keychain,active_source",
            ...result.credentials.map((row) =>
              [row.resource, row.key, row.keychain, row.active_source].map(csvCell).join(",")
            ),
          ].join("\n"),
      });
    });
  },
});
