/**
 * Flag parsers shared by the ticket list/search commands. Errors name the valid
 * range so a caller can correct itself without re-reading --help.
 */

export function parseBoundedInt(
  name: string,
  min: number,
  max: number
): (value: string) => number {
  return (value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(
        `${name} must be an integer between ${min} and ${max} (got "${value}")`
      );
    }
    return parsed;
  };
}

export const parseLimit = parseBoundedInt("--limit", 1, 100);
export const parsePage = parseBoundedInt("--page", 1, 1000);
