export { ChatOpenRouter } from "./chat_models/index.js";
export type {
  ChatOpenRouterParams as ChatOpenRouterInput,
  ChatOpenRouterCallOptions,
  ChatOpenRouterFields,
  OpenRouterResponseFormat,
  OpenRouterPlugin,
} from "./chat_models/types.js";
export type { OpenRouter } from "./api-types.js";
export {
  OpenRouterError,
  OpenRouterAuthError,
  OpenRouterRateLimitError,
} from "./utils/errors.js";
import _OPENROUTER_MODEL_PROFILES from "./profiles.js";

export const OPENROUTER_MODEL_PROFILES = _OPENROUTER_MODEL_PROFILES;
