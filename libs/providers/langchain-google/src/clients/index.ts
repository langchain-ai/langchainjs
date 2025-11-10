import { GOOGLE_API_KEY_HEADER } from "../const.js";

export abstract class ApiClient {
  abstract fetch(request: Request): Promise<Response>;
}

export interface WebApiClientParams {
  apiKey?: string;
  /**
   * @deprecated Import from `@langchain/google/node` to configure google auth options
   */
  googleAuthOptions?: never;
}

export class WebApiClient extends ApiClient {
  constructor(protected params: WebApiClientParams) {
    super();
  }

  fetch(request: Request): Promise<Response> {
    if (this.params.apiKey) {
      request.headers.set(GOOGLE_API_KEY_HEADER, this.params.apiKey);
    }
    return fetch(request);
  }
}
