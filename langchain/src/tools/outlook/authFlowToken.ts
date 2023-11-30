import { AuthFlowBase } from './authFlowBase.js';
import { getEnvironmentVariable } from '../../util/env.js';

interface AccessTokenResponse {
    access_token: string;
    refresh_token: string;
}

// if you have the token, and no need to refresh it, warning: token expires in 1 hour
export class AuthFlowToken extends AuthFlowBase {

    constructor(accessToken?: string) {
        if (!accessToken) {
            accessToken = getEnvironmentVariable('OUTLOOK_ACCESS_TOKEN');
        }
        if (!accessToken) {
            throw new Error('Missing access_token.');
        }
        super("");
        this.accessToken = accessToken;
    }

    public async refreshAccessToken(): Promise<string> {
        return this.accessToken;
    }
    
    public async getAccessToken(): Promise<string> {
        return this.accessToken;
    }
}

// if you have the refresh token and other credentials
export class AuthFlowRefresh extends AuthFlowBase {

    private clientSecret: string;
    private redirectUri: string;
    private refreshToken: string;

    constructor(clientId?: string, clientSecret?: string, redirectUri?: string, refreshToken?: string) {
        if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
            clientId = getEnvironmentVariable('OUTLOOK_CLIENT_ID');
            clientSecret = getEnvironmentVariable('OUTLOOK_CLIENT_SECRET');
            redirectUri = getEnvironmentVariable('OUTLOOK_REDIRECT_URI');
            refreshToken = getEnvironmentVariable('OUTLOOK_REFRESH_TOKEN');
        }
        if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
            throw new Error('Missing clientId, clientSecret, redirectUri or refreshToken.');
        }
        super(clientId);
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.refreshToken = refreshToken;
    }

    public async refreshAccessToken(): Promise<string> {
        // fetch new access token using refresh token
        const req_body =
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `client_secret=${encodeURIComponent(this.clientSecret)}&` +
        `scope=${encodeURIComponent('https://graph.microsoft.com/.default')}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `grant_type=refresh_token&` +
        `refresh_token=${encodeURIComponent(this.refreshToken)}`;
        
        const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: req_body
        });
        
        if (!response.ok) {
            throw new Error(`fetch token error! response: ${response}`);
        }
        // save new access token
        const json = await response.json() as AccessTokenResponse;
        this.accessToken = json.access_token;
        return this.accessToken;
    }
    
    // Function to get the token using the code and client credentials
    public async getAccessToken(): Promise<string> {
        const accessToken = await this.refreshAccessToken();
        this.accessToken = accessToken;
        return accessToken;
    }
}

