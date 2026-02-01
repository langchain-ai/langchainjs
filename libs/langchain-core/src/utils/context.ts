/**
 * A tagged template function for creating formatted strings.
 *
 * This utility provides a clean, template literal-based API for string formatting
 * that can be used for prompts, descriptions, and other text formatting needs.
 *
 * It automatically handles whitespace normalization and indentation, making it
 * ideal for multi-line strings in code.
 *
 * When using this utility, it will:
 * - Strip common leading indentation from all lines
 * - Trim leading/trailing whitespace
 * - Align multi-line interpolated values to match indentation
 * - Support escape sequences: `\\n` (newline), `\\`` (backtick), `\\$` (dollar), `\\{` (brace)
 *
 * @example
 * ```typescript
 * import { context } from "@langchain/core/utils/context";
 *
 * const role = "agent";
 * const prompt = context`
 *   You are an ${role}.
 *   Your task is to help users.
 * `;
 * // Returns: "You are an agent.\nYour task is to help users."
 * ```
 *
 * @example
 * ```typescript
 * // Multi-line interpolated values are aligned
 * const items = "- Item 1\n- Item 2\n- Item 3";
 * const message = context`
 *   Shopping list:
 *     ${items}
 *   End of list.
 * `;
 * // The items will be indented to match "    " (4 spaces)
 * ```
 */
export function context(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const raw = strings.raw;
  let result = "";

  for (let i = 0; i < raw.length; i++) {
    // Handle escaped characters in template literals
    const next = raw[i]
      .replace(/\\\n[ \t]*/g, "") // escaped newlines (line continuation)
      .replace(/\\`/g, "`") // escaped backticks
      .replace(/\\\$/g, "$") // escaped dollar signs
      .replace(/\\\{/g, "{"); // escaped braces

    result += next;

    if (i < values.length) {
      const value = alignValue(values[i], result);
      result += typeof value === "string" ? value : JSON.stringify(value);
    }
  }

  // Strip common indentation
  result = stripIndent(result);

  // Trim leading/trailing whitespace
  result = result.trim();

  // Handle escaped \n at the end (preserve intentional newlines)
  result = result.replace(/\\n/g, "\n");

  return result;
}

/**
 * Adjusts the indentation of a multi-line interpolated value to match the current line.
 *
 * @param value - The interpolated value
 * @param precedingText - The text that comes before this value
 * @returns The value with adjusted indentation
 */
function alignValue(value: unknown, precedingText: string): unknown {
  if (typeof value !== "string" || !value.includes("\n")) {
    return value;
  }

  const currentLine = precedingText.slice(precedingText.lastIndexOf("\n") + 1);
  const indentMatch = currentLine.match(/^(\s+)/);

  if (indentMatch) {
    const indent = indentMatch[1];
    return value.replace(/\n/g, `\n${indent}`);
  }

  return value;
}

/**
 * Strips common leading indentation from all lines.
 *
 * @param text - The text to process
 * @returns The text with common indentation removed
 */
function stripIndent(text: string): string {
  const lines = text.split("\n");

  // Find minimum indentation (only from lines that have content)
  let minIndent: number | null = null;
  for (const line of lines) {
    const match = line.match(/^(\s+)\S+/);
    if (match) {
      const indent = match[1].length;
      if (minIndent === null) {
        minIndent = indent;
      } else {
        minIndent = Math.min(minIndent, indent);
      }
    }
  }

  if (minIndent === null) {
    return text;
  }

  // Remove the common indentation from all lines
  return lines
    .map((line) =>
      line[0] === " " || line[0] === "\t" ? line.slice(minIndent) : line
    )
    .join("\n");
}
