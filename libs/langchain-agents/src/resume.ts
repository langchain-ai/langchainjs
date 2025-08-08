import { Command, interrupt } from "@langchain/langgraph";

/**
 * Resume execution with the given value.
 *
 * This is a wrapper around the {@link Command} class that allows for resume execution with a given value.
 *
 * @example
 * ```typescript
 * const command = resume("it's ok!");
 * const result = await agent.invoke(command);
 * ```
 *
 * @param reason - Value to resume execution with. To be used together with {@link interrupt}.
 * @returns A command to resume execution with the given value.
 */
export function resume(reason: string) {
  return new Command({
    resume: reason,
  });
}
