import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { convertMessagesToCompletionsMessageParams } from "../converters/completions.js";
import type { DecisionInput } from "./types.js";

type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

const OMITTED_TYPES = new Set(["input_audio", "audio", "file", "video"]);

function toOpenAIMessages(messages: BaseMessage[]) {
  return convertMessagesToCompletionsMessageParams({ messages });
}

function dataImageURL(part: {
  type?: unknown;
  image_url?: unknown;
}): string | undefined {
  if (part.type !== "image_url") return undefined;
  const image = part.image_url;
  const url =
    typeof image === "string"
      ? image
      : typeof image === "object" && image !== null && "url" in image
        ? image.url
        : undefined;
  return typeof url === "string" && url.startsWith("data:") ? url : undefined;
}

/** User messages in the API's native form, or `undefined` if any part needs the JSON form. */
function toNativeMessages(messages: HumanMessage[]) {
  const native = [];
  for (const { content } of toOpenAIMessages(messages)) {
    if (typeof content === "string" || content == null) {
      native.push({ role: "user", content: content ?? "" });
      continue;
    }
    const parts: InputPart[] = [];
    for (const part of content) {
      const url = dataImageURL(part);
      if (part.type === "text")
        parts.push({ type: "input_text", text: part.text });
      else if (url) parts.push({ type: "input_image", image_url: url });
      else return undefined;
    }
    native.push({ role: "user", content: parts });
  }
  return native;
}

/** Encodes state as JSON text, splitting out base64 images as image parts where they occur. */
function toJSONParts(state: DecisionInput): InputPart[] {
  const parts: InputPart[] = [];
  let text = "";
  const seen = new Set<object>();
  const flush = () => {
    if (text) parts.push({ type: "input_text", text });
    text = "";
  };
  const write = (value: unknown): void => {
    if (BaseMessage.isInstance(value))
      return write(toOpenAIMessages([value])[0]);
    if (value instanceof Date) return write(value.toISOString());
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      text += JSON.stringify(value);
      return;
    }
    if (typeof value !== "object")
      throw new TypeError(
        `Unsupported OpenAI Decisions input value: ${typeof value}.`
      );
    if (seen.has(value))
      throw new TypeError("OpenAI Decisions input contains a cycle.");
    if (Array.isArray(value)) {
      seen.add(value);
      text += "[";
      value.forEach((item, i) => {
        if (i) text += ",";
        write(item ?? null);
      });
      text += "]";
      seen.delete(value);
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError(
        `Unsupported OpenAI Decisions input value: ${value.constructor?.name ?? "object"}.`
      );
    const record = value as Record<string, unknown>;
    const url = dataImageURL(record);
    if (url) {
      flush();
      parts.push({ type: "input_image", image_url: url });
      return;
    }
    if (typeof record.type === "string" && OMITTED_TYPES.has(record.type))
      return write(`[${record.type} omitted]`);
    seen.add(value);
    text += "{";
    let first = true;
    for (const [key, item] of Object.entries(record)) {
      if (item === undefined) continue;
      text += `${first ? "" : ","}${JSON.stringify(key)}:`;
      first = false;
      write(item);
    }
    text += "}";
    seen.delete(value);
  };
  write(state);
  flush();
  return parts;
}

/**
 * Converts input to the Decisions API `input` field.
 *
 * Strings and human-only messages are sent natively. Anything else is sent as JSON
 * text in one user message, with base64 images kept in place and audio, video and
 * files replaced by placeholders.
 */
export function toDecisionInput(state: DecisionInput) {
  if (typeof state === "string") return state;
  const messages = BaseMessage.isInstance(state) ? [state] : state;
  if (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every((message) => HumanMessage.isInstance(message))
  ) {
    const native = toNativeMessages(messages);
    if (native) return native;
  }
  return [{ role: "user", content: toJSONParts(state) }];
}
