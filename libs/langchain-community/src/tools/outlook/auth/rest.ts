import * as http from "node:http";
import * as url from "node:url";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AuthFlowBase } from "./base.js";

/**
 * Represents the response structure for an access token.
 * @interface
 */
interface AccessTokenResponse {
  access_token: string;
  refresh_token: string;
}

/**
 * Implements the RESTful authentication flow for Microsoft Graph API.
 * Extends AuthFlowBase class.
 * @class
 */
export class AuthFlowREST extends AuthFlowBase {
  /**
   * The client secret used for authentication.
   * @private
   */
  private clientSecret: string;

  /**
   * The redirect URI for the authentication flow.
   * @private
   */
  private redirectUri: string;

  /**
   * The port on which the local server is running for handling authentication.
   * @private
   */
  private port: number;

  /**
   * The pathname component of the redirect URI.
   * @private
   */
  private pathname: string;

  /**
   * The refresh token obtained during authentication.
   * @private
   */
  private refreshToken = "";

  /**
   * Creates an instance of AuthFlowREST.
   * @constructor
   * @param {Object} options - Configuration options for the authentication flow.
   * @param {string} options.clientId - The client ID for authentication.
   * @param {string} options.clientSecret - The client secret for authentication.
   * @param {string} options.redirectUri - The redirect URI for authentication.
   */
  constructor({
    clientId,
    clientSecret,
    redirectUri,
  }: { clientId?: string; clientSecret?: string; redirectUri?: string } = {}) {
    let id = clientId;
    let secret = clientSecret;
    let uri = redirectUri;
    if (!id || !secret || !uri) {
      id = id ?? getEnvironmentVariable("OUTLOOK_CLIENT_ID");
      secret = secret ?? getEnvironmentVariable("OUTLOOK_CLIENT_SECRET");
      uri = uri ?? getEnvironmentVariable("OUTLOOK_REDIRECT_URI");
    }
    if (!id || !secret || !uri) {
      throw new Error("Missing clientId, clientSecret, or redirectUri.");
    }
    super(id);
    this.clientSecret = secret;
    this.redirectUri = uri;
    const parsedUrl = new URL(this.redirectUri);
    this.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 3000;
    this.pathname = parsedUrl.pathname || "";
  }

  /**
   * Opens the authentication URL and returns it.
   * @private
   * @returns {string} The authentication URL.
   */
  private openAuthUrl(): string {
    const loginEndpoint =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    const responseType = "code";
    const responseMode = "query";
    const redirectUri = encodeURIComponent(this.redirectUri); // redirect URI registered in Azure
    const scope = encodeURIComponent(
      "openid offline_access https://graph.microsoft.com/.default"
    );

    const url = [
      `${loginEndpoint}?client_id=${this.clientId}`,
      `&response_type=${responseType}`,
      `&response_mode=${responseMode}`,
      `&redirect_uri=${redirectUri}`,
      `&scope=${scope}`,
    ].join("");

    console.log("Please open the following URL to login:");
    console.log(url);
    return url;
  }

  /**
   * Starts a local server for handling the authorization code.
   * @private
   * @returns {Promise<http.Server>} A Promise resolving to the created server.
   */
  private startServer(): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      const server = http.createServer();

      server.listen(this.port, () => {
        console.log(`Server listening at http://localhost:${this.port}`);
        resolve(server);
      });

      server.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Listens for the authorization code on the local server.
   * @private
   * @param {http.Server} server - The server instance.
   * @returns {Promise<string>} A Promise resolving to the authorization code.
   */
  private async listenForCode(server: http.Server): Promise<string> {
    return new Promise((resolve, reject) => {
      // Set timeout in case the user fails to login
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error("Timeout"));
      }, 180000);

      server.on("request", (req, res) => {
        try {
          const reqUrl = url.parse(req.url || "", true);

          if (reqUrl.pathname === this.pathname) {
            const authCode = reqUrl.query.code as string;

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("Authorization code received. You can close this window.");

            clearTimeout(timeout);
            server.close();
            console.log("Server closed");
            resolve(authCode); // Resolve the Promise with the authorization code
          } else {
            res.writeHead(404);
            res.end("404 Not Found");
          }
        } catch (err) {
          clearTimeout(timeout);
          res.writeHead(500);
          res.end("Server error");
          reject(err);
        }
      });
    });
  }

  /**
   * Gets the authorization code from the user login.
   * @private
   * @returns {Promise<string>} A Promise resolving to the authorization code.
   */
  private async getCode(): Promise<string> {
    // check credentials
    if (!this.clientId || !this.redirectUri) {
      throw new Error("Missing clientId or redirectUri.");
    }

    const server = await this.startServer();
    this.openAuthUrl();
    const code = await this.listenForCode(server);
    return code;
  }

  /**
   * Login to get the access and refresh token by user login.
   * @public
   * @returns {Promise<{ accessToken: string; refreshToken: string }>} A Promise resolving to the access and refresh tokens.
   */
  public async getTokens(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // fetch auth code from user login
    const code = await this.getCode();
    // fetch access token using auth code
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
      code,
    });

    const req_body = params.toString();

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: req_body,
      }
    );

    if (!response.ok) {
      throw new Error(`Fetch token error! Response: ${response.status}`);
    }
    // save access token and refresh token
    const json = (await response.json()) as AccessTokenResponse;
    this.accessToken = json.access_token;
    this.refreshToken = json.refresh_token;
    return { accessToken: this.accessToken, refreshToken: this.refreshToken };
  }

  /**
   * return the refresh token
   * @public
   * @returns {string} The refresh token.
   */
  public getRefreshToken(): string {
    return this.refreshToken;
  }

  /**
   * Refreshes the access token using the refresh token.
   * @public
   * @returns {Promise<string>} A Promise resolving to the refreshed access token.
   */
  public async refreshAccessToken(): Promise<string> {
    // fetch new access token using refresh token
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      redirect_uri: this.redirectUri,
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });

    const req_body = params.toString();

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: req_body,
      }
    );

    if (!response.ok) {
      throw new Error(`Fetch token error! Response: ${response.status}`);
    }
    // save new access token
    const json = (await response.json()) as AccessTokenResponse;
    this.accessToken = json.access_token;
    return this.accessToken;
  }

  /**
   * returns a valid access token.
   * @public
   * @returns {Promise<string>} A Promise resolving to the access token.
   */
  public async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      const { accessToken, refreshToken } = await this.getTokens();
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    } else {
      try {
        this.accessToken = await this.refreshAccessToken();
      } catch (error) {
        const { accessToken, refreshToken } = await this.getTokens();
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
      }
    }
    return this.accessToken;
  }
}
