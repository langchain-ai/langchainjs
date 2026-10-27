import type { OpenAI as OpenAIClient } from "openai";
import { BaseMessage } from "@langchain/core/messages";
import { convertMessagesToResponsesInput } from "../converters/responses.js";
import type { DecisionInput } from "./types.js";

/**
 * How LangChain input becomes the Decisions API `input` field.
 *
 * The Decisions API accepts a string, or a list of items using a subset of the
 * Responses API input format: `user`, `system`, `developer` and `assistant` messages,
 * plus function and custom tool calls and their outputs. Rather than writing a second
 * LangChain message converter, messages go through the Responses converter
 * (`convertMessagesToResponsesInput`), which already handles roles, content blocks,
 * tool calls and tool results. The Decisions API is strict about what it accepts,
 * though, and Responses items carry things it rejects: reasoning items, item `id`s,
 * `annotations` and `phase` on assistant text, and content parts such as
 * `input_file`. So each Responses item is rebuilt with only the fields the Decisions
 * API accepts (`toDecisionItem`), and unsupported content parts are replaced by a
 * text placeholder so the model knows something was there.
 *
 * Input that is not messages, such as application state, is sent as an `input_json`
 * part, which the API reads as structured data. Messages nested in that state are
 * converted to the same items, because a `BaseMessage` instance would otherwise be
 * serialized as LangChain's internal constructor format.
 */

type ResponsesItem = ReturnType<typeof convertMessagesToResponsesInput>[number];
type DecisionItem = Exclude<
  OpenAIClient.DecisionCreateParams["input"],
  string
>[number];
type InputPart =
  | OpenAIClient.DecisionInputText
  | OpenAIClient.DecisionInputImage;
type AssistantPart = Exclude<
  OpenAIClient.DecisionInputMessage.DecisionInputAssistantMessage["content"],
  string
>[number];

/** A Responses content part, loosely typed because roles and tool outputs use different part unions. */
type ResponsesPart = {
  type: string;
  text?: unknown;
  image_url?: unknown;
  refusal?: unknown;
};

/**
 * Keeps text and image parts, which is all user messages and tool outputs accept,
 * and replaces anything else, such as `input_file`, with a placeholder.
 */
function toInputParts(content: unknown): InputPart[] {
  return (content as ResponsesPart[]).map((part) =>
    part.type === "input_text" && typeof part.text === "string"
      ? { type: "input_text", text: part.text }
      : part.type === "input_image" && typeof part.image_url === "string"
        ? { type: "input_image", image_url: part.image_url }
        : { type: "input_text", text: `[${part.type} omitted]` }
  );
}

/** System and developer messages accept only text parts. */
function toTextParts(content: unknown): OpenAIClient.DecisionInputText[] {
  return toInputParts(content).map((part) =>
    part.type === "input_text"
      ? part
      : { type: "input_text", text: "[input_image omitted]" }
  );
}

/** Assistant messages accept `output_text` and `refusal` parts, without `annotations`. */
function toAssistantParts(content: unknown): AssistantPart[] {
  return (content as ResponsesPart[]).flatMap((part): AssistantPart[] => {
    if (part.type === "output_text" && typeof part.text === "string")
      return [{ type: "output_text", text: part.text }];
    if (part.type === "refusal" && typeof part.refusal === "string")
      return [{ type: "refusal", refusal: part.refusal }];
    return [];
  });
}

/**
 * Rebuilds one Responses item with only the fields the Decisions API accepts.
 * Items it has no equivalent for, such as reasoning, are dropped.
 */
function toDecisionItem(item: ResponsesItem): DecisionItem[] {
  if ("role" in item && (!("type" in item) || item.type === "message")) {
    const { role, content } = item;
    if (typeof content === "string")
      return role === "user" ||
        role === "system" ||
        role === "developer" ||
        role === "assistant"
        ? [{ role, content }]
        : [];
    if (role === "user") return [{ role, content: toInputParts(content) }];
    if (role === "system" || role === "developer")
      return [{ role, content: toTextParts(content) }];
    if (role === "assistant")
      return [{ role, content: toAssistantParts(content) }];
    return [];
  }
  if (!("type" in item)) return [];
  switch (item.type) {
    case "function_call":
      return [
        {
          type: item.type,
          call_id: item.call_id,
          name: item.name,
          arguments: item.arguments,
        },
      ];
    case "custom_tool_call":
      return [
        {
          type: item.type,
          call_id: item.call_id,
          name: item.name,
          input: item.input,
        },
      ];
    case "function_call_output":
    case "custom_tool_call_output":
      return [
        {
          type: item.type,
          call_id: item.call_id ?? "",
          output:
            typeof item.output === "string"
              ? item.output
              : toInputParts(item.output),
        },
      ];
    default:
      return [];
  }
}

/** Converts LangChain messages to Decisions input items. */
function toDecisionItems(messages: BaseMessage[]): DecisionItem[] {
  return convertMessagesToResponsesInput({
    messages,
    zdrEnabled: true,
    model: "",
  }).flatMap(toDecisionItem);
}

/** Replaces messages nested in JSON state with their Decisions input items. */
function toJSONValue(value: unknown): unknown {
  if (BaseMessage.isInstance(value)) return toDecisionItems([value]);
  if (Array.isArray(value))
    return value.flatMap((item) =>
      BaseMessage.isInstance(item)
        ? toDecisionItems([item])
        : [toJSONValue(item)]
    );
  if (typeof value === "object" && value?.constructor === Object)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJSONValue(item)])
    );
  return value;
}

/**
 * Converts input to the Decisions API `input` field: strings as they are, messages
 * as a native conversation, and anything else as an `input_json` part.
 */
export function toDecisionInput(
  input: DecisionInput
): OpenAIClient.DecisionCreateParams["input"] {
  if (typeof input === "string") return input;
  const values = Array.isArray(input) ? input : [input];
  if (
    values.length > 0 &&
    values.every((value) => BaseMessage.isInstance(value))
  )
    return toDecisionItems(values);
  return [
    {
      role: "user",
      content: [
        {
          type: "input_json",
          data: toJSONValue(input) as OpenAIClient.DecisionInputJSON["data"],
        },
      ],
    },
  ];
}
