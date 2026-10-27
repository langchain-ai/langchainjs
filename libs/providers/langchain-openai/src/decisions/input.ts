import type { OpenAI as OpenAIClient } from "openai";
import { BaseMessage } from "@langchain/core/messages";
import { convertMessagesToResponsesInput } from "../converters/responses.js";
import type { DecisionInput } from "./types.js";

type DecisionInputItem = Exclude<
  OpenAIClient.DecisionCreateParams["input"],
  string
>[number];
type AssistantPart = Exclude<
  OpenAIClient.DecisionInputMessage.DecisionInputAssistantMessage["content"],
  string
>[number];
type InputPart =
  | OpenAIClient.DecisionInputText
  | OpenAIClient.DecisionInputImage;
type Part = {
  type: string;
  text?: unknown;
  image_url?: unknown;
  refusal?: unknown;
};

function toInputParts(content: unknown): InputPart[] {
  return (content as Part[]).map((part) =>
    part.type === "input_text" && typeof part.text === "string"
      ? { type: "input_text", text: part.text }
      : part.type === "input_image" && typeof part.image_url === "string"
        ? { type: "input_image", image_url: part.image_url }
        : { type: "input_text", text: `[${part.type} omitted]` }
  );
}

/** Narrows a Responses input item to the fields the Decisions API accepts. */
function toDecisionItem(
  item: ReturnType<typeof convertMessagesToResponsesInput>[number]
): DecisionInputItem[] {
  if (!("type" in item) || item.type === "message") {
    if (!("role" in item)) return [];
    const { role, content } = item;
    if (role === "user")
      return [
        {
          role,
          content:
            typeof content === "string" ? content : toInputParts(content),
        },
      ];
    if (role === "system" || role === "developer")
      return [
        {
          role,
          content:
            typeof content === "string"
              ? content
              : toInputParts(content).map((part) =>
                  part.type === "input_text"
                    ? part
                    : { type: "input_text", text: "[image omitted]" }
                ),
        },
      ];
    if (role === "assistant")
      return [
        {
          role,
          content:
            typeof content === "string"
              ? content
              : (content as Part[]).flatMap((part): AssistantPart[] =>
                  part.type === "output_text" && typeof part.text === "string"
                    ? [{ type: "output_text", text: part.text }]
                    : part.type === "refusal" &&
                        typeof part.refusal === "string"
                      ? [{ type: "refusal", refusal: part.refusal }]
                      : []
                ),
        },
      ];
    return [];
  }
  if (item.type === "function_call" || item.type === "custom_tool_call") {
    const { type, call_id, name } = item;
    return type === "function_call"
      ? [{ type, call_id, name, arguments: item.arguments }]
      : [{ type, call_id, name, input: item.input }];
  }
  if (
    item.type === "function_call_output" ||
    item.type === "custom_tool_call_output"
  ) {
    const { type, call_id, output } = item;
    return [
      {
        type,
        call_id: call_id ?? "",
        output: typeof output === "string" ? output : toInputParts(output),
      },
    ];
  }
  return [];
}

function toDecisionItems(messages: BaseMessage[]): DecisionInputItem[] {
  return convertMessagesToResponsesInput({
    messages,
    zdrEnabled: true,
    model: "",
  }).flatMap(toDecisionItem);
}

/** Replaces messages nested in JSON with their Decisions input items. */
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
 * Converts input to the Decisions API `input` field.
 *
 * Messages become a native conversation, with tool calls and results as function
 * call items. Content the API does not accept, such as files, is replaced by a
 * placeholder. JSON objects are sent as an `input_json` part in a user message,
 * with any nested messages converted the same way.
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
