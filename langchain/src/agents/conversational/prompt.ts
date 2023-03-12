export const PREFIX = `Answer the following questions as best you can. You have access to the following tools:`;

export const formatInstructions = (
  toolNames: string,
  aiPrefix: string,
  _humanPrefix: string
) => `Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [${toolNames}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
(Finally, When you have a response to say to the Human, or if you do not need to use a tool, you MUST use the format:)
Thought: Do I need to use a tool? No
${aiPrefix}: the final answer to the original input question`;

export const SUFFIX = `Begin!

Previous conversation history:
{chat_history}

Question: {input}
Thought:{agent_scratchpad}`;
