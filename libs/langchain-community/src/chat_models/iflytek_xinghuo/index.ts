import WebSocket from "ws";
import { BaseChatIflytekXinghuo } from "./common.js";
import {
  BaseWebSocketStream,
  WebSocketStreamOptions,
} from "../../utils/iflytek_websocket_stream.js";

class WebSocketStream extends BaseWebSocketStream {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
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
    const { createHmac } = await import("node:crypto");
    const hash = createHmac("sha256", this.iflytekApiSecret)
      .update(`host: ${host}\ndate: ${date}\n${url}`)
      .digest("base64");
    const authorization_origin = `api_key="${this.iflytekApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${hash}"`;
    const authorization = Buffer.from(authorization_origin).toString("base64");
    let authWebSocketUrl = this.apiUrl;
    authWebSocketUrl += `?authorization=${authorization}`;
    authWebSocketUrl += `&host=${encodeURIComponent(host)}`;
    authWebSocketUrl += `&date=${encodeURIComponent(date)}`;
    return new WebSocketStream(authWebSocketUrl, options) as WebSocketStream;
  }
}
