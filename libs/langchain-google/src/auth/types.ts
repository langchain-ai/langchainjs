import {
  GoogleAbstractedFetchClient,
  type GoogleAbstractedClientOps,
} from "@langchain/google-common";

export abstract class GoogleAuth extends GoogleAbstractedFetchClient {
  abstract getProjectId(): Promise<string>;
  abstract request(opts: GoogleAbstractedClientOps): Promise<unknown>;
  abstract get clientType(): string;
}
