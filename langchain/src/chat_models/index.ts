/* #__PURE__ */ console.error(
  "[WARN] Importing from 'langchain/chat_models' is deprecated. Import from eg. 'langchain/chat_models/openai' instead. See https://js.langchain.com/docs/getting-started/install#updating-from-0052 for upgrade instructions."
);

export { BaseChatModel, BaseChatModelParams, SimpleChatModel } from "./base.js";
export { ChatOpenAI } from "./openai.js";
export { ChatAnthropic } from "./anthropic.js";
