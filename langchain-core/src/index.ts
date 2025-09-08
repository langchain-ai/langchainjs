/**
 * @langchain/core root entry point
 *
 * This file exists solely to satisfy bundler requirements for packages that use
 * static manual chunks (e.g., Vite's manualChunks, Webpack's splitChunks).
 *
 * IMPORTANT: Do not import from this root entry point in your code.
 * Instead, use specific subpath imports for better tree-shaking and performance:
 *
 * ❌ Don't do this:
 * import { BaseMessage } from "@langchain/core";
 *
 * ✅ Do this instead:
 * import { BaseMessage } from "@langchain/core/messages";
 * import { BaseChatModel } from "@langchain/core/language_models/chat_models";
 *
 * This approach ensures optimal bundle size and follows the intended usage pattern
 * of this package.
 */

// Empty export to make this a valid ES module
export {};
