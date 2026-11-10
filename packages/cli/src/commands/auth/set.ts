import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfig, ZendeskValidationError } from "@zendesk-toolkit/sdk";
import { parseResource, selectCredentialKeys, setCredentials } from "../../lib/auth.js";
import { runCommand } from "../../lib/errors.js";
import { emit, formatFlags, type FormatFlagValues } from "../../lib/output.js";
import { promptHidden, readAllStdin, stdinIsInteractive } from "../../lib/prompt.js";
import { dryRunFlag, keyFlag, resourcePositional } from "./shared.js";

interface AuthSetFlags extends FormatFlagValues {
  readonly key?: string;
  readonly stdin: boolean;
  readonly "dry-run": boolean;
}

export const authSetCommand = buildCommand({
  docs: {
    brief: "Store a credential in the OS keychain (hidden prompt, or --stdin)",
    fullDescription:
      "Saves the credential under keychain service `zendesk-toolkit`, named by its env var " +
      "(ZENDESK_API_KEY: an OAuth access token, or you@example.com/token:<api_token>). On a " +
      "terminal it prompts with hidden input. For scripts and agents, pipe the value with --stdin " +
      "(one key per call). The value is never accepted as an argument, so it stays out of shell " +
      "history and process listings. Env vars and .env files still take precedence over the " +
      "keychain; the output flags a stored key that one of them shadows.",
  },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      stdin: {
        kind: "boolean",
        brief: "Read the value from stdin instead of prompting (non-interactive)",
        default: false,
      },
      ...dryRunFlag,
      ...formatFlags,
    },
  },
  async func(this: void, flags: AuthSetFlags, resourceArg: string) {
    await runCommand(async () => {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);

      let readValue: (key: string) => Promise<string>;
      if (flags.stdin) {
        if (keys.length > 1) {
          throw new ZendeskValidationError(
            `${resource} uses ${keys.length} keys; --stdin stores one per call`,
            {
              validValues: keys,
              hint: `Run once per key: ... | zendesk auth set ${resource} --key ${keys[0]} --stdin`,
            }
          );
        }
        const piped = await readAllStdin();
        readValue = async () => piped;
      } else {
        if (!stdinIsInteractive()) {
          throw new ZendeskValidationError("No terminal to prompt on", {
            hint: `Pipe the value instead: ... | zendesk auth set ${resource} --stdin`,
          });
        }
        readValue = (key) => promptHidden(`${key}: `);
      }

      const config = await loadConfig({ secretStore: null });
      const result = await setCredentials({
        resource,
        keys,
        readValue,
        store: bunSecretStore(),
        config,
        dryRun: flags["dry-run"],
      });
      emit(result, flags, {
        text: () =>
          result.credentials
            .map(
              (credential) =>
                `${credential.action} ${credential.key} in ${result.store}` +
                (credential.shadowed_by
                  ? ` (warning: ${credential.shadowed_by} still overrides it)`
                  : "")
            )
            .join("\n"),
      });
    });
  },
});
