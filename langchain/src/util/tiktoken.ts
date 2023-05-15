import {
  Tiktoken,
  TiktokenBPE,
  TiktokenEncoding,
  TiktokenModel,
  getEncodingNameForModel,
} from "js-tiktoken/lite";
import { AsyncCaller } from "./async_caller.js";

const cache: Record<string, Promise<TiktokenBPE>> = {};

const caller = new AsyncCaller({});

export async function getEncoding(
  encoding: TiktokenEncoding,
  extendedSpecialTokens?: Record<string, number>
) {
  if (!(encoding in cache)) {
    cache[encoding] = caller
      .fetch(`https://tiktoken.pages.dev/js/${encoding}.json`)
      .then((res) => res.json())
      .catch((e) => {
        delete cache[encoding];
        throw e;
      });
  }

  return new Tiktoken(await cache[encoding], extendedSpecialTokens);
}

export async function encodingForModel(
  model: TiktokenModel,
  extendedSpecialTokens?: Record<string, number>
) {
  return getEncoding(getEncodingNameForModel(model), extendedSpecialTokens);
}
