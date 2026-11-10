import { CREDENTIAL_RESOURCES } from "@zendesk-toolkit/sdk";

export const resourcePositional = {
  kind: "tuple",
  parameters: [
    {
      brief: `Credential resource: ${CREDENTIAL_RESOURCES.join(", ")}`,
      parse: String,
      placeholder: "resource",
    },
  ],
} as const;

export const keyFlag = {
  key: {
    kind: "parsed",
    parse: String,
    brief: "Only this credential (e.g. ZENDESK_API_KEY); default: every key the resource uses",
    optional: true,
  },
} as const;

export const dryRunFlag = {
  "dry-run": {
    kind: "boolean",
    brief: "Validate and report what would change without touching the keychain",
    default: false,
  },
} as const;
