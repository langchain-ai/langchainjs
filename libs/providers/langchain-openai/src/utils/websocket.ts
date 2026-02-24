import WebSocket from "ws";

export interface OpenAIWebSocketManagerOptions {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}

export interface WebSocketRequest {
  model: string;
  input: unknown;
  stream: boolean;
  [key: string]: unknown;
}

/**
 * Manages a persistent WebSocket connection to the OpenAI Responses API.
 *
 * The WebSocket mode allows reusing a single connection for multiple requests,
 * reducing latency compared to establishing a new HTTP connection each time.
 *
 * @see https://developers.openai.com/api/docs/guides/websocket-mode
 */
export class OpenAIWebSocketManager {
  private ws: WebSocket | null = null;

  private connectPromise: Promise<WebSocket> | null = null;

  private apiKey: string;

  private baseURL: string;

  private organization?: string;

  private closed = false;

  constructor(options: OpenAIWebSocketManagerOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL ?? "wss://api.openai.com/v1/responses";
    this.organization = options.organization;
  }

  /**
   * Derive the WebSocket URL from a base HTTP or WebSocket URL.
   * Converts `https://` to `wss://` and `http://` to `ws://` if needed,
   * and ensures the path ends with `/responses`.
   */
  private getWebSocketURL(): string {
    let url = this.baseURL;

    if (url.startsWith("https://")) {
      url = `wss://${url.slice(8)}`;
    } else if (url.startsWith("http://")) {
      url = `ws://${url.slice(7)}`;
    }

    if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
      url = `wss://${url}`;
    }

    if (!url.endsWith("/responses")) {
      if (url.endsWith("/")) {
        url += "responses";
      } else {
        url += "/responses";
      }
    }

    return url;
  }

  private async connect(): Promise<WebSocket> {
    if (this.closed) {
      throw new Error("WebSocket manager is closed");
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<WebSocket>((resolve, reject) => {
      const url = this.getWebSocketURL();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        "OpenAI-Beta": "responses.websocket=v1",
      };

      if (this.organization) {
        headers["OpenAI-Organization"] = this.organization;
      }

      const ws = new WebSocket(url, { headers });

      ws.on("open", () => {
        this.ws = ws;
        this.connectPromise = null;
        resolve(ws);
      });

      ws.on("error", (err) => {
        this.connectPromise = null;
        this.ws = null;
        reject(err);
      });

      ws.on("close", () => {
        this.ws = null;
        this.connectPromise = null;
      });
    });

    return this.connectPromise;
  }

  /**
   * Send a request over the WebSocket and return an async iterable of streaming events.
   *
   * Each streamed event is a parsed JSON object matching the Responses API streaming event schema.
   */
  async *stream(
    request: WebSocketRequest,
    signal?: AbortSignal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): AsyncGenerator<any> {
    const ws = await this.connect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventQueue: any[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const onMessage = (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        eventQueue.push(event);
        resolveNext?.();
      } catch (e) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        error = e instanceof Error ? e : new Error(String(e));
        resolveNext?.();
      }
    };

    const onError = (err: Error) => {
      error = err;
      done = true;
      resolveNext?.();
    };

    const onClose = () => {
      done = true;
      resolveNext?.();
    };

    const onAbort = () => {
      error = new Error("AbortError");
      error.name = "AbortError";
      done = true;
      resolveNext?.();
    };

    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
    signal?.addEventListener("abort", onAbort);

    const waitForNext = () =>
      new Promise<void>((resolve) => {
        resolveNext = resolve;
      });

    try {
      ws.send(JSON.stringify(request));

      while (!done || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          const event = eventQueue.shift()!;

          if (event.type === "error") {
            throw new Error(
              event.error?.message ?? "Unknown WebSocket error from API"
            );
          }

          yield event;

          if (
            event.type === "response.completed" ||
            event.type === "response.failed" ||
            event.type === "response.incomplete"
          ) {
            break;
          }
        } else if (!done) {
          await waitForNext();
          resolveNext = null;
        }
      }

      if (error) {
        throw error;
      }
    } finally {
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Send a request over the WebSocket and wait for the full response (non-streaming).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async invoke(request: WebSocketRequest, signal?: AbortSignal): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;
    for await (const event of this.stream(
      { ...request, stream: true },
      signal
    )) {
      if (
        event.type === "response.completed" ||
        event.type === "response.failed" ||
        event.type === "response.incomplete"
      ) {
        result = event.response;
        break;
      }
    }
    return result;
  }

  /**
   * Close the WebSocket connection and prevent further usage.
   */
  close() {
    this.closed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectPromise = null;
  }

  /**
   * Whether the WebSocket connection is currently open.
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
