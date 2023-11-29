export abstract class AuthFlowBase {
    protected clientId: string;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    public abstract getAccessToken(): Promise<string>;
} 