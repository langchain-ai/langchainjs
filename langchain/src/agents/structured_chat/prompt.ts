export const PREFIX = `Answer the following questions truthfully and as best you can. You have access to the following tools:`;
export const AGENT_ACTION_FORMAT_INSTRUCTIONS = `Output a JSON markdown code snippet containing a JSON blob (denoted below by $JSON_BLOB).
This $JSON_BLOB must have a "action" key (with the name of the tool to use) and an "action_input" key (tool input).

Valid "action" values: "Final Answer" (which you must use when giving your final response to the user), or an available tool.
If you are using a tool, "action_input" must adhere to the tool's input schema, given above.

The $JSON_BLOB must only contain a SINGLE action. Do NOT return a list of multiple actions. Here is an example of an acceptable output:

\`\`\`json
{{
  "action": $TOOL_NAME
  "action_input": $INPUT
}}
\`\`\`
`;
export const FORMAT_INSTRUCTIONS = `The way you use the tools is as follows:

------------------------

${AGENT_ACTION_FORMAT_INSTRUCTIONS}

------------------------

ALWAYS use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action:
\`\`\`json
$JSON_BLOB
\`\`\`
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Action:
\`\`\`json
{{
  "action": "Final Answer",
  "action_input": "Final response to human"
}}
\`\`\``;
export const SUFFIX = `Begin! Reminder to ALWAYS use the above format, and to use tools if appropriate.`;
