import type { BaseMessage } from "@langchain/core/messages";

/**
 * Maps a LangChain message type to the role prefix the TypeSafe API
 * receives. TypeSafe has no concept of an LLM message, so a message is
 * rendered as one labelled line of transcript.
 *
 * The `__openai_role__` key is not an OpenAI dependency — it is the
 * convention `langchain-core` itself defines for overriding a system
 * message's label, and the Python package honours it through
 * `_get_message_openai_role`. Mirrored here for that reason, not because
 * TypeSafe knows anything about OpenAI: only a `SystemMessage` consults
 * it (raising a `TypeError` if present but not a string), a `ChatMessage`
 * reports its own `role`, and any other type raises rather than silently
 * defaulting. The raise is deliberate — a silently mislabelled message
 * produces a confident wrong classification, not a visible error.
 *
 * The labels earn their place, though weakly. Measured live on a question
 * answerable only from who said what: correct prefixes and no prefixes at
 * all both answered correctly at confidence 1.0, while prefixes swapped to
 * the wrong speakers still answered correctly but dropped to 0.88. So the
 * model reads them, and mostly recovers from content when they are absent.
 */
function roleFor(message: BaseMessage): string {
  switch (message.getType()) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "tool":
      return "tool";
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
    case "function":
      return "function";
    case "generic":
      // `generic` is ChatMessage, which carries its own `role`; the
      // BaseMessage type has no such field, hence the double assertion.
      return (message as unknown as { role: string }).role;
    default:
      throw new Error(
        `Unsupported message type for TypeSafe state: "${message.getType()}".`
      );
  }
}

/**
 * Names no value and no content: tool-call arguments are classifier
 * input, potentially sensitive, exactly like `state` itself.
 */
const UNSERIALIZABLE_ARGS_ERROR =
  "TypeSafe tool-call arguments could not be serialized " +
  "(circular reference or unsupported value).";

/**
 * Serializes tool-call arguments, converting any failure into a
 * content-free error.
 *
 * The caught error is discarded outright — never rethrown, never chained
 * as `cause`. `JSON.stringify`'s own circular-structure `TypeError`
 * embeds the offending property's NAME (V8: `property 'ssn' -> object
 * with constructor 'Object'`), and tool-call arguments are caller data,
 * so that name is caller data too.
 */
function renderArgs(args: unknown): string {
  try {
    return JSON.stringify(args) ?? "{}";
  } catch {
    throw new TypeError(UNSERIALIZABLE_ARGS_ERROR);
  }
}

/**
 * Renders message content as text.
 *
 * A string stays as-is. A list of blocks that are all text is joined with
 * a newline, matching the Python package. Any other block is serialized
 * rather than dropped — an unrecognized block is still context.
 */
function renderContent(content: BaseMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return renderArgs(content);
  }
  return content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text"
      ) {
        return (block as { text?: string }).text ?? "";
      }
      return renderArgs(block);
    })
    .join("\n");
}

interface ToolCallLike {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

/**
 * Renders a `BaseMessage` as a single line of labelled transcript, e.g.
 * `assistant: [called issue_refund with {"amount":250}]`.
 *
 * Measured against the live API (jev-1.13.0, 2026-09-17, two independent
 * runs of three rounds): this flat form and the full OpenAI message
 * envelope classify identically (0.97-0.98 on a question answerable only
 * from a tool-call argument), so the envelope bought nothing. What IS
 * load-bearing is the tool name and its arguments — dropping the
 * arguments moved the same question to 0.13-0.35 against a ground truth
 * of yes. That is a confidently WRONG answer rather than an error, which
 * is why `renderArgs` must never silently omit them.
 */
export function renderMessage(message: BaseMessage): string {
  // Resolved first so an unsupported message type raises before any
  // caller-supplied content is touched.
  const role = roleFor(message);
  const parts: string[] = [];

  const content = renderContent(message.content);
  if (content.length > 0) {
    parts.push(content);
  }

  // A refusal lives in additional_kwargs, not content, so an assistant
  // message that only refuses has empty content. Dropping it renders
  // `assistant: ` and destroys the one thing worth classifying about that
  // turn.
  const refusal = message.additional_kwargs?.refusal;
  if (typeof refusal === "string" && refusal.length > 0) {
    parts.push(`[refused: ${refusal}]`);
  }

  const toolCalls = (message as { tool_calls?: ToolCallLike[] }).tool_calls;
  if (Array.isArray(toolCalls)) {
    for (const call of toolCalls) {
      // The id is what links a result back to its call. Order does not:
      // two calls to the same tool are distinguished only by id, so
      // dropping it makes two different conversations render identically.
      const id = call.id ? `#${call.id}` : "";
      parts.push(
        `[called ${call.name}${id} with ${renderArgs(call.args ?? {})}]`
      );
    }
  }

  const toolCallId = (message as { tool_call_id?: string }).tool_call_id;
  const correlation = toolCallId ? `#${toolCallId}` : "";
  const name = message.name ? ` (${message.name})` : "";
  return `${role}${correlation}${name}: ${parts.join(" ")}`;
}
