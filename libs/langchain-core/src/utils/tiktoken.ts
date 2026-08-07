import {
  Tiktoken,
  TiktokenEncoding,
  TiktokenModel,
  getEncodingNameForModel,
} from "js-tiktoken/lite";
import { AsyncCaller } from "./async_caller.js";

type TiktokenCompatible = Pick<Tiktoken, "encode" | "decode">;

type VocabSpec = {
  name: string;
  file?: string;
};

const ENCODING_VOCAB: Partial<Record<TiktokenEncoding, VocabSpec>> = {
  cl100k_base: { name: "cl100k" },
  o200k_base: { name: "o200k" },
  r50k_base: { name: "gpt2" },
  gpt2: { name: "gpt2" },
  p50k_base: { name: "p50k" },
  p50k_edit: { name: "p50k", file: "p50k-edit.htk" },
};

const cache: Record<string, Promise<Tiktoken | TiktokenCompatible>> = {};

const caller = /* #__PURE__ */ new AsyncCaller({});

async function tryHypertok(
  encoding: TiktokenEncoding
): Promise<TiktokenCompatible> {
  const vocab = ENCODING_VOCAB[encoding];
  if (!vocab) {
    throw new Error(`No hypertok vocabulary mapped for ${encoding}`);
  }

  const [{ fromBytes }, { createTiktokenShim }, { loadVocab }] =
    await Promise.all([
      import("hypertok"),
      import("hypertok/tiktoken"),
      import("hypertok/vocab-resolve"),
    ]);
  const bytes = await loadVocab(
    vocab.name,
    vocab.file === undefined ? undefined : { file: vocab.file }
  );
  const tokenizer = await fromBytes(bytes);
  const shim = createTiktokenShim(tokenizer, { name: encoding });
  const decoder = new TextDecoder();

  return {
    encode: (text, allowedSpecial, disallowedSpecial) =>
      Array.from(shim.encode(text, allowedSpecial, disallowedSpecial)),
    decode: (tokens) => decoder.decode(shim.decode(tokens)),
  };
}

export async function getEncoding(
  encoding: TiktokenEncoding
): Promise<Tiktoken> {
  if (!(encoding in cache)) {
    // Fallback order: hypertok local, hypertok CDN, js-tiktoken CDN, then caller char/4 approximation.
    cache[encoding] = tryHypertok(encoding)
      .catch((error) => {
        console.warn(
          "Failed to initialize hypertok, falling back to js-tiktoken",
          error
        );
        return caller
          .fetch(`https://tiktoken.pages.dev/js/${encoding}.json`)
          .then((res) => res.json())
          .then((data) => new Tiktoken(data));
      })
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
