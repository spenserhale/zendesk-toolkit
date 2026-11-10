import { buildCommand } from "@stricli/core";
import { bunSecretStore, ZendeskValidationError } from "@zendesk-toolkit/sdk";
import { deleteCredentials, parseResource, selectCredentialKeys } from "../../lib/auth.js";
import { runCommand } from "../../lib/errors.js";
import { emit, formatFlags, type FormatFlagValues } from "../../lib/output.js";
import { dryRunFlag, keyFlag, resourcePositional } from "./shared.js";

interface AuthDeleteFlags extends FormatFlagValues {
  readonly key?: string;
  readonly yes: boolean;
  readonly "dry-run": boolean;
}

export const authDeleteCommand = buildCommand({
  docs: {
    brief: "Remove a credential from the OS keychain (requires --yes)",
    fullDescription:
      "Deletes the resource's keychain entries, or only --key. Values set through env or .env " +
      "files are not touched.",
  },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      yes: { kind: "boolean", brief: "Confirm the deletion", default: false },
      ...dryRunFlag,
      ...formatFlags,
    },
  },
  async func(this: void, flags: AuthDeleteFlags, resourceArg: string) {
    await runCommand(async () => {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);
      if (!flags.yes && !flags["dry-run"]) {
        throw new ZendeskValidationError("Deleting a keychain entry needs --yes", {
          hint: `Preview with --dry-run, then run: zendesk auth delete ${resource} --yes`,
        });
      }
      const result = await deleteCredentials({
        resource,
        keys,
        store: bunSecretStore(),
        dryRun: flags["dry-run"],
      });
      emit(result, flags, {
        text: () => result.credentials.map((row) => `${row.action} ${row.key}`).join("\n"),
      });
    });
  },
});
