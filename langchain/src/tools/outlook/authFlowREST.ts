import * as http from "http";
import * as url from "url";
import * as openurl from "openurl";
import { AuthFlowBase } from "./authFlowBase.js";
import { getEnvironmentVariable } from "../../util/env.js";

interface AccessTokenResponse {
  access_token: string;
  refresh_token: string;
}

export class AuthFlowREST extends AuthFlowBase {
  private clientSecret: string;

  private redirectUri: string;

  private port: number;

  private pathname: string;

  private refreshToken = "";

  constructor({
    clientId,
    clientSecret,
    redirectUri,
  }: { clientId?: string; clientSecret?: string; redirectUri?: string } = {}) {
    let id = clientId;
    let secret = clientSecret;
    let uri = redirectUri;
    if (!id || !secret || !uri) {
      id = getEnvironmentVariable("OUTLOOK_CLIENT_ID");
      secret = getEnvironmentVariable("OUTLOOK_CLIENT_SECRET");
      uri = getEnvironmentVariable("OUTLOOK_REDIRECT_URI");
    }
    if (!id || !secret || !uri) {
      throw new Error("Missing clientId, clientSecret or redirectUri.");
    }
    super(id);
    this.clientSecret = secret;
    this.redirectUri = uri;
    const parsedUrl = new URL(this.redirectUri);
    this.port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 3000;
    this.pathname = parsedUrl.pathname || "";
  }

  // Function to construct the OAuth URL
  private openAuthUrl(): string {
    const loginEndpoint =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    const { clientId } = this; // client ID regestered in Azure
    const response_type = "code";
    const response_mode = "query";
    const redirectUri = encodeURIComponent(this.redirectUri); // redirect URI regestered in Azure
    const scope = encodeURIComponent(
      "openid offline_access https://graph.microsoft.com/.default"
    );
    const state = "12345";

    const url = [
      `${loginEndpoint}?client_id=${clientId}`,
      `&response_type=${response_type}`,
      `&response_mode=${response_mode}`,
      `&redirect_uri=${redirectUri}`,
      `&scope=${scope}`,
      `&state=${state}`,
    ].join("");
    openurl.open(url);
    return url;
  }

  // Function to start the server
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

  // Function to listen for the authorization code
  private async listenForCode(server: http.Server): Promise<string> {
    return new Promise((resolve, reject) => {
      server.on("request", (req, res) => {
        try {
          const reqUrl = url.parse(req.url || "", true);

          if (reqUrl.pathname === this.pathname) {
            const authCode = reqUrl.query.code as string;

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("Authorization code received. You can close this window.");

            server.close();
            console.log("Server closed");
            resolve(authCode); // Resolve the Promise with the authorization code
          } else {
            res.writeHead(404);
            res.end("404 Not Found");
          }
        } catch (err) {
          res.writeHead(500);
          res.end("Server error");
          reject(err);
        }
      });
    });
  }

  // Main function to run the auth flow
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

  // Function to get the token using the code and client credentials
  public async getAccessToken(): Promise<string> {
    // fetch auth code from user login
    const code = await this.getCode();
    // fetch access token using auth code
    const req_body =
      `client_id=${encodeURIComponent(this.clientId)}&` +
      `client_secret=${encodeURIComponent(this.clientSecret)}&` +
      `scope=${encodeURIComponent("https://graph.microsoft.com/.default")}&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `grant_type=authorization_code&` +
      `code=${encodeURIComponent(code)}`;

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
      throw new Error(`fetch token error! response: ${response.status}`);
    }
    // save access token and refresh token
    const json = (await response.json()) as AccessTokenResponse;
    this.accessToken = json.access_token;
    this.refreshToken = json.refresh_token;
    return this.accessToken;
  }

  public async refreshAccessToken(): Promise<string> {
    // fetch new access token using refresh token
    const req_body =
      `client_id=${encodeURIComponent(this.clientId)}&` +
      `client_secret=${encodeURIComponent(this.clientSecret)}&` +
      `scope=${encodeURIComponent("https://graph.microsoft.com/.default")}&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `grant_type=refresh_token&` +
      `refresh_token=${encodeURIComponent(this.refreshToken)}`;

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
      throw new Error(`fetch token error! response: ${response.status}`);
    }
    // save new access token
    const json = (await response.json()) as AccessTokenResponse;
    this.accessToken = json.access_token;
    return this.accessToken;
  }
}
