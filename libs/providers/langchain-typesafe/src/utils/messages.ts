import {
  AIMessage,
  ChatMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

/**
 * The role label a message is rendered under. `__openai_role__` is
 * `langchain-core`'s key for overriding a system message's label; core sets
 * it to OpenAI's `"developer"` role, so the name is OpenAI-flavoured even
 * though the key is core's.
 *
 * The label is inert at the model — the same text scores the same under
 * `user:`, `human:`, a wrong label, a nonsense label, or none — so the
 * mapping is for parity and trace legibility, not correctness.
 *
 * The exhaustiveness raise is what matters. `MessageType` is open
 * (`| (string & NonNullable<unknown>)`), so an unrecognised type is
 * reachable, and returning a default would silently drop that message's
 * content. Dropping content changes answers materially in either
 * direction: a frustration question falls from 0.94 to near zero, and a
 * benign tool call whose authorizing user message is lost rises from 0.03
 * to 0.51 — across a 0.2 block threshold. Failing loudly beats degrading
 * quietly.
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
    case "system": {
      const explicit = message.additional_kwargs?.__openai_role__;
      if (explicit === undefined) {
        return "system";
      }
      if (typeof explicit !== "string") {
        throw new TypeError(
          `Expected "__openai_role__" to be a string, got ${typeof explicit}.`
        );
      }
      return explicit;
    }
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
 * Renders content as text. All-text block lists join with a newline,
 * matching the Python package; any other block is serialized rather than
 * dropped, since an unrecognized block is still context.
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
  // render as a bare `assistant: `. Only the OpenAI-compatible providers
  // populate it (openai, azure, xai, openrouter, ibm), so the guard is
  // defensive rather than universal.
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
