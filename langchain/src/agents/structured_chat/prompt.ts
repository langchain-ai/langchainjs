export const PREFIX = `Answer the following questions truthfully and as best you can.`;
export const AGENT_ACTION_FORMAT_INSTRUCTIONS = `Output a JSON markdown code snippet containing a valid JSON blob (denoted below by $JSON_BLOB).
This $JSON_BLOB must have a "action" key (with the name of the tool to use) and an "action_input" key (tool input).

Valid "action" values: "Final Answer" (which you must use when giving your final response to the user), or one of {tool_names}.

The $JSON_BLOB must be valid, parseable JSON and only contain a SINGLE action. Here is an example of an acceptable output:

\`\`\`json
{{
  "action": $TOOL_NAME
  "action_input": $INPUT
}}
\`\`\`

Remember to include the surrounding markdown code snippet delimiters (begin with "\`\`\`" json and close with "\`\`\`")!
`;
export const FORMAT_INSTRUCTIONS = `You have access to the following tools:

{tool_strings}

The way you use the tools is as follows:

------------------------

${AGENT_ACTION_FORMAT_INSTRUCTIONS}

If you are using a tool, "action_input" must adhere to the tool's input schema, given above.

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
