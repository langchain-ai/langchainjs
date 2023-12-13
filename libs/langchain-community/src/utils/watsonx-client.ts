import {
  WatsonApiClientSettings,
  WatsonModelParameters,
} from "../types/watsonx-types.js";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";

type WatsonResult = {
  generated_text: string;
  generated_token_count: number;
  input_token_count: number;
  stop_reason: string;
};

type WatsonError = {
  code: string;
  message: string;
};

type WatsonResponse = {
  model_id: string;
  created_at: string;
  results: WatsonResult[];
  errors: WatsonError[];
};

type IAMTokenResponse = {
  access_token: string;
  refresh_token: string;
  ims_user_id: number;
  token_type: string;
  expires_in: number;
  expiration: number;
  scope: string;
};

export class WatsonApiClient {
  private iamToken?: IAMTokenResponse;

  private readonly apiKey!: string;

  private readonly apiVersion!: string;

  private readonly region!: string;

  private readonly baseUrl!: string;

  constructor({
    region,
    apiKey,
    apiVersion,
  }: Required<WatsonApiClientSettings>) {
    this.apiKey = apiKey;
    this.apiVersion = apiVersion;
    this.region = region;
    this.baseUrl = `https://${this.region}.ml.cloud.ibm.com`;
  }

  private async getIAMToken() {
    const url = `https://iam.cloud.ibm.com/identity/token`;
    const payload = {
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: this.apiKey,
    };
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const formBody = Object.entries(payload).reduce((acc, [key, value]) => {
      const encodedKey = encodeURIComponent(key as string);
      const encodedValue = encodeURIComponent(value as string);
      acc.push(`${encodedKey}=${encodedValue}`);
      return acc;
    }, [] as string[]);
    const body = formBody.join("&");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    return (await response.json()) as IAMTokenResponse;
  }

  private async getJwt() {
    // we have token and it's not expired
    if (this.iamToken && this.iamToken.expiration * 1000 > Date.now()) {
      return this.iamToken.access_token;
    }

    // we don't have token or its expired
    this.iamToken = await this.getIAMToken();
    return this.iamToken.access_token;
  }

  public async *generateTextStream(
    input: string,
    project_id: string,
    model_id: string,
    parameters?: WatsonModelParameters
  ) {
    const jwt = await this.getJwt();

    const url = `${this.baseUrl}/ml/v1-beta/generation/text_stream?version=${this.apiVersion}`;
    const headers = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };
    const { body, ok, statusText } = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input,
        project_id,
        model_id,
        parameters,
      }),
    });

    if (!body || !ok) {
      throw new Error(statusText);
    }

    const stream = convertEventStreamToIterableReadableDataStream(body);

    for await (const chunk of stream) {
      yield JSON.parse(chunk) as WatsonResponse;
    }
  }

  public async generateText(
    input: string,
    project_id: string,
    model_id: string,
    parameters?: WatsonModelParameters
  ) {
    const jwt = await this.getJwt();

    const url = `${this.baseUrl}/ml/v1-beta/generation/text?version=${this.apiVersion}`;
    const headers = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input,
        project_id,
        model_id,
        parameters,
      }),
    });

    const data = (await response.json()) as WatsonResponse;

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return data.results[0].generated_text;
  }
}
