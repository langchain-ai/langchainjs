import { WebGoogleAuth } from "./auth/web.js";
import { environment } from "./environment.js";

environment.value = {
  GoogleAuth: WebGoogleAuth,
};

/**
 * embeddings for web
 */
import {
  GoogleEmbeddingsInput as CommonGoogleEmbeddingsInput,
  GoogleEmbeddings as CommonGoogleEmbeddings,
  VertexAIEmbeddings as CommonVertexAIEmbeddings,
} from "./embeddings.js";
export type GoogleEmbeddingsInput = CommonGoogleEmbeddingsInput<"web">;
export class GoogleEmbeddings extends CommonGoogleEmbeddings<"web"> {}
export class VertexAIEmbeddings extends CommonVertexAIEmbeddings<"web"> {}

/**
 * media for web
 */
import {
  BlobStoreGoogleCloudStorage as CommonBlobStoreGoogleCloudStorage,
  BlobStoreAIStudioFile as CommonBlobStoreAIStudioFile,
  BlobStoreGoogleCloudStorageParams as CommonBlobStoreGoogleCloudStorageParams,
} from "./media.js";
export type BlobStoreGoogleCloudStorageParams =
  CommonBlobStoreGoogleCloudStorageParams<"web">;
export class BlobStoreGoogleCloudStorage extends CommonBlobStoreGoogleCloudStorage<"web"> {}
export class BlobStoreAIStudioFile extends CommonBlobStoreAIStudioFile<"web"> {}

/**
 * llms for web
 */
import {
  GoogleLLMInput as CommonGoogleLLMInput,
  GoogleLLM as CommonGoogleLLM,
  VertexAI as CommonVertexAI,
} from "./llms.js";
export type GoogleLLMInput = CommonGoogleLLMInput<"web">;
export class GoogleLLM extends CommonGoogleLLM<"web"> {}
export class VertexAI extends CommonVertexAI<"web"> {}

/**
 * chat models for web
 */
import {
  ChatGoogleInput as CommonChatGoogleInput,
  ChatGoogle as CommonChatGoogle,
  ChatVertexAI as CommonChatVertexAI,
} from "./chat_models.js";
export type ChatGoogleInput = CommonChatGoogleInput<"web">;
export class ChatGoogle extends CommonChatGoogle<"web"> {}
export class ChatVertexAI extends CommonChatVertexAI<"web"> {}

/**
 * export auth primitives
 */
export * from "./auth/web.js";
