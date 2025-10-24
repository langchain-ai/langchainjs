import {
  GoogleAbstractedClient,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import {
  BlobStoreAIStudioFileBase,
  BlobStoreAIStudioFileBaseParams,
  BlobStoreGoogleCloudStorageBase,
  BlobStoreGoogleCloudStorageBaseParams,
} from "@langchain/google-common/experimental/media";
import { WebGoogleAuth, WebGoogleAuthOptions } from "./auth.js";

export interface BlobStoreGoogleCloudStorageParams
  extends BlobStoreGoogleCloudStorageBaseParams<WebGoogleAuthOptions> {}

export class BlobStoreGoogleCloudStorage extends BlobStoreGoogleCloudStorageBase<WebGoogleAuthOptions> {
  buildClient(
    fields?: GoogleBaseLLMInput<WebGoogleAuthOptions>
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }
}

export interface BlobStoreAIStudioFileParams
  extends BlobStoreAIStudioFileBaseParams<WebGoogleAuthOptions> {}

export class BlobStoreAIStudioFile extends BlobStoreAIStudioFileBase<WebGoogleAuthOptions> {
  buildAbstractedClient(
    fields?: BlobStoreAIStudioFileParams
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }
}
