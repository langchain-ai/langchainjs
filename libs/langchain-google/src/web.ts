import { WebGoogleAuth } from "./auth/web.js";
import { environment } from "./environment.js";
import {
  GoogleEmbeddingsInput as CommonGoogleEmbeddingsInput,
  GoogleEmbeddings as CommonGoogleEmbeddings,
  VertexAIEmbeddings as CommonVertexAIEmbeddings,
  GoogleVertexAIEmbeddingsInput as CommonGoogleVertexAIEmbeddingsInput,
} from "./embeddings.js";
import {
  BlobStoreGoogleCloudStorage as CommonBlobStoreGoogleCloudStorage,
  BlobStoreAIStudioFile as CommonBlobStoreAIStudioFile,
  BlobStoreGoogleCloudStorageParams as CommonBlobStoreGoogleCloudStorageParams,
  BlobStoreAIStudioFileParams as CommonBlobStoreAIStudioFileParams,
} from "./media.js";
import {
  GoogleLLMInput as CommonGoogleLLMInput,
  GoogleLLM as CommonGoogleLLM,
  VertexAI as CommonVertexAI,
  VertexAIInput as CommonVertexAIInput,
} from "./llms.js";
import {
  ChatGoogleInput as CommonChatGoogleInput,
  ChatGoogle as CommonChatGoogle,
  ChatVertexAI as CommonChatVertexAI,
  ChatVertexAIInput as CommonChatVertexAIInput,
} from "./chat_models.js";

environment.value = {
  GoogleAuth: WebGoogleAuth,
};

type Environment = "web";

/**
 * embeddings for web
 */
export type GoogleEmbeddingsInput = CommonGoogleEmbeddingsInput<Environment>;
export class GoogleEmbeddings extends CommonGoogleEmbeddings<Environment> {}
export class VertexAIEmbeddings extends CommonVertexAIEmbeddings<Environment> {}
export type GoogleVertexAIEmbeddingsInput =
  CommonGoogleVertexAIEmbeddingsInput<Environment>;

/**
 * media for web
 */
export type BlobStoreGoogleCloudStorageParams =
  CommonBlobStoreGoogleCloudStorageParams<Environment>;
export class BlobStoreGoogleCloudStorage extends CommonBlobStoreGoogleCloudStorage<Environment> {}
export class BlobStoreAIStudioFile extends CommonBlobStoreAIStudioFile<Environment> {}
export type BlobStoreAIStudioFileParams =
  CommonBlobStoreAIStudioFileParams<Environment>;

/**
 * llms for web
 */
export type GoogleLLMInput = CommonGoogleLLMInput<Environment>;
export class GoogleLLM extends CommonGoogleLLM<Environment> {}
export class VertexAI extends CommonVertexAI<Environment> {}
export type VertexAIInput = CommonVertexAIInput<Environment>;

/**
 * chat models for web
 */
export type ChatGoogleInput = CommonChatGoogleInput<Environment>;
export class ChatGoogle extends CommonChatGoogle<Environment> {}
export class ChatVertexAI extends CommonChatVertexAI<Environment> {}
export type ChatVertexAIInput = CommonChatVertexAIInput<Environment>;

/**
 * export auth primitives
 */
export { WebGoogleAuthOptions, WebGoogleAuth } from "./auth/web.js";
