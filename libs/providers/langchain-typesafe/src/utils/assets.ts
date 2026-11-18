import type { JsonValue } from "@langchain/core/decisions";

const IMAGE_FORMATS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};
const DATA_URL_PREFIX = "data:";
const BASE64_MARKER = ";base64,";

type Block = Record<string, unknown>;

const isBlock = (value: unknown): value is Block =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseDataUrl(url: unknown): [string, string] {
  if (
    typeof url !== "string" ||
    !url.startsWith(DATA_URL_PREFIX) ||
    !url.includes(BASE64_MARKER)
  ) {
    throw new Error(
      "TypeSafe image blocks must contain base64 data or a base64 `data:` URL. Images are not downloaded from other URLs."
    );
  }
  const rest = url.slice(DATA_URL_PREFIX.length);
  const marker = rest.indexOf(BASE64_MARKER);
  return [rest.slice(0, marker), rest.slice(marker + BASE64_MARKER.length)];
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// `crypto.randomUUID` is missing in non-secure browser contexts.
function randomHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function requireMimeType(block: Block): string {
  const mimeType = block.mimeType ?? block.mime_type;
  if (typeof mimeType !== "string") {
    throw new Error("TypeSafe base64 image blocks require a `mimeType`.");
  }
  return mimeType;
}

/**
 * Returns the MIME type and base64 data of an image block, or `undefined`
 * for any other value.
 *
 * Recognizes LangChain standard image blocks (current and legacy) and
 * OpenAI-format `image_url` blocks.
 */
function inlineImage(block: Block): [string, string] | undefined {
  if (block.type === "image_url") {
    const imageUrl = block.image_url;
    return parseDataUrl(isBlock(imageUrl) ? imageUrl.url : imageUrl);
  }
  if (block.type !== "image") return undefined;
  const declaresBase64 =
    block.mimeType !== undefined ||
    block.mime_type !== undefined ||
    block.source_type === "base64";
  if (block.data instanceof Uint8Array) {
    return [requireMimeType(block), toBase64(block.data)];
  }
  if (typeof block.data === "string" && declaresBase64) {
    return [requireMimeType(block), block.data];
  }
  if (typeof block.base64 === "string") {
    return [requireMimeType(block), block.base64];
  }
  if ("url" in block) return parseDataUrl(block.url);
  if ("fileId" in block || "file_id" in block || block.source_type === "id") {
    throw new Error(
      "TypeSafe image blocks must contain base64 data or a `data:` URL."
    );
  }
  return undefined;
}

/**
 * Collects image content blocks as TypeSafe request assets.
 *
 * TypeSafe replaces an `<image:...>` reference found in any request string
 * with the image registered under that reference in the request's `assets`.
 */
export class ImageAssets {
  readonly assets: Record<string, JsonValue> = {};

  /**
   * Returns the reference for `block` if it is an image block, registering
   * the image, or `undefined` otherwise.
   *
   * @throws Error if an image block has no inline data or an unsupported
   *   format.
   */
  reference(block: unknown): string | undefined {
    if (!isBlock(block)) return undefined;
    const image = inlineImage(block);
    if (image === undefined) return undefined;
    const [mimeType, data] = image;
    const format = IMAGE_FORMATS[mimeType.toLowerCase()];
    if (format === undefined) {
      throw new Error(
        `TypeSafe does not support image type "${mimeType}". Supported types: ${Object.keys(IMAGE_FORMATS).join(", ")}.`
      );
    }
    const reference = `<image:${randomHex()}>`;
    this.assets[reference] = { type: "image", format, data_base64: data };
    return reference;
  }

  /** Returns `value` with every image block replaced by its reference. */
  replace(value: JsonValue): JsonValue {
    const reference = this.reference(value);
    if (reference !== undefined) return reference;
    if (Array.isArray(value)) return value.map((item) => this.replace(item));
    if (isBlock(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.replace(item as JsonValue),
        ])
      );
    }
    return value;
  }
}
