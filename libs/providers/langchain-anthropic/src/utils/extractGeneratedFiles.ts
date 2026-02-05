import type Anthropic from "@anthropic-ai/sdk";

/**
 * Extract generated file IDs from an Anthropic code execution response.
 *
 * Parses the response content blocks to find files created during code execution.
 * Note: This function only returns file IDs.
 *
 * @param message - The Anthropic message response
 * @returns Array of file IDs
 */
export function extractGeneratedFiles(
  message: Anthropic.Beta.BetaMessage
): string[] {
  const fileIds: string[] = [];

  for (const item of message.content) {
    if (
      item.type === "bash_code_execution_tool_result" &&
      item.content.type === "bash_code_execution_result"
    ) {
      for (const file of item.content.content) {
        if (file.type === "bash_code_execution_output") {
          fileIds.push(file.file_id);
        }
      }
    }
  }

  return fileIds;
}
