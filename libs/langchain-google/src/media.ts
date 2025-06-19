import {
  GoogleAbstractedClient,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import {
  BlobStoreGoogleCloudStorageBase,
  BlobStoreGoogleCloudStorageBaseParams,
  BlobStoreAIStudioFileBase,
  BlobStoreAIStudioFileBaseParams,
} from "@langchain/google-common/experimental/media";
import { Environment, environment, GoogleAuthOptions } from "./environment.js";

export interface BlobStoreGoogleCloudStorageParams<Env extends Environment>
  extends BlobStoreGoogleCloudStorageBaseParams<GoogleAuthOptions<Env>> {}

export class BlobStoreGoogleCloudStorage<
  Env extends Environment
> extends BlobStoreGoogleCloudStorageBase<GoogleAuthOptions<Env>> {
  buildClient(
    fields?: Env extends "node"
      ? BlobStoreGoogleCloudStorageParams<Env>
      : GoogleBaseLLMInput<GoogleAuthOptions<Env>>
  ): GoogleAbstractedClient {
    return new environment.value.GoogleAuth(fields);
  }
}

export interface BlobStoreAIStudioFileParams<Env extends Environment>
  extends BlobStoreAIStudioFileBaseParams<GoogleAuthOptions<Env>> {}

export class BlobStoreAIStudioFile<
  Env extends Environment
> extends BlobStoreAIStudioFileBase<GoogleAuthOptions<Env>> {
  buildAbstractedClient(
    fields?: BlobStoreAIStudioFileParams<Env>
  ): GoogleAbstractedClient {
    return new environment.value.GoogleAuth(fields);
  }
}
