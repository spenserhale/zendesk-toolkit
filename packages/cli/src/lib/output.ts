import { encode } from "@toon-format/toon";
import { ZendeskValidationError } from "@zendesk-toolkit/sdk";

export const OUTPUT_FORMATS = ["toon", "json", "csv", "text"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const formatFlags = {
  toon: { kind: "boolean", brief: "Output as TOON (default)", default: false },
  json: { kind: "boolean", brief: "Output as JSON", default: false },
  csv: { kind: "boolean", brief: "Output as CSV (flat rows only)", default: false },
  text: { kind: "boolean", brief: "Output as human-readable text", default: false },
} as const;

export interface FormatFlagValues {
  readonly toon: boolean;
  readonly json: boolean;
  readonly csv: boolean;
  readonly text: boolean;
}

export interface Renderers {
  text?: () => string;
  /** Commands with nested output omit this and refuse --csv. */
  csv?: () => string;
}

export function resolveFormat(flags: FormatFlagValues, fallback: OutputFormat = "toon"): OutputFormat {
  const picked = OUTPUT_FORMATS.filter((format) => flags[format]);
  if (picked.length > 1) {
    throw new ZendeskValidationError("Only one output format may be set", {
      got: picked.join(", "),
      validValues: OUTPUT_FORMATS,
      hint: "Pass exactly one of --toon / --json / --csv / --text.",
    });
  }
  return picked[0] ?? fallback;
}

export function renderOutput(data: unknown, format: OutputFormat, renderers: Renderers): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "toon":
      return encode(data, { keyFolding: "safe" });
    case "csv":
      if (!renderers.csv) {
        throw new ZendeskValidationError("CSV output is not available for this command", {
          hint: "Use --json or --toon.",
        });
      }
      return renderers.csv();
    case "text":
      return renderers.text ? renderers.text() : JSON.stringify(data, null, 2);
  }
}

export function emit(
  data: unknown,
  flags: FormatFlagValues,
  renderers: Renderers = {},
  fallback: OutputFormat = "toon"
): void {
  process.stdout.write(`${renderOutput(data, resolveFormat(flags, fallback), renderers)}\n`);
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
