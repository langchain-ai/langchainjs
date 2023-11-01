import { BaseChatIflytekXinghuo } from "./common.js";
import {
  WebSocketStreamOptions,
  BaseWebSocketStream,
} from "../../util/iflytek_websocket_stream.js";
import { getEnv } from "../../util/env.js";

class WebSocketStream extends BaseWebSocketStream<string> {
  openWebSocket(url: string, options: WebSocketStreamOptions): WebSocket {
    return new WebSocket(url, options.protocols ?? []);
  }
}

export class ChatIflytekXinghuo extends BaseChatIflytekXinghuo {
  async openWebSocketStream<WebSocketStream>(
    options: WebSocketStreamOptions
  ): Promise<WebSocketStream> {
    const { subtle } = await ChatIflytekXinghuo.imports();

    const host = "spark-api.xf-yun.com";
    const date = new Date().toUTCString();
    const url = `GET /${this.version}/chat HTTP/1.1`;
    const keyBuffer = new TextEncoder().encode(this.iflytekApiSecret);
    const dataBuffer = new TextEncoder().encode(
      `host: ${host}\ndate: ${date}\n${url}`
    );
    const cryptoKey = await subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await subtle.sign("HMAC", cryptoKey, dataBuffer);
    const hash = window.btoa(String.fromCharCode(...new Uint8Array(signature)));
    const authorization_origin = `api_key="${this.iflytekApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${hash}"`;
    const authorization = window.btoa(authorization_origin);
    let authWebSocketUrl = this.apiUrl;
    authWebSocketUrl += `?authorization=${authorization}`;
    authWebSocketUrl += `&host=${encodeURIComponent(host)}`;
    authWebSocketUrl += `&date=${encodeURIComponent(date)}`;
    return new WebSocketStream(authWebSocketUrl, options) as WebSocketStream;
  }

  /**
   * Static method that imports the `subtle` function from the
   * `crypto` module in Node.js. It is used to dynamically import the
   * function when needed. If the import fails, it throws an error
   * indicating that the `crypto` module is not available in the
   * current environment.
   * @returns Promise that resolves with an object containing the `subtle` function.
   */
  static async imports() {
    try {
      const { subtle } = await import("node:crypto");
      return { subtle };
    } catch (e) {
      console.error(e);

      throw new Error(
        `Failed to load crypto. 'subtle' available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
