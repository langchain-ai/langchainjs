import { GAuthClient } from "./auth/node.js";
import { environment } from "./environment.js";

environment.value = {
  GoogleAuth: GAuthClient,
};

/**
 * embeddings for node
 */
import {
  GoogleEmbeddingsInput as CommonGoogleEmbeddingsInput,
  GoogleEmbeddings as CommonGoogleEmbeddings,
  VertexAIEmbeddings as CommonVertexAIEmbeddings,
} from "./embeddings.js";
export type GoogleEmbeddingsInput = CommonGoogleEmbeddingsInput<"node">;
export class GoogleEmbeddings extends CommonGoogleEmbeddings<"node"> {}
export class VertexAIEmbeddings extends CommonVertexAIEmbeddings<"node"> {}

/**
 * media for node
 */
import {
  BlobStoreGoogleCloudStorage as CommonBlobStoreGoogleCloudStorage,
  BlobStoreAIStudioFile as CommonBlobStoreAIStudioFile,
  BlobStoreGoogleCloudStorageParams as CommonBlobStoreGoogleCloudStorageParams,
} from "./media.js";
export type BlobStoreGoogleCloudStorageParams =
  CommonBlobStoreGoogleCloudStorageParams<"node">;
export class BlobStoreGoogleCloudStorage extends CommonBlobStoreGoogleCloudStorage<"node"> {}
export class BlobStoreAIStudioFile extends CommonBlobStoreAIStudioFile<"node"> {}

/**
 * llms for node
 */
import {
  GoogleLLMInput as CommonGoogleLLMInput,
  GoogleLLM as CommonGoogleLLM,
  VertexAI as CommonVertexAI,
} from "./llms.js";
export type GoogleLLMInput = CommonGoogleLLMInput<"node">;
export class GoogleLLM extends CommonGoogleLLM<"node"> {}
export class VertexAI extends CommonVertexAI<"node"> {}

/**
 * chat models for node
 */
import {
  ChatGoogleInput as CommonChatGoogleInput,
  ChatGoogle as CommonChatGoogle,
  ChatVertexAI as CommonChatVertexAI,
} from "./chat_models.js";
export type ChatGoogleInput = CommonChatGoogleInput<"node">;
export class ChatGoogle extends CommonChatGoogle<"node"> {}
export class ChatVertexAI extends CommonChatVertexAI<"node"> {}

/**
 * export auth primitives
 */
export * from "./auth/node.js";
