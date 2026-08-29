import {
  Tiktoken,
  TiktokenEncoding,
  TiktokenModel,
  getEncodingNameForModel,
} from "js-tiktoken/lite";
import { AsyncCaller } from "./async_caller.js";

const cache: Record<string, Promise<Tiktoken>> = {};

const caller = /* #__PURE__ */ new AsyncCaller({});

// Define a strict allowlist of expected encodings
const VALID_ENCODINGS = [
  "cl100k_base",
  "p50k_base",
  "r50k_base",
  "gpt2"
  // Add any other specific js-tiktoken encodings you support
] as const;

export async function getEncoding(encoding: TiktokenEncoding) {
  // Defensive Design: Validate immediately at the boundaries
  if (!VALID_ENCODINGS.includes(encoding as any)) {
    throw new Error(
      `Invalid encoding "${encoding}". Must be one of: ${VALID_ENCODINGS.join(", ")}`
    );
  }

  // Proceed to cache lookup safely
  if (!(encoding in cache)) {
    cache[encoding] = caller
      .fetch(`https://tiktoken.pages.dev/js/${encoding}.json`)
      .then((res) => res.json())
      .then((data) => new Tiktoken(data))
      .catch((e) => {
        delete cache[encoding];
        throw e;
      });
  }
  return await cache[encoding];
}

export async function encodingForModel(model: TiktokenModel) {
  return getEncoding(getEncodingNameForModel(model));
}