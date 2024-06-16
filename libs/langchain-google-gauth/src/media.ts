import {
  BlobStoreGoogleCloudStorageBase,
  BlobStoreGoogleCloudStorageBaseParams,
  GoogleAbstractedClient
} from "@langchain/google-common";
import {GoogleAuthOptions} from "google-auth-library";
import {GAuthClient} from "./auth.js";

export interface BlobStoreGoogleCloudStorageParams
  extends BlobStoreGoogleCloudStorageBaseParams<GoogleAuthOptions> {}

export class BlobStoreGoogleCloudStorage
  extends BlobStoreGoogleCloudStorageBase<GoogleAuthOptions>
{

  buildClient(fields: BlobStoreGoogleCloudStorageParams | undefined): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }

}