export abstract class AuthFlowBase {
    protected clientId: string;
    protected accessToken: string = "";

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    public abstract getAccessToken(): Promise<string>;
    public abstract refreshAccessToken(): Promise<string>;
} 