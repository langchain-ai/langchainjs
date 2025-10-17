import { MessageType } from "@langchain/core/messages";
import { z } from "zod";
import { createMiddleware } from "../middleware.js";
import { ModelRequest } from "../nodes/types.js";
import { ClientTool, ServerTool } from "../tools.js";
import { AgentMiddleware } from "./types.js";

// TODO: I do this to ensure we line up with the message types defined in core,
// but maybe we should just export the zod enum from core instead? Or export this
// list from core?
const fileTypes = [
  "ai",
  "human",
  "tool",
  "system",
] as const satisfies readonly MessageType[];

const fileSchema = z.object({
  id: z.string(),
  path: z.string(),
  type: z.enum(fileTypes),
  providerId: z
    .string()
    .describe("The id of the file according to the provider")
    .optional(),
});

type File = z.infer<typeof fileSchema>;

const containerSchema = z.object({
  id: z.string().describe("container ID").optional(),
  expiresAt: z.date().describe("container expiration time").optional(),
  files: z
    .array(
      z.object({
        id: z.string(),
        isPendingModelResponse: z
          .boolean()
          .optional()
          .describe(
            "If true, indicates that the file has been scheduled for upload to container but is pending model response"
          ),
      })
    )
    .describe("file IDs already in the container"),
});

/**
 * State schema for code execution middleware.
 * Tracks the container ID to enable file persistence across conversation turns.
 */
const stateSchema = z.object({
  files: z.array(fileSchema).describe("files").optional(),
  container: containerSchema.optional(),
});

export type CodeExecutionMiddlewareState = z.infer<typeof stateSchema>;

export type CodeExecutionMiddleware = AgentMiddleware<
  typeof stateSchema,
  undefined,
  {}
> & {
  addFile(path: string, content: Buffer, type?: File["type"]): Promise<File>;
  files(state: CodeExecutionMiddlewareState): {
    id: string;
    path: string;
    type: File["type"];
    getContent: () => Promise<Buffer>;
  }[];
};

export function codeExecutionMiddleware(
  containerProvider: ContainerProvider,
  fileProvider: FileProvider
): CodeExecutionMiddleware {
  return {
    ...createMiddleware({
      name: "codeExecutionMiddleware",
      stateSchema,
      tools: containerProvider.tools,
      beforeModel: async (state) => {
        const stateUpdate: Partial<CodeExecutionMiddlewareState> = {};
        let container = state.container;
        if (container?.expiresAt != null && container.expiresAt < new Date()) {
          container = undefined;
        }

        if (container == null) {
          container = {
            ...(await containerProvider.startContainer()),
            files: [],
          };
        }

        /** Files missing from container */
        const newFiles = (state.files ?? []).filter(
          (file) => !container?.files.some((f) => f.id === file.id)
        );

        if (newFiles.length > 0) {
          // Upload any new files to the container
          const fileUploadResults: Record<string, UploadFileToContainerRet> =
            Object.fromEntries(
              await Promise.all(
                newFiles.map(async (file) => {
                  return [
                    file.id,
                    await containerProvider.uploadFileToContainer({
                      containerId: container.id,
                      providerId: file.providerId,
                      path: file.path,
                      getContent: () => fileProvider.readFile(file.id),
                    }),
                  ];
                })
              )
            );

          stateUpdate.files = (state.files ?? []).map((file) => ({
            ...file,
            providerId:
              fileUploadResults[file.id]?.providerId ?? file.providerId,
          }));
          stateUpdate.container = {
            ...container!,
            files: [
              ...(container?.files ?? []),
              ...newFiles.map((file) => ({
                id: file.id,
                isPendingModelResponse:
                  fileUploadResults[file.id]?.isPendingModelResponse ?? false,
              })),
            ],
          };
        }

        return stateUpdate;
      },

      wrapModelCall: async (request, handler) => {
        const modifiedRequest: typeof request =
          (await containerProvider.modifyModelRequest?.(
            request.state.container?.id,
            // TODO: Prob throw error or something if there's new files that are null?
            request.state.container?.files
              ?.filter(({ isPendingModelResponse }) => isPendingModelResponse)
              .map(
                (file) =>
                  request.state.files?.find((f) => f.id === file.id)?.providerId
              )
              .filter((fileId): fileId is string => fileId != null) ?? [],
            request
          )) ?? request;

        return handler({
          ...modifiedRequest,
          systemPrompt: joinSystemPrompts(
            modifiedRequest.systemPrompt ?? request.systemPrompt,
            getSystemPrompt(request.state.files)
          ),
        });
      },

      afterModel: async (state) => {
        let container = state.container;
        const newContainer =
          containerProvider.extractContainerFromModelResponse?.(state.messages);
        if (newContainer != null && newContainer.id !== state.container?.id) {
          container = { ...newContainer, files: [] };
        }

        const newFiles = await containerProvider.extractFilesFromModelResponse(
          state.messages
        );

        // Reset isPendingModelResponse flags on existing files in container as they've
        // now been sent to the model
        if (container != null) {
          container = {
            ...container,
            files: container.files.map((file) => ({
              id: file.id,
              isPendingModelResponse: false,
            })),
          };
        }

        // Add generated files to fileProvider and state.container.files and state.files
        const stateUpdate: Partial<CodeExecutionMiddlewareState> = {
          container,
        };

        if (newFiles.length > 0) {
          // Store file contents in fileProvider and create File objects
          const generatedFiles: File[] = await Promise.all(
            newFiles.map(async (file) => ({
              id: await fileProvider.addFile(file.content!),
              path: file.path,
              type: file.type,
              providerId: file.providerId,
            }))
          );

          // Add to state.files
          stateUpdate.files = [...(state.files ?? []), ...generatedFiles];

          // Add to state.container.files (without isPendingModelResponse since they're already in the container)
          stateUpdate.container = {
            ...stateUpdate.container!,
            files: [
              ...stateUpdate.container!.files,
              ...generatedFiles.map((file) => ({ id: file.id })),
            ],
          };
        }

        return stateUpdate;
      },
    }),

    async addFile(path: string, content: Buffer, type: File["type"] = "human") {
      return {
        id: await fileProvider.addFile(content),
        path,
        type,
      };
    },

    files(state: CodeExecutionMiddlewareState) {
      return (state.files ?? []).map((file) => ({
        id: file.id,
        path: file.path,
        type: file.type,
        getContent: () => fileProvider.readFile(file.id),
      }));
    },
  };
}

function getSystemPrompt(files: File[] | undefined): string | undefined {
  if (!files || files.length === 0) {
    return undefined;
  }

  const fileList = JSON.stringify(
    files.map((f) => ({ path: f.path, createdBy: f.type }))
  );

  return `You have access to the following files:\n${fileList}\nWhen you use the code execution tool, you can read and write these files. You can also create new files. When creating new files, please provide a unique filename and specify the full path where the file should be created.`;
}

function joinSystemPrompts(
  ...prompts: (string | undefined)[]
): string | undefined {
  return prompts.filter((p): p is string => p != null).join("\n\n");
}

/**
 * TODO: Can we have a simple provider that stores contents on the graph state?
 * We might be able to use tools to update it like we do in planning middleware
 * TODO: Maybe reuse BaseStore?
 */
export interface FileProvider {
  readFile(id: string): Promise<Buffer>;
  /** Return a globally unique file id */
  addFile(content: Buffer): Promise<string>;
}

export interface UploadFileToContainerOpts {
  containerId: string | undefined;
  providerId?: string;
  path: string;
  getContent: () => Promise<Buffer>;
}

export interface UploadFileToContainerRet {
  providerId?: string;
  isPendingModelResponse?: boolean;
}

export interface ContainerInfo {
  id?: string;
  expiresAt?: Date;
}

export interface FileFromProvider {
  providerId?: string;
  path: string;
  type: "ai" | "human" | "tool" | "system";
  content?: Buffer;
}

export interface ContainerProvider {
  tools: (ClientTool | ServerTool)[] | undefined;

  startContainer(): Promise<ContainerInfo>;

  uploadFileToContainer(
    options: UploadFileToContainerOpts
  ): Promise<UploadFileToContainerRet>;

  extractFilesFromModelResponse(
    messages: ModelRequest["messages"]
  ): Promise<FileFromProvider[]>;

  modifyModelRequest?<TState extends Record<string, unknown>, TContext>(
    containerId: string | undefined,
    newFiles: string[],
    request: ModelRequest<TState, TContext>
  ): Promise<ModelRequest<TState, TContext> | void>;

  extractContainerFromModelResponse?(
    messages: ModelRequest["messages"]
  ): ContainerInfo | undefined;
}
