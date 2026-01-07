import type { InteropZodObject } from "@langchain/core/utils/types";
import type { RunnableCallable } from "./RunnableCallable.js";
import type { AgentMiddleware } from "./middleware/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentNode = RunnableCallable<any, any>;

/**
 * The StateManager is responsible for managing the state of the agent.
 * The `createAgent` maintains different nodes with their own state. For the user
 * however, they only see the combined state of all nodes. This class is helps
 * to share the state between different nodes.
 *
 * @internal
 */
export class StateManager {
  #nodes = new Map<string, AgentNode[]>();

  /**
   * Add node to middleware group.
   * @param name - The name of the middleware group.
   * @param node - The node to add.
   */
  addNode(
    middleware: AgentMiddleware<InteropZodObject | undefined>,
    node: AgentNode
  ) {
    this.#nodes.set(middleware.name, [
      ...(this.#nodes.get(middleware.name) ?? []),
      node,
    ]);
  }

  /**
   * Get the state of a middleware group.
   * @param name - The name of the middleware group.
   * @returns The state of the middleware group.
   */
  getState(name: string) {
    const middlewareNodes = this.#nodes.get(name) ?? [];
    const state = middlewareNodes.reduce(
      (prev, node) => {
        return {
          ...prev,
          ...((node.getState() as Record<string, unknown>) ?? {}),
        };
      },
      {} as Record<string, unknown>
    );

    /**
     * we internally reset the jumpTo property and shouldn't propagate this value
     * to the middleware hooks.
     */
    delete state.jumpTo;

    return state;
  }
}
