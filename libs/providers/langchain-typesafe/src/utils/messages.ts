import {
  AIMessage,
  ChatMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

/**
 * The role label a message is rendered under.
 *
 * The label is inert at the model, so this is for trace legibility only.
 * `__openai_role__` is deliberately not honoured: it exists so OpenAI's
 * `developer` role survives a round trip through `SystemMessage`, and
 * nothing else in this repo reads it.
 *
 * The raise matters. `MessageType` is open, so an unrecognised type is
 * reachable, and defaulting would silently drop that message's content.
 */
function roleFor(message: BaseMessage): string {
  switch (message.getType()) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "tool":
      return "tool";
    case "function":
      return "function";
    case "generic":
      if (!ChatMessage.isInstance(message)) {
        break;
      }
      return message.role;
    case "system":
      return "system";
    default:
      break;
  }
  throw new Error(
    `Unsupported message type for TypeSafe state: "${message.getType()}".`
  );
}

/** Names no value: tool-call arguments are caller data, like `state`. */
const ARGS_ERROR = "TypeSafe tool-call arguments could not be serialized.";

/**
 * Serializes a value, turning any failure into a content-free error.
 *
 * The caught error is discarded, never chained: `JSON.stringify`'s own
 * circular-structure message names the offending property (V8: `property
 * 'ssn' closes the circle`), and that name is caller data.
 */
function renderJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "{}";
  } catch {
    throw new TypeError(ARGS_ERROR);
  }
}

/** True for a `{ type: "text", text }` content block. */
function isTextBlock(block: unknown): block is { text?: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "text"
  );
}

/**
 * Renders content as text. All-text block lists join with a newline. Any other
 * block is serialized rather than dropped, since an unrecognized block is still
 * context.
 */
function renderContent(content: BaseMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return renderJson(content);
  }
  return content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      return isTextBlock(block) ? (block.text ?? "") : renderJson(block);
    })
    .join("\n");
}

/**
 * Renders a message as one line of labelled transcript, e.g.
 * `assistant: [called issue_refund#c1 with {"amount":250}]`.
 *
 * Measured live: this flat form classifies identically to the full
 * OpenAI message envelope, so the envelope was dropped. The tool name
 * and its arguments are what carry the answer — omitting the arguments
 * produces a confidently WRONG result, not an error — and a call's id is
 * what links a result back to it, since order does not.
 */
export function renderMessage(message: BaseMessage): string {
  // First, so an unsupported type raises before any content is touched.
  const role = roleFor(message);
  const parts: string[] = [];

  const content = renderContent(message.content);
  if (content.length > 0) {
    parts.push(content);
  }

  // A refusal lives outside content, so a refusal-only turn would otherwise
  // render as a bare `assistant: `. Only the OpenAI-family providers set it.
  const refusal = message.additional_kwargs?.refusal;
  if (typeof refusal === "string" && refusal.length > 0) {
    parts.push(`[refused: ${refusal}]`);
  }

  if (AIMessage.isInstance(message)) {
    for (const call of message.tool_calls ?? []) {
      const id = call.id ? `#${call.id}` : "";
      parts.push(`[called ${call.name}${id} with ${renderJson(call.args)}]`);
    }
  }

  const correlation = ToolMessage.isInstance(message)
    ? `#${message.tool_call_id}`
    : "";
  const name = message.name ? ` (${message.name})` : "";
  return `${role}${correlation}${name}: ${parts.join(" ")}`;
}
