import { type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { sign } from "../../utils/tencent_hunyuan/web.js";
import {
  ChatTencentHunyuan as BaseChatTencentHunyuan,
  TencentHunyuanChatInput,
} from "./base.js";

/**
 * Wrapper around Tencent Hunyuan large language models that use the Chat endpoint.
 *
 * To use you should have the `TENCENT_SECRET_ID` and `TENCENT_SECRET_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments TencentHunyuanInput
 * @example
 * ```typescript
 * const messages = [new HumanMessage("Hello")];
 *
 * const hunyuanLite = new ChatTencentHunyuan({
 *   model: "hunyuan-lite",
 *   tencentSecretId: "YOUR-SECRET-ID",
 *   tencentSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * let res = await hunyuanLite.call(messages);
 *
 * const hunyuanPro = new ChatTencentHunyuan({
 *   model: "hunyuan-pro",
 *   temperature: 1,
 *   tencentSecretId: "YOUR-SECRET-ID",
 *   tencentSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * res = await hunyuanPro.call(messages);
 * ```
 */
export class ChatTencentHunyuan extends BaseChatTencentHunyuan {
  constructor(fields?: Partial<TencentHunyuanChatInput> & BaseChatModelParams) {
    super({ ...fields, sign });
  }
}
export { TencentHunyuanChatInput } from "./base.js";
