import prettier from "prettier";

/**
 * Format TypeScript code using prettier with the project's configuration
 *
 * @param code - The TypeScript code to format
 * @param filePath - The file path for context (used to find prettier config)
 * @returns The formatted code
 */
export async function formatWithPrettier(
  code: string,
  filePath: string
): Promise<string> {
  try {
    // Get prettier config for the file
    const prettierConfig = await prettier.resolveConfig(filePath);

    // Format the code with TypeScript parser
    const formatted = await prettier.format(code, {
      ...prettierConfig,
      parser: "typescript",
    });

    return formatted;
  } catch (error) {
    console.warn("⚠️ Failed to format code with prettier:", error);
    // Return the original code if formatting fails
    return code;
  }
}
