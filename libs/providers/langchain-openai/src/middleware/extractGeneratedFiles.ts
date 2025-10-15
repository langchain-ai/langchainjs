/**
 * Extract generated file information from an OpenAI code execution response.
 *
 * Parses the message annotations to find files created during code execution.
 * Returns file information including container_id, file_id, and filename.
 *
 * @param response - The OpenAI message response
 * @returns Array of file information objects
 *
 * @example
 * ```typescript
 * import { extractGeneratedFilesOpenAI, downloadFileOpenAI } from '@langchain/openai/middleware';
 *
 * const response = await agent.invoke({...});
 * const files = extractGeneratedFilesOpenAI(response);
 *
 * for (const file of files) {
 *   await downloadFileOpenAI(client, file.containerId, file.fileId, file.filename);
 * }
 * ```
 */
export function extractGeneratedFilesOpenAI(response: any): Array<{
  fileId: string;
  containerId: string;
  filename: string;
}> {
  const files: Array<{
    fileId: string;
    containerId: string;
    filename: string;
  }> = [];

  // Handle both single message responses and response objects with messages array
  const messages = response.messages || [response];

  for (const message of messages) {
    if (!message.content || !Array.isArray(message.content)) {
      continue;
    }

    for (const contentItem of message.content) {
      if (
        contentItem.type === "text" &&
        Array.isArray(contentItem.annotations)
      ) {
        for (const annotation of contentItem.annotations) {
          if (
            annotation.type === "container_file_citation" &&
            annotation.file_id &&
            annotation.container_id &&
            annotation.filename
          ) {
            files.push({
              fileId: annotation.file_id,
              containerId: annotation.container_id,
              filename: annotation.filename,
            });
          }
        }
      }
    }
  }

  return files;
}
