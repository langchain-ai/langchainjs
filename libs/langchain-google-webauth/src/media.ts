import {
  BlobStoreGoogleCloudStorageBase,
  BlobStoreGoogleCloudStorageBaseParams,
  GoogleAbstractedClient, GoogleBaseLLMInput
} from "@langchain/google-common";
import { WebGoogleAuth, WebGoogleAuthOptions } from "./auth.js";

export interface BlobStoreGoogleCloudStorageParams
  extends BlobStoreGoogleCloudStorageBaseParams<WebGoogleAuthOptions> {}

export class BlobStoreGoogleCloudStorage
  extends BlobStoreGoogleCloudStorageBase<WebGoogleAuthOptions>
{

  buildClient(
    fields?: GoogleBaseLLMInput<WebGoogleAuthOptions>
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }

}