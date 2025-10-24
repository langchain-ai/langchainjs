export * from "./src/core.js";
export * from "./src/duplex.js";
export {
  PatchError as JsonPatchError,
  _deepClone as deepClone,
  escapePathComponent,
  unescapePathComponent,
} from "./src/helpers.js";

/**
 * Default export for backwards compat
 */

import * as core from "./src/core.js";
import {
  PatchError as JsonPatchError,
  _deepClone as deepClone,
  escapePathComponent,
  unescapePathComponent,
} from "./src/helpers.js";

export default {
  ...core,
  // ...duplex,
  JsonPatchError,
  deepClone,
  escapePathComponent,
  unescapePathComponent,
};
