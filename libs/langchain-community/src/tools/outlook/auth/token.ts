import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AuthFlowBase } from "./base.js";

/**
 * Response structure for access token.
 * @interface AccessTokenResponse
 */
interface AccessTokenResponse {
  access_token: string;
  refresh_token: string;
}

/**
 * Authentication flow with a provided access token.
 * If the token is not provided, it falls back to an environment variable.
 * @class AuthFlowToken
 * @extends AuthFlowBase
 */
export class AuthFlowToken extends AuthFlowBase {
  /**
   * Constructor for AuthFlowToken.
   * @param {string} [accessToken] - Optional access token.
   * @throws Will throw an error if access token is missing.
   */
  constructor(accessToken?: string) {
    let token = accessToken;
    if (!token) {
      token = getEnvironmentVariable("OUTLOOK_ACCESS_TOKEN");
    }
    if (!token) {
      throw new Error("Missing access_token.");
    }
    super("");
    this.accessToken = token;
  }

  /**
   * Gets the access token.
   * @async
   * @returns {Promise<string>} - The access token.
   */
  public async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

/**
 * Authentication flow with a refresh token and other credentials.
 * @class AuthFlowRefresh
 * @extends AuthFlowBase
 */
export class AuthFlowRefresh extends AuthFlowBase {
  private clientSecret: string;

  private redirectUri: string;

  private refreshToken: string;

  /**
   * Constructor for AuthFlowRefresh.
   * @param {string} [clientId] - Optional client ID.
   * @param {string} [clientSecret] - Optional client secret.
   * @param {string} [redirectUri] - Optional redirect URI.
   * @param {string} [refreshToken] - Optional refresh token.
   * @throws Will throw an error if any required parameter is missing.
   */
  constructor(
    clientId?: string,
    clientSecret?: string,
    redirectUri?: string,
    refreshToken?: string
  ) {
    let id = clientId;
    let secret = clientSecret;
    let uri = redirectUri;
    let token = refreshToken;
    if (!id || !secret || !uri || !token) {
      id = id ?? getEnvironmentVariable("OUTLOOK_CLIENT_ID");
      secret = secret ?? getEnvironmentVariable("OUTLOOK_CLIENT_SECRET");
      uri = uri ?? getEnvironmentVariable("OUTLOOK_REDIRECT_URI");
      token = token ?? getEnvironmentVariable("OUTLOOK_REFRESH_TOKEN");
    }
    if (!id || !secret || !uri || !token) {
      throw new Error(
        "Missing clientId, clientSecret, redirectUri, or refreshToken."
      );
    }
    super(id);
    this.clientSecret = secret;
    this.redirectUri = uri;
    this.refreshToken = token;
  }

  /**
   * Refreshes the access token using the refresh token.
   * @async
   * @returns {Promise<string>} - The refreshed access token.
   * @throws Will throw an error if the token fetch fails.
   */
  public async refreshAccessToken(): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      redirect_uri: this.redirectUri,
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });

    const reqBody = params.toString();

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: reqBody,
      }
    );

    if (!response.ok) {
      throw new Error(`Fetch token error! Response: ${response.status}`);
    }

    const json = (await response.json()) as AccessTokenResponse;
    this.accessToken = json.access_token;
    return this.accessToken;
  }

  /**
   * Gets the access token by refreshing it.
   * @async
   * @returns {Promise<string>} - The access token.
   */
  public async getAccessToken(): Promise<string> {
    const accessToken = await this.refreshAccessToken();
    this.accessToken = accessToken;
    return accessToken;
  }
}
