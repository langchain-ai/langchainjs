/**
 * Text passed to tiktoken when estimating tokens for `function_call.arguments`.
 * OpenAI's counting treats arguments like compact JSON; we avoid parse/stringify
 * when the payload is already compact (no insignificant whitespace).
 */
export function toolArgumentsTextForTokenCount(argumentsJson: string): {
  text: string;
  parseFailed: boolean;
} {
  if (!/\s/.test(argumentsJson)) {
    return { text: argumentsJson, parseFailed: false };
  }
  try {
    return {
      text: JSON.stringify(JSON.parse(argumentsJson)),
      parseFailed: false,
    };
  } catch {
    return { text: argumentsJson, parseFailed: true };
  }
}