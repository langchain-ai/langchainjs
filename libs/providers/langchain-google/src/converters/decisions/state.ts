import type {
  Content as DecisionContent,
  State,
} from "@langchain/core/decisions";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  isDataContentBlock,
  parseBase64DataUrl,
  ToolMessage,
} from "@langchain/core/messages";
import type { Gemini } from "../../chat_models/types.js";
import type { GoogleDecisions } from "../../decisions/types.js";
import { InvalidInputError } from "../../utils/errors.js";
import { convertMediaResolutionToInteractions } from "../interactions/params.js";

const CIRCULAR_INPUT_ERROR =
  "Circular reference detected in Gemini Decisions input.";
const EMPTY_STATE_ERROR = "Gemini Decisions state must not be empty.";
const EMPTY_INSTRUCTIONS_ERROR =
  "Gemini Decisions question instructions must not be empty.";
const ROOT_STATE_TYPE_ERROR =
  "Gemini Decisions state must be a non-empty string, object, array, or BaseMessage.";

/**
 * NOTE ON NESTED MEDIA IN JSON OBJECTS (Future Revisit):
 *
 * Unlike TypeSafe (which carries out-of-band media in a separate `assets` map
 * keyed by `<image:...>` placeholders), the Gemini Decisions API accepts a flat
 * `input: string | Content | Content[]` where structured JSON objects and
 * multi-turn conversations must be serialized as text, and adjacent text blocks
 * are concatenated with no separator.
 *
 * To start with the simplest, least surprising behavior while consulting the
 * Google Decisions API team on recommended prompt/token formatting for keyed
 * media, `GoogleClassifier` currently supports media content blocks ONLY:
 *   1. Directly at the root of `state` (or `instructions`),
 *   2. Directly as elements of a root `state` (or `instructions`) array, or
 *   3. Inside root `BaseMessage` instances (`state = message` or `state = [msg1, msg2]`).
 *
 * Media blocks nested inside plain `{ key: value }` JSON objects (including
 * inside `BaseMessage` arrays nested within a JSON object, such as
 * `autoModeMiddleware`'s `{ messages, tool_call }`) throw `InvalidInputError`
 * rather than silently serializing base64 payloads as text tokens.
 *
 * Candidate approaches when revisiting:
 *   - Interleaving native `Interactions.Content` blocks inline by splitting the
 *     serialized JSON string at each media value boundary, or
 *   - Substituting `<image:N>` / `<document:N>` placeholder strings in the JSON
 *     object followed by labeled `Content` blocks at the end of `input`.
 */
const NESTED_MEDIA_ERROR =
  "Media content blocks nested inside JSON objects are not currently supported by GoogleClassifier. Pass media blocks at the root of state or inside root BaseMessage objects.";

const MEDIA_BLOCK_TYPE_NAMES = new Set([
  "image",
  "audio",
  "video",
  "file",
  "document",
  "media",
]);

const MEDIA_HINT_KEYS = [
  "data",
  "uri",
  "url",
  "fileUri",
  "file_uri",
  "fileId",
  "file_id",
  "source_type",
  "mimeType",
  "mime_type",
] as const;

type PlainRecord = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is PlainRecord =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !BaseMessage.isInstance(value);

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function safeJsonStringify(value: unknown, errorMessage: string): string {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") {
      throw new InvalidInputError(errorMessage);
    }
    return serialized;
  } catch (error) {
    if (InvalidInputError.isInstance(error)) {
      throw error;
    }
    // Discard the underlying V8 message so circular-property names in caller
    // state are never echoed into thrown errors.
    throw new InvalidInputError(errorMessage);
  }
}

function inferMimeTypeFromUri(uri: string): string | undefined {
  const mimeTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    heic: "image/heic",
    heif: "image/heif",
    tif: "image/tiff",
    tiff: "image/tiff",
    wav: "audio/wav",
    mp3: "audio/mp3",
    aiff: "audio/aiff",
    aac: "audio/aac",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/m4a",
    opus: "audio/opus",
    mp4: "video/mp4",
    mpeg: "video/mpeg",
    mov: "video/mov",
    avi: "video/avi",
    webm: "video/webm",
    wmv: "video/wmv",
    flv: "video/x-flv",
    "3gp": "video/3gpp",
    pdf: "application/pdf",
  };
  try {
    const pathname = new URL(uri).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase().split(/[?#]/)[0];
    return ext ? mimeTypeMap[ext] : undefined;
  } catch {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    return match ? mimeTypeMap[match[1].toLowerCase()] : undefined;
  }
}

function extractBlockResolution(
  block: PlainRecord,
  defaultResolution?: Gemini.Interactions.MediaResolution
): Gemini.Interactions.MediaResolution | undefined {
  const metadata = isPlainRecord(block.metadata) ? block.metadata : undefined;
  const raw =
    (typeof block.resolution === "string" ? block.resolution : undefined) ??
    (typeof block.mediaResolution === "string"
      ? block.mediaResolution
      : isPlainRecord(block.mediaResolution) &&
          typeof block.mediaResolution.level === "string"
        ? block.mediaResolution.level
        : undefined) ??
    (typeof metadata?.resolution === "string"
      ? metadata.resolution
      : undefined) ??
    (typeof metadata?.mediaResolution === "string"
      ? metadata.mediaResolution
      : undefined) ??
    (isPlainRecord(block.image_url) &&
    typeof block.image_url.detail === "string"
      ? block.image_url.detail
      : undefined);

  if (raw) {
    return (
      convertMediaResolutionToInteractions(
        raw as Gemini.Shared.MediaResolution,
        raw === "auto" || raw === "low" || raw === "high" ? raw : undefined
      ) ?? defaultResolution
    );
  }
  return defaultResolution;
}

/**
 * Checks whether `value` looks like a LangChain, Gemini, or Interactions media
 * content block (as opposed to an arbitrary domain JSON object).
 */
export function isMediaLikeBlock(value: unknown): value is PlainRecord {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (isDataContentBlock(value)) {
    return value.source_type !== "text";
  }
  if ("image_url" in value || "inlineData" in value || "fileData" in value) {
    return true;
  }
  if (
    typeof value.type === "string" &&
    MEDIA_BLOCK_TYPE_NAMES.has(value.type)
  ) {
    return MEDIA_HINT_KEYS.some((key) => key in value);
  }
  return false;
}

const TEXT_CONTENT_BLOCK_ALLOWED_KEYS = new Set([
  "type",
  "text",
  "id",
  "index",
  "annotations",
  "metadata",
  "extras",
  "mimeType",
  "mime_type",
  "source_type",
]);

/**
 * Extracts text from a LangChain standard `ContentBlock.Text`, `text-plain`
 * block, deprecated `PlainTextContentBlock` (`source_type: "text"`), or Gemini
 * Interactions `TextContent` block.
 *
 * Domain JSON objects that happen to carry `type: "text"` alongside arbitrary
 * domain fields (e.g. `customer_id`) return `undefined` so they remain
 * serialized as structured JSON.
 */
export function extractTextContentBlock(value: unknown): string | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }
  if (
    isDataContentBlock(value) &&
    value.source_type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  ) {
    return value.text;
  }
  if (
    (value.type === "text" || value.type === "text-plain") &&
    typeof value.text === "string" &&
    Object.keys(value).every((key) => TEXT_CONTENT_BLOCK_ALLOWED_KEYS.has(key))
  ) {
    return value.text;
  }
  return undefined;
}

function buildInteractionsMediaContent(params: {
  kindHint?: "image" | "audio" | "video" | "document";
  mimeType?: string;
  data?: string;
  uri?: string;
  explicitResolution?: Gemini.Interactions.MediaResolution;
  defaultResolution?: Gemini.Interactions.MediaResolution;
}): Gemini.Interactions.Content {
  const {
    kindHint,
    mimeType,
    data,
    uri,
    explicitResolution,
    defaultResolution,
  } = params;

  let resolvedKind = kindHint;
  if (!resolvedKind && mimeType) {
    if (mimeType.startsWith("image/")) resolvedKind = "image";
    else if (mimeType.startsWith("audio/")) resolvedKind = "audio";
    else if (mimeType.startsWith("video/")) resolvedKind = "video";
    else resolvedKind = "document";
  }
  if (!resolvedKind) {
    resolvedKind = "document";
  }

  const effectiveMime = mimeType;
  if (!effectiveMime) {
    throw new InvalidInputError(
      `Gemini Decisions ${resolvedKind} content blocks require a valid mimeType.`
    );
  }

  const sourcePayload =
    typeof data === "string"
      ? { data }
      : typeof uri === "string"
        ? { uri }
        : undefined;
  if (!sourcePayload) {
    throw new InvalidInputError(
      `Gemini Decisions ${resolvedKind} content blocks require base64 data or a URI/URL.`
    );
  }

  if (resolvedKind === "image") {
    const resolution = explicitResolution ?? defaultResolution;
    return {
      type: "image",
      mime_type: effectiveMime as Gemini.Interactions.ImageContent["mime_type"],
      ...sourcePayload,
      ...(resolution ? { resolution } : {}),
    };
  }

  if (resolvedKind === "video") {
    // Gemini Decisions supports `ultra_high` on images only; clamp an inherited
    // `ultra_high` default down to `high` for video while preserving explicit settings.
    const inherited =
      defaultResolution === "ultra_high" ? "high" : defaultResolution;
    const resolution = explicitResolution ?? inherited;
    return {
      type: "video",
      mime_type: effectiveMime as Gemini.Interactions.VideoContent["mime_type"],
      ...sourcePayload,
      ...(resolution ? { resolution } : {}),
    };
  }

  if (resolvedKind === "audio") {
    return {
      type: "audio",
      mime_type: effectiveMime as Gemini.Interactions.AudioContent["mime_type"],
      ...sourcePayload,
    };
  }

  return {
    type: "document",
    mime_type:
      effectiveMime as Gemini.Interactions.DocumentContent["mime_type"],
    ...sourcePayload,
  };
}

/**
 * Converts a recognized media block into an Interactions `Content` block.
 */
export function convertMediaBlockToInteractionsContent(
  block: PlainRecord,
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): Gemini.Interactions.Content {
  const explicitResolution = extractBlockResolution(block, undefined);

  // 1. Gemini GenerateContent `inlineData` / `fileData`
  if (isPlainRecord(block.inlineData)) {
    const mimeType =
      typeof block.inlineData.mimeType === "string"
        ? block.inlineData.mimeType
        : undefined;
    const data =
      typeof block.inlineData.data === "string"
        ? block.inlineData.data
        : undefined;
    return buildInteractionsMediaContent({
      mimeType,
      data,
      explicitResolution,
      defaultResolution: defaultMediaResolution,
    });
  }
  if (isPlainRecord(block.fileData)) {
    const uri =
      typeof block.fileData.fileUri === "string"
        ? block.fileData.fileUri
        : undefined;
    const mimeType =
      typeof block.fileData.mimeType === "string"
        ? block.fileData.mimeType
        : uri
          ? inferMimeTypeFromUri(uri)
          : undefined;
    return buildInteractionsMediaContent({
      mimeType,
      uri,
      explicitResolution,
      defaultResolution: defaultMediaResolution,
    });
  }

  // 2. OpenAI-style `image_url`
  if ("image_url" in block) {
    const rawUrl =
      typeof block.image_url === "string"
        ? block.image_url
        : isPlainRecord(block.image_url) &&
            typeof block.image_url.url === "string"
          ? block.image_url.url
          : undefined;
    if (!rawUrl) {
      throw new InvalidInputError(
        "Missing URL in image_url content block for Gemini Decisions."
      );
    }
    const parsedDataUrl = parseBase64DataUrl({ dataUrl: rawUrl });
    if (parsedDataUrl?.data && parsedDataUrl?.mime_type) {
      const dataStr =
        typeof parsedDataUrl.data === "string"
          ? parsedDataUrl.data
          : uint8ArrayToBase64(parsedDataUrl.data);
      return buildInteractionsMediaContent({
        kindHint: "image",
        mimeType: parsedDataUrl.mime_type,
        data: dataStr,
        explicitResolution,
        defaultResolution: defaultMediaResolution,
      });
    }
    return buildInteractionsMediaContent({
      kindHint: "image",
      mimeType: inferMimeTypeFromUri(rawUrl) ?? "image/jpeg",
      uri: rawUrl,
      explicitResolution,
      defaultResolution: defaultMediaResolution,
    });
  }

  // 3. Deprecated LangChain DataContentBlock (`source_type`)
  if (isDataContentBlock(block)) {
    const kindHint =
      block.type === "image" || block.type === "audio" ? block.type : undefined;
    if (block.source_type === "base64") {
      const rawData: unknown = block.data;
      const dataStr =
        typeof rawData === "string"
          ? rawData
          : rawData instanceof Uint8Array
            ? uint8ArrayToBase64(rawData)
            : undefined;
      return buildInteractionsMediaContent({
        kindHint,
        mimeType: block.mime_type,
        data: dataStr,
        explicitResolution,
        defaultResolution: defaultMediaResolution,
      });
    }
    if (block.source_type === "url") {
      const parsed = parseBase64DataUrl({ dataUrl: block.url });
      if (parsed?.data) {
        const dataStr =
          typeof parsed.data === "string"
            ? parsed.data
            : uint8ArrayToBase64(parsed.data);
        return buildInteractionsMediaContent({
          kindHint,
          mimeType: parsed.mime_type || block.mime_type,
          data: dataStr,
          explicitResolution,
          defaultResolution: defaultMediaResolution,
        });
      }
      return buildInteractionsMediaContent({
        kindHint,
        mimeType: block.mime_type ?? inferMimeTypeFromUri(block.url),
        uri: block.url,
        explicitResolution,
        defaultResolution: defaultMediaResolution,
      });
    }
    if (block.source_type === "id") {
      return buildInteractionsMediaContent({
        kindHint,
        mimeType: block.mime_type ?? inferMimeTypeFromUri(block.id),
        uri: block.id,
        explicitResolution,
        defaultResolution: defaultMediaResolution,
      });
    }
  }

  // 4. Standard v1 ContentBlock (`image`, `audio`, `video`, `file`), legacy `media`,
  //    or Interactions-native (`image`, `audio`, `video`, `document`)
  const blockType = typeof block.type === "string" ? block.type : undefined;
  const kindHint: "image" | "audio" | "video" | "document" | undefined =
    blockType === "image" ||
    blockType === "audio" ||
    blockType === "video" ||
    blockType === "document"
      ? blockType
      : blockType === "file"
        ? "document"
        : undefined;

  const declaredMime =
    typeof block.mimeType === "string"
      ? block.mimeType
      : typeof block.mime_type === "string"
        ? block.mime_type
        : undefined;

  if ("data" in block && block.data !== undefined && block.data !== null) {
    const dataStr =
      typeof block.data === "string"
        ? block.data
        : block.data instanceof Uint8Array
          ? uint8ArrayToBase64(block.data)
          : undefined;
    if (typeof dataStr !== "string") {
      throw new InvalidInputError(
        "Gemini Decisions media `data` must be a base64 string or Uint8Array."
      );
    }
    return buildInteractionsMediaContent({
      kindHint,
      mimeType: declaredMime,
      data: dataStr,
      explicitResolution,
      defaultResolution: defaultMediaResolution,
    });
  }

  const rawUri =
    typeof block.uri === "string"
      ? block.uri
      : typeof block.url === "string"
        ? block.url
        : typeof block.fileUri === "string"
          ? block.fileUri
          : typeof block.file_uri === "string"
            ? block.file_uri
            : typeof block.fileId === "string"
              ? block.fileId
              : typeof block.file_id === "string"
                ? block.file_id
                : undefined;

  if (rawUri) {
    if (rawUri.startsWith("data:")) {
      const parsed = parseBase64DataUrl({ dataUrl: rawUri });
      if (!parsed?.data) {
        throw new InvalidInputError(
          "Malformed base64 data URL in Gemini Decisions media content block."
        );
      }
      const dataStr =
        typeof parsed.data === "string"
          ? parsed.data
          : uint8ArrayToBase64(parsed.data);
      return buildInteractionsMediaContent({
        kindHint,
        mimeType: parsed.mime_type || declaredMime,
        data: dataStr,
        explicitResolution,
        defaultResolution: defaultMediaResolution,
      });
    }
    return buildInteractionsMediaContent({
      kindHint,
      mimeType: declaredMime ?? inferMimeTypeFromUri(rawUri),
      uri: rawUri,
      explicitResolution,
      defaultResolution: defaultMediaResolution,
    });
  }

  throw new InvalidInputError(
    `Invalid media content block of type "${blockType ?? "unknown"}" for Gemini Decisions: expected base64 \`data\` or a \`uri\`/\`url\`.`
  );
}

type StreamSegment =
  | { kind: "text"; text: string }
  | { kind: "media"; content: Gemini.Interactions.Content };

function roleForMessage(message: BaseMessage): string {
  switch (message.getType()) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "tool":
      return "tool";
    case "function":
      return "function";
    case "system":
      return "system";
    case "generic":
      if (ChatMessage.isInstance(message)) {
        return message.role;
      }
      break;
    default:
      break;
  }
  throw new InvalidInputError(
    `Unsupported message type for Gemini Decisions state: "${message.getType()}".`
  );
}

/**
 * Renders a `BaseMessage` into an ordered list of text and (when `allowMedia`
 * is `true`) native Interactions media segments.
 */
function renderMessageSegments(
  message: BaseMessage,
  allowMedia: boolean,
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): StreamSegment[] {
  const role = roleForMessage(message);
  const correlation =
    ToolMessage.isInstance(message) && message.tool_call_id
      ? `#${message.tool_call_id}`
      : "";
  const name = message.name ? ` (${message.name})` : "";
  const header = `${role}${correlation}${name}: `;

  const segments: StreamSegment[] = [];
  let textBuffer: string[] = [];

  const flushTextBuffer = (trailingNewline: boolean) => {
    if (textBuffer.length === 0) {
      return;
    }
    const prefix = segments.length === 0 ? header : "";
    const joined = `${prefix}${textBuffer.join("\n")}${trailingNewline ? "\n" : ""}`;
    segments.push({ kind: "text", text: joined });
    textBuffer = [];
  };

  if (typeof message.content === "string") {
    if (message.content.length > 0) {
      textBuffer.push(message.content);
    }
  } else if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (typeof block === "string") {
        textBuffer.push(block);
        continue;
      }
      if (isPlainRecord(block)) {
        if (
          (block.type === "text" || block.type === "text-plain") &&
          typeof block.text === "string"
        ) {
          textBuffer.push(block.text);
          continue;
        }
        if (
          isDataContentBlock(block) &&
          block.source_type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          textBuffer.push(block.text);
          continue;
        }
        if (block.type === "reasoning" && typeof block.reasoning === "string") {
          textBuffer.push(block.reasoning);
          continue;
        }
        // Skip v1 `tool_call` content blocks when `AIMessage.tool_calls` already
        // carries them, avoiding duplicate rendering.
        if (
          block.type === "tool_call" &&
          AIMessage.isInstance(message) &&
          (message.tool_calls?.length ?? 0) > 0
        ) {
          continue;
        }
        if (isMediaLikeBlock(block)) {
          if (!allowMedia) {
            throw new InvalidInputError(NESTED_MEDIA_ERROR);
          }
          if (segments.length === 0 && textBuffer.length === 0) {
            segments.push({ kind: "text", text: header });
          } else {
            flushTextBuffer(true);
          }
          segments.push({
            kind: "media",
            content: convertMediaBlockToInteractionsContent(
              block,
              defaultMediaResolution
            ),
          });
          continue;
        }
      }
      textBuffer.push(
        safeJsonStringify(
          block,
          "Gemini Decisions message content block could not be serialized."
        )
      );
    }
  }

  const refusal = message.additional_kwargs?.refusal;
  if (typeof refusal === "string" && refusal.length > 0) {
    textBuffer.push(`[refused: ${refusal}]`);
  }

  if (AIMessage.isInstance(message) && message.tool_calls?.length) {
    for (const call of message.tool_calls) {
      const id = call.id ? `#${call.id}` : "";
      const serializedArgs = safeJsonStringify(
        call.args ?? {},
        "Gemini Decisions tool-call arguments could not be serialized."
      );
      textBuffer.push(`[called ${call.name}${id} with ${serializedArgs}]`);
    }
  }

  if (segments.length === 0 && textBuffer.length === 0) {
    return [{ kind: "text", text: header.trimEnd() }];
  }

  if (textBuffer.length > 0) {
    if (segments.length === 0) {
      segments.push({
        kind: "text",
        text: `${header}${textBuffer.join(" ")}`,
      });
    } else {
      const prevWasMedia = segments[segments.length - 1]?.kind === "media";
      segments.push({
        kind: "text",
        text: `${prevWasMedia ? "\n" : ""}${textBuffer.join(" ")}`,
      });
    }
  }

  return segments;
}

function renderMessageAsPlainString(message: BaseMessage): string {
  const segments = renderMessageSegments(message, false);
  return segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
}

/**
 * Normalizes a nested JSON value (inside a plain object or pure JSON array),
 * rendering nested text-only `BaseMessage`s to transcript strings, detecting
 * circular references, and rejecting nested media blocks with `InvalidInputError`.
 */
function prepareNestedJsonValue(
  value: unknown,
  ancestors: Set<object>
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidInputError(
        "Gemini Decisions JSON state cannot contain NaN or Infinity."
      );
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new InvalidInputError(
      `Unsupported value of type "${typeof value}" in Gemini Decisions JSON input.`
    );
  }

  if (ancestors.has(value)) {
    throw new InvalidInputError(CIRCULAR_INPUT_ERROR);
  }

  if (BaseMessage.isInstance(value)) {
    ancestors.add(value);
    try {
      return renderMessageAsPlainString(value);
    } finally {
      ancestors.delete(value);
    }
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new InvalidInputError(
        "Invalid Date encountered in Gemini Decisions input."
      );
    }
    return value.toISOString();
  }

  if (isMediaLikeBlock(value)) {
    throw new InvalidInputError(NESTED_MEDIA_ERROR);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => prepareNestedJsonValue(item, ancestors));
    }
    // Plain object check (reject arbitrary class instances like Map/Set/RegExp)
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      throw new InvalidInputError(
        "Unsupported non-plain object in Gemini Decisions JSON input."
      );
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue;
      }
      const prepared = prepareNestedJsonValue(item, ancestors);
      Object.defineProperty(out, key, {
        value: prepared,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Collapses an ordered list of text and media segments into the wire
 * `string | Content[]` representation, inserting `\n` between adjacent text
 * chunks because the Gemini Decisions API concatenates consecutive
 * `TextContent` blocks with no separator.
 */
function finalizeSegments(
  segments: StreamSegment[],
  emptyErrorMessage: string
): GoogleDecisions.Input {
  const hasMedia = segments.some((segment) => segment.kind === "media");
  if (!hasMedia) {
    let joined = "";
    for (const seg of segments) {
      if (seg.kind !== "text" || seg.text.length === 0) {
        continue;
      }
      if (joined.length === 0) {
        joined = seg.text;
      } else {
        const needsSeparator =
          !joined.endsWith("\n") && !seg.text.startsWith("\n");
        joined = `${joined}${needsSeparator ? "\n" : ""}${seg.text}`;
      }
    }
    if (joined.length === 0) {
      throw new InvalidInputError(emptyErrorMessage);
    }
    return joined;
  }

  const contents: Gemini.Interactions.Content[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "media") {
      contents.push(seg.content);
      continue;
    }
    if (seg.text.length === 0) {
      continue;
    }
    const prev = contents[contents.length - 1];
    if (prev?.type === "text") {
      const needsSeparator =
        !prev.text.endsWith("\n") && !seg.text.startsWith("\n");
      prev.text = `${prev.text}${needsSeparator ? "\n" : ""}${seg.text}`;
    } else {
      contents.push({ type: "text", text: seg.text });
    }
  }

  if (contents.length === 0) {
    throw new InvalidInputError(emptyErrorMessage);
  }
  return contents;
}

function convertRootArray(
  items: unknown[],
  defaultMediaResolution: Gemini.Interactions.MediaResolution | undefined,
  emptyErrorMessage: string
): GoogleDecisions.Input {
  const ancestors = new Set<object>([items]);
  const hasRootMessageOrContentBlock = items.some(
    (item) =>
      BaseMessage.isInstance(item) ||
      isMediaLikeBlock(item) ||
      extractTextContentBlock(item) !== undefined
  );

  // Pure JSON array (e.g. `["a", "b"]` or `[{ id: 1 }, { id: 2 }]`): serialize
  // as a JSON string per the Gemini Decisions structured-data guidance.
  if (!hasRootMessageOrContentBlock) {
    const prepared = items.map((item) =>
      prepareNestedJsonValue(item, ancestors)
    );
    return safeJsonStringify(prepared, CIRCULAR_INPUT_ERROR);
  }

  const segments: StreamSegment[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (typeof item === "string") {
      segments.push({ kind: "text", text: item });
      continue;
    }

    const extractedText = extractTextContentBlock(item);
    if (extractedText !== undefined) {
      segments.push({ kind: "text", text: extractedText });
      continue;
    }

    if (BaseMessage.isInstance(item)) {
      const msgSegments = renderMessageSegments(
        item,
        true,
        defaultMediaResolution
      );
      // If a preceding item ended with a media block, ensure the next
      // message's role header starts on a new line.
      const prevSeg = segments[segments.length - 1];
      const firstNewSeg = msgSegments[0];
      if (
        prevSeg?.kind === "media" &&
        firstNewSeg?.kind === "text" &&
        !firstNewSeg.text.startsWith("\n")
      ) {
        firstNewSeg.text = `\n${firstNewSeg.text}`;
      }
      segments.push(...msgSegments);
      continue;
    }

    if (isMediaLikeBlock(item)) {
      segments.push({
        kind: "media",
        content: convertMediaBlockToInteractionsContent(
          item,
          defaultMediaResolution
        ),
      });
      continue;
    }

    const prepared = prepareNestedJsonValue(item, ancestors);
    const jsonText = safeJsonStringify(prepared, CIRCULAR_INPUT_ERROR);
    segments.push({ kind: "text", text: jsonText });
  }

  return finalizeSegments(segments, emptyErrorMessage);
}

/**
 * Converts a `@langchain/core/decisions` `State` value into the Gemini
 * Decisions API `CreateDecisionRequest.input` payload (`string | Content | Content[]`).
 *
 * Media blocks are supported at the root of `state`, as elements of a root
 * `state` array, and inside root `BaseMessage` instances (`BaseMessage` or
 * `BaseMessage[]`). Media blocks nested inside plain JSON objects throw
 * `InvalidInputError` (see `NESTED_MEDIA_ERROR` note above).
 */
export function convertStateToDecisionsInput(
  state: State,
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): GoogleDecisions.Input {
  if (typeof state === "string") {
    if (state.length === 0) {
      throw new InvalidInputError(EMPTY_STATE_ERROR);
    }
    return state;
  }

  if (
    state === null ||
    state === undefined ||
    typeof state === "number" ||
    typeof state === "boolean" ||
    typeof state !== "object"
  ) {
    throw new InvalidInputError(ROOT_STATE_TYPE_ERROR);
  }

  if (BaseMessage.isInstance(state)) {
    const segments = renderMessageSegments(state, true, defaultMediaResolution);
    return finalizeSegments(segments, EMPTY_STATE_ERROR);
  }

  if (Array.isArray(state)) {
    return convertRootArray(state, defaultMediaResolution, EMPTY_STATE_ERROR);
  }

  const rootText = extractTextContentBlock(state);
  if (rootText !== undefined) {
    if (rootText.length === 0) {
      throw new InvalidInputError(EMPTY_STATE_ERROR);
    }
    return rootText;
  }

  if (isMediaLikeBlock(state)) {
    return [
      convertMediaBlockToInteractionsContent(state, defaultMediaResolution),
    ];
  }

  const prepared = prepareNestedJsonValue(state, new Set());
  return safeJsonStringify(prepared, CIRCULAR_INPUT_ERROR);
}

/**
 * Converts a `@langchain/core/decisions` `Content` value (`Question.instructions`)
 * into the Gemini Decisions API `instructions` field (`string | Content | Content[]`).
 *
 * Although the public Gemini Decisions guide documents `instructions` as text-only,
 * root media blocks in `instructions` are intentionally converted and passed
 * through so the Gemini API itself enforces modality constraints.
 */
export function convertContentToDecisionsInstructions(
  content: DecisionContent,
  defaultMediaResolution?: Gemini.Interactions.MediaResolution
): GoogleDecisions.Input {
  if (typeof content === "string") {
    if (content.length === 0) {
      throw new InvalidInputError(EMPTY_INSTRUCTIONS_ERROR);
    }
    return content;
  }

  if (
    content === null ||
    content === undefined ||
    typeof content !== "object"
  ) {
    throw new InvalidInputError(
      "Gemini Decisions question instructions must be a non-empty string, object, or array."
    );
  }

  if (Array.isArray(content)) {
    return convertRootArray(
      content,
      defaultMediaResolution,
      EMPTY_INSTRUCTIONS_ERROR
    );
  }

  const rootText = extractTextContentBlock(content);
  if (rootText !== undefined) {
    if (rootText.length === 0) {
      throw new InvalidInputError(EMPTY_INSTRUCTIONS_ERROR);
    }
    return rootText;
  }

  if (isMediaLikeBlock(content)) {
    return [
      convertMediaBlockToInteractionsContent(content, defaultMediaResolution),
    ];
  }

  const prepared = prepareNestedJsonValue(content, new Set());
  return safeJsonStringify(prepared, CIRCULAR_INPUT_ERROR);
}
