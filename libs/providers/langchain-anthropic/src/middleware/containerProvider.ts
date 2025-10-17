import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { HumanMessage } from "@langchain/core/messages";
import {
  ContainerInfo,
  ContainerProvider,
  FileFromProvider,
  ModelRequest,
  UploadFileToContainerOpts,
  UploadFileToContainerRet,
} from "langchain";
import { extractGeneratedFiles } from "../utils/extractGeneratedFiles.js";

export class AnthropicContainerProvider implements ContainerProvider {
  tools = [{ type: "code_execution_20250825", name: "code_execution" }];

  async startContainer(): Promise<ContainerInfo> {
    // Anthropic automatically creates a container when you first use the code
    // execution tool, so we don't need to do anything here.
    return {};
  }

  async uploadFileToContainer({
    path,
    providerId,
    getContent,
  }: UploadFileToContainerOpts): Promise<UploadFileToContainerRet> {
    // This function doesn't actually upload the file to the container. Instead,
    // we upload the file to Anthropic using the files API. We will pass the
    // Anthropic-provided file ID to the container using a special message in
    // modifyModelRequest.
    if (providerId != null) {
      // File already uploaded
      return { providerId, isPendingModelResponse: true };
    }

    const response = await new Anthropic().beta.files.upload({
      file: await toFile(await getContent(), path),
      betas: ["files-api-2025-04-14"],
    });

    // We use isPendingModelResponse to indicate that the file won't be in the
    // container until after the model responds.
    return { providerId: response.id, isPendingModelResponse: true };
  }

  async modifyModelRequest<TState extends Record<string, unknown>, TContext>(
    containerId: string | undefined,
    newFiles: string[],
    request: ModelRequest<TState, TContext>
  ): Promise<ModelRequest<TState, TContext> | void> {
    return {
      ...request,
      messages: [
        ...newFiles.map(
          (fileId) =>
            new HumanMessage({
              content: [{ type: "container_upload", file_id: fileId }],
            })
        ),
        ...request.messages,
      ],
      modelSettings: {
        // Pass container ID to reuse files across turns
        container: containerId,

        // Automatically inject required beta headers for Anthropic code execution
        headers: {
          "anthropic-beta": "code-execution-2025-08-25,files-api-2025-04-14",
        },
      },
    };
  }

  extractFilesFromModelResponse(
    messages: ModelRequest["messages"]
  ): Promise<FileFromProvider[]> {
    // TODO: Is it correct to just look at the last message?
    return Promise.all(
      extractGeneratedFiles(
        messages[
          messages.length - 1
        ] as unknown as Anthropic.Beta.Messages.BetaMessage
      ).map(async (fileId) => {
        const content = Buffer.from(
          await (await new Anthropic().beta.files.download(fileId)).bytes()
        );

        const metadata = await new Anthropic().beta.files.retrieveMetadata(
          fileId
        );

        return {
          providerId: fileId,
          content,
          path: metadata.filename,
          type: "tool",
        };
      })
    );
  }

  extractContainerFromModelResponse(
    messages: ModelRequest["messages"]
  ): ContainerInfo | undefined {
    const newContainer = messages.find(
      (message) => message.type === "ai" && message.additional_kwargs?.container
    )?.additional_kwargs?.container as Container | undefined;

    return newContainer == null
      ? undefined
      : { id: newContainer.id, expiresAt: new Date(newContainer.expires_at) };
  }
}

interface Container {
  id: string;
  expires_at: string;
}
