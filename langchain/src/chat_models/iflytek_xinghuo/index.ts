import WebSocket from "ws";
import { BaseChatIflytekXinghuo } from "./common.js";
import {
  BaseWebSocketStream,
  WebSocketStreamOptions,
} from "../../util/iflytek_websocket_stream.js";
import { getEnv } from "../../util/env.js";

class WebSocketStream extends BaseWebSocketStream {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  openWebSocket(url: string, options: WebSocketStreamOptions): WebSocket {
    return new WebSocket(url, options.protocols ?? []);
  }
}

export class ChatIflytekXinghuo extends BaseChatIflytekXinghuo {
  async openWebSocketStream<WebSocketStream>(
    options: WebSocketStreamOptions
  ): Promise<WebSocketStream> {
    const { createHmac } = await ChatIflytekXinghuo.imports();

    const host = "spark-api.xf-yun.com";
    const date = new Date().toUTCString();
    const url = `GET /${this.version}/chat HTTP/1.1`;
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

  /**
   * Static method that imports the `createHmac` function from the
   * `crypto` module in Node.js. It is used to dynamically import the
   * function when needed. If the import fails, it throws an error
   * indicating that the `crypto` module is not available in the
   * current environment.
   * @returns Promise that resolves with an object containing the `createHmac` function.
   */
  static async imports() {
    try {
      const { createHmac } = await import("node:crypto");
      return { createHmac };
    } catch (e) {
      console.error(e);

      throw new Error(
        `Failed to load crypto. 'createHmac' available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
