import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ensureAuthOptionScopes,
  GoogleAbstractedClientOps,
  GoogleAbstractedFetchClient,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import {
  getAccessToken,
  getCredentials,
  Credentials,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore CJS type resolution workaround
} from "web-auth-library/google";

export type WebGoogleAuthOptions = {
  credentials: string | Credentials;
  scope?: string | string[];
  accessToken?: string;
  responseModality?: string;
};

export class WebGoogleAuth extends GoogleAbstractedFetchClient {
  options: WebGoogleAuthOptions;

  constructor(fields: GoogleBaseLLMInput<WebGoogleAuthOptions> | undefined) {
    super();

    const options = fields?.authOptions;
    const accessToken = options?.accessToken;

    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_WEB_CREDENTIALS") ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_CREDENTIALS");
    if (credentials === undefined)
      throw new Error(
        `Credentials not found. Please set the GOOGLE_WEB_CREDENTIALS environment variable or pass credentials into "authOptions.credentials".`
      );

    this.options = ensureAuthOptionScopes<WebGoogleAuthOptions>(
      { ...options, accessToken, credentials },
      "scope",
      fields?.platformType
    );
  }

  get clientType(): string {
    return "webauth";
  }

  async getProjectId(): Promise<string> {
    const credentials = getCredentials(this.options.credentials);
    return credentials.project_id;
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    let { accessToken } = this.options;

    if (accessToken === undefined) {
      accessToken = await getAccessToken(this.options);
    }

    const authHeader = {
      Authorization: `Bearer ${accessToken}`,
    };
    return this._request(opts?.url, opts, authHeader);
  }
}
