import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { v4 as uuid } from "@langchain/core/utils/uuid";
import { convertMessagesToCompletionsMessageParams } from "../converters/completions.js";
import type { DecisionState } from "./types.js";

function imageURL(block: Record<string, unknown>): string | undefined {
  if (block.type === "image_url") {
    const image = block.image_url;
    return typeof image === "string"
      ? image
      : image && typeof image === "object" && "url" in image
        ? String(image.url)
        : undefined;
  }
  if (block.type === "image") {
    if (typeof block.url === "string") return block.url;
    const data = block.base64 ?? block.data;
    if (typeof data === "string")
      return `data:${block.mime_type ?? "image/png"};base64,${data}`;
  }
  return undefined;
}
export function toDecisionInput(state: DecisionState) {
  if (typeof state === "string") return state;
  const messages = BaseMessage.isInstance(state) ? [state] : state;
  if (
    Array.isArray(messages) &&
    messages.length &&
    messages.every((message) => HumanMessage.isInstance(message))
  ) {
    return messages.map((message) => ({
      role: "user",
      content:
        typeof message.content === "string"
          ? message.content
          : message.content.map((block) => {
              if (block.type === "text")
                return { type: "input_text", text: block.text };
              const url = imageURL(block);
              if (url?.startsWith("data:"))
                return { type: "input_image", image_url: url };
              throw new Error(
                "OpenAI Decisions only supports text and base64 data URL images."
              );
            }),
    }));
  }
  const images: string[] = [];
  const token = `lc-image-${uuid()}`;
  const seen = new Set<object>();
  function convert(value: DecisionState): unknown {
    if (BaseMessage.isInstance(value)) {
      const content =
        typeof value.content === "string"
          ? value.content
          : value.content.map((block) => {
              const url = imageURL(block);
              if (!url?.startsWith("data:")) return block;
              images.push(url);
              return { type: "text", text: `${token}-${images.length - 1}` };
            });
      const copy = Object.assign(
        Object.create(Object.getPrototypeOf(value)),
        value,
        { content }
      );
      return convertMessagesToCompletionsMessageParams({ messages: [copy] })[0];
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    )
      return value;
    if (typeof value !== "object" || seen.has(value))
      throw new TypeError("OpenAI Decisions input must be JSON-serializable.");
    seen.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = value.map(convert);
    else {
      if (
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        throw new TypeError(
          "OpenAI Decisions input must contain plain JSON objects."
        );
      result = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, convert(item)])
      );
    }
    seen.delete(value);
    return result;
  }
  const text = JSON.stringify(convert(state));
  const content: Record<string, unknown>[] = [];
  let position = 0;
  for (const match of text.matchAll(new RegExp(`${token}-(\\d+)`, "g"))) {
    content.push(
      { type: "input_text", text: text.slice(position, match.index) },
      { type: "input_image", image_url: images[Number(match[1])] }
    );
    position = match.index! + match[0].length;
  }
  content.push({ type: "input_text", text: text.slice(position) });
  return [{ role: "user", content }];
}
