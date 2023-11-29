export abstract class AuthFlowBase {
    protected clientId: string;
    protected clientSecret: string;
    protected redirectUri: string;

    constructor(clientId: string, clientSecret: string, redirectUri: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public abstract getAccessToken(): Promise<string>;
} 