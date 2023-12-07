import { BaseChatIflytekXinghuo } from "./common.js";
import {
  WebSocketStreamOptions,
  BaseWebSocketStream,
} from "../../utils/iflytek_websocket_stream.js";

class WebSocketStream extends BaseWebSocketStream<string> {
  openWebSocket(url: string, options: WebSocketStreamOptions): WebSocket {
    return new WebSocket(url, options.protocols ?? []);
  }
}

/**
 * @example
 * ```typescript
 * const model = new ChatIflytekXinghuo();
 * const response = await model.call([new HumanMessage("Nice to meet you!")]);
 * console.log(response);
 * ```
 */
export class ChatIflytekXinghuo extends BaseChatIflytekXinghuo {
  async openWebSocketStream<WebSocketStream>(
    options: WebSocketStreamOptions
  ): Promise<WebSocketStream> {
    const host = "spark-api.xf-yun.com";
    const date = new Date().toUTCString();
    const url = `GET /${this.version}/chat HTTP/1.1`;
    const keyBuffer = new TextEncoder().encode(this.iflytekApiSecret);
    const dataBuffer = new TextEncoder().encode(
      `host: ${host}\ndate: ${date}\n${url}`
    );
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
    const hash = window.btoa(String.fromCharCode(...new Uint8Array(signature)));
    const authorization_origin = `api_key="${this.iflytekApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${hash}"`;
    const authorization = window.btoa(authorization_origin);
    let authWebSocketUrl = this.apiUrl;
    authWebSocketUrl += `?authorization=${authorization}`;
    authWebSocketUrl += `&host=${encodeURIComponent(host)}`;
    authWebSocketUrl += `&date=${encodeURIComponent(date)}`;
    return new WebSocketStream(authWebSocketUrl, options) as WebSocketStream;
  }
}
