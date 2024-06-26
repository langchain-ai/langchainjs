import {
  BlobStoreGoogleCloudStorageBase,
  BlobStoreGoogleCloudStorageBaseParams,
  BlobStoreAIStudioFileBase,
  BlobStoreAIStudioFileBaseParams,
  GoogleAbstractedClient,
} from "@langchain/google-common";
import { GoogleAuthOptions } from "google-auth-library";
import { GAuthClient } from "./auth.js";

export interface BlobStoreGoogleCloudStorageParams
  extends BlobStoreGoogleCloudStorageBaseParams<GoogleAuthOptions> {}

export class BlobStoreGoogleCloudStorage extends BlobStoreGoogleCloudStorageBase<GoogleAuthOptions> {
  buildClient(
    fields?: BlobStoreGoogleCloudStorageParams
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}

export interface BlobStoreAIStudioFileParams
  extends BlobStoreAIStudioFileBaseParams<GoogleAuthOptions> {}

export class BlobStoreAIStudioFile extends BlobStoreAIStudioFileBase<GoogleAuthOptions> {
  buildAbstractedClient(
    fields?: BlobStoreAIStudioFileParams
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}
