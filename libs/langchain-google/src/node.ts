import { GAuthClient } from "./auth/node.js";
import { environment } from "./environment.js";
import {
  BlobStoreGoogleCloudStorage as CommonBlobStoreGoogleCloudStorage,
  BlobStoreAIStudioFile as CommonBlobStoreAIStudioFile,
  BlobStoreAIStudioFileParams as CommonBlobStoreAIStudioFileParams,
  BlobStoreGoogleCloudStorageParams as CommonBlobStoreGoogleCloudStorageParams,
} from "./media.js";

import {
  GoogleEmbeddingsInput as CommonGoogleEmbeddingsInput,
  GoogleEmbeddings as CommonGoogleEmbeddings,
  VertexAIEmbeddings as CommonVertexAIEmbeddings,
  GoogleVertexAIEmbeddingsInput as CommonGoogleVertexAIEmbeddingsInput,
} from "./embeddings.js";

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
  GoogleAuth: GAuthClient,
};

type Environment = "node";

/**
 * embeddings for node
 */
export type GoogleEmbeddingsInput = CommonGoogleEmbeddingsInput<Environment>;
export class GoogleEmbeddings extends CommonGoogleEmbeddings<Environment> {}
export class VertexAIEmbeddings extends CommonVertexAIEmbeddings<Environment> {}
export type GoogleVertexAIEmbeddingsInput =
  CommonGoogleVertexAIEmbeddingsInput<Environment>;

/**
 * media for node
 */
export type BlobStoreGoogleCloudStorageParams =
  CommonBlobStoreGoogleCloudStorageParams<Environment>;
export class BlobStoreGoogleCloudStorage extends CommonBlobStoreGoogleCloudStorage<Environment> {}
export class BlobStoreAIStudioFile extends CommonBlobStoreAIStudioFile<Environment> {}
export type BlobStoreAIStudioFileParams =
  CommonBlobStoreAIStudioFileParams<Environment>;

/**
 * llms for node
 */
export type GoogleLLMInput = CommonGoogleLLMInput<Environment>;
export class GoogleLLM extends CommonGoogleLLM<Environment> {}
export class VertexAI extends CommonVertexAI<Environment> {}
export type VertexAIInput = CommonVertexAIInput<Environment>;

/**
 * chat models for node
 */
export type ChatGoogleInput = CommonChatGoogleInput<Environment>;
export class ChatGoogle extends CommonChatGoogle<Environment> {}
export class ChatVertexAI extends CommonChatVertexAI<Environment> {}
export type ChatVertexAIInput = CommonChatVertexAIInput<Environment>;

/**
 * export auth primitives
 */
export { GAuthClient } from "./auth/node.js";
