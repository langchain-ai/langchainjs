export class MultipleToolsBoundError extends Error {
  constructor() {
    super(
      "The provided LLM already has bound tools. " +
        "Please provide an LLM without bound tools to createReactAgent. " +
        "The agent will bind the tools provided in the 'tools' parameter."
    );
  }
}
