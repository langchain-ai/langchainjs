declare module 'eventsource' {
  export default class EventSource {
    constructor(
      url: string,
      options?: {
        headers?: Record<string, string>;
        https?: any;
        rejectUnauthorized?: boolean;
        withCredentials?: boolean;
      }
    );

    onopen: (event: any) => void;
    onmessage: (event: any) => void;
    onerror: (event: any) => void;

    close(): void;

    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;

    readonly readyState: number;
    readonly url: string;
  }
}
