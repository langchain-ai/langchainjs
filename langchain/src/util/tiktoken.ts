import {
  Tiktoken,
  TiktokenBPE,
  TiktokenEncoding,
  TiktokenModel,
  getEncodingNameForModel,
} from "js-tiktoken";

const cache: Record<string, TiktokenBPE> = {};

export async function getEncoding(
  encoding: TiktokenEncoding,
  extendedSpecialTokens?: Record<string, number>
) {
  if (!(encoding in cache)) {
    const res = await fetch(`https://tiktoken.pages.dev/js/${encoding}.json`);

    if (!res.ok) throw new Error("Failed to fetch encoding");
    cache[encoding] = await res.json();
  }
  return new Tiktoken(cache[encoding], extendedSpecialTokens);
}

export async function encodingForModel(
  model: TiktokenModel,
  extendedSpecialTokens?: Record<string, number>
) {
  return getEncoding(getEncodingNameForModel(model), extendedSpecialTokens);
}
