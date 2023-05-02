import { PromptTemplate } from "../prompts/prompt.js";

const _DEFAULT_SUMMARIZER_TEMPLATE = `Progressively summarize the lines of conversation provided, adding onto the previous summary returning a new summary.

EXAMPLE
Current summary:
The human asks what the AI thinks of artificial intelligence. The AI thinks artificial intelligence is a force for good.

New lines of conversation:
Human: Why do you think artificial intelligence is a force for good?
AI: Because artificial intelligence will help humans reach their full potential.

New summary:
The human asks what the AI thinks of artificial intelligence. The AI thinks artificial intelligence is a force for good because it will help humans reach their full potential.
END OF EXAMPLE

Current summary:
{summary}

New lines of conversation:
{new_lines}

New summary:`;

// eslint-disable-next-line spaced-comment
export const SUMMARY_PROMPT = /*#__PURE__*/ new PromptTemplate({
  inputVariables: ["summary", "new_lines"],
  template: _DEFAULT_SUMMARIZER_TEMPLATE,
});
