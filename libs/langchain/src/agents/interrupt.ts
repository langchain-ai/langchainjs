export { interrupt } from "@langchain/langgraph";

/**
 * Configuration interface that defines what actions are allowed for a human interrupt.
 * This controls the available interaction options when the graph is paused for human input.
 */
export interface HumanInterruptConfig {
  /**
   * Whether the human can choose to ignore/skip the current step
   */
  allow_ignore: boolean;
  /**
   * Whether the human can provide a text response/feedback
   */
  allow_respond: boolean;
  /**
   * Whether the human can edit the provided content/state
   */
  allow_edit: boolean;
  /**
   * Whether the human can accept/approve the current state
   */
  allow_accept: boolean;
}

/**
 * Represents a request for human action within the graph execution.
 * Contains the action type and any associated arguments needed for the action.
 */
export interface ActionRequest {
  /**
   * The type or name of action being requested (e.g., "Approve XYZ action")
   */
  action: string;
  /**
   * Key-value pairs of arguments needed for the action
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}

/**
 * Represents an interrupt triggered by the graph that requires human intervention.
 * This is passed to the `interrupt` function when execution is paused for human input.
 */
export interface HumanInterrupt {
  /**
   * The specific action being requested from the human
   */
  action_request: ActionRequest;
  /**
   * Configuration defining what actions are allowed
   */
  config: HumanInterruptConfig;
  /**
   * Optional detailed description of what input is needed
   */
  description?: string;
}

/**
 * The response provided by a human to an interrupt, which is returned when graph execution resumes.
 */
export type HumanResponse = {
  /**
   * The type of response:
   * - "accept": Approves the current state without changes
   * - "ignore": Skips/ignores the current step
   * - "response": Provides text feedback or instructions
   * - "edit": Modifies the current state/content
   */
  type: "accept" | "ignore" | "response" | "edit";
  /**
   * The response payload:
   * - null: For ignore/accept actions
   * - string: For text responses
   * - ActionRequest: For edit actions with updated content
   */
  args: null | string | ActionRequest;
};
