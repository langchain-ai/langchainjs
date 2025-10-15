import {
  ContainerInfo,
  ContainerProvider,
  FileFromProvider,
  UploadFileToContainerOpts,
  UploadFileToContainerRet,
  type ModelRequest,
} from "langchain";
import OpenAI, { toFile } from "openai";
import { extractGeneratedFilesOpenAI } from "./extractGeneratedFiles.js";

export class OpenAIContainerProvider implements ContainerProvider {
  tools = [{ type: "code_interpreter", name: "code_interpreter" }];

  async startContainer(): Promise<ContainerInfo> {
    // Create a new container explicitly using OpenAI Containers API
    // Use a unique name for the container
    const container = await new OpenAI().containers.create({
      name: `langchain-code-execution-${crypto.randomUUID()}`,
    });

    return {
      id: container.id,
      // OpenAI containers expire after 20 minutes of inactivity
      // Make it 19 minutes to be safe
      // FIXME: Better track lifecycle because it's actually after 20 minutes of inactivity
      // Can probably get last activity off of response metadata
      expiresAt: new Date(
        container.created_at +
          (container.expires_after?.minutes ?? 19) * 60 * 1000
      ),
    };
  }

  async uploadFileToContainer({
    containerId,
    path,
    providerId,
    getContent,
  }: UploadFileToContainerOpts): Promise<UploadFileToContainerRet> {
    // FIXME: It would be more efficient to pass the files to the container at creation time,
    // which is supported by the API, but our current interface doesn't support that
    const client = new OpenAI();

    let newProviderId = providerId;
    if (newProviderId == null) {
      // Upload to OpenAI Files API
      const fileObject = await client.files.create({
        file: await toFile(await getContent(), path),
        purpose: "user_data",
      });

      newProviderId = fileObject.id;
    }

    if (containerId == null) {
      throw new Error("containerId is required to upload file to container");
    }

    await client.containers.files.create(containerId, {
      file_id: newProviderId,
    });

    return { providerId: newProviderId };
  }

  async modifyModelRequest?<TState extends Record<string, unknown>, TContext>(
    containerId: string | undefined,
    _newFiles: string[],
    request: ModelRequest<TState, TContext>
  ): Promise<ModelRequest<TState, TContext> | void> {
    // Build the code_interpreter tool configuration
    const codeInterpreterTool = {
      type: "code_interpreter" as const,
      container: containerId,
    };

    return {
      ...request,
      tools: [codeInterpreterTool],
    };
  }

  async extractFilesFromModelResponse(
    messages: ModelRequest["messages"]
  ): Promise<FileFromProvider[]> {
    // Extract file information from the last message's annotations
    const lastMessage = messages[messages.length - 1];
    const files = extractGeneratedFilesOpenAI({ messages: [lastMessage] });

    const client = new OpenAI();

    // Download each file and return file info
    return Promise.all(
      files.map(async (file) => {
        const response = await client.containers.files.content.retrieve(
          file.fileId,
          {
            container_id: file.containerId,
          }
        );

        if (!response.body) {
          throw new Error(
            `No body in file download response for ${file.fileId}`
          );
        }

        // Convert web ReadableStream to Buffer
        const chunks: Uint8Array[] = [];
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const content = Buffer.concat(chunks);

        return {
          providerId: file.fileId,
          content,
          path: file.filename,
          type: "tool" as const,
        };
      })
    );
  }
}
