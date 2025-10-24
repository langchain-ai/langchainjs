import { PromptTemplate } from "@langchain/core/prompts";

export const SONG_DATA_SOURCE = `\
\`\`\`json
{
    "content": "Lyrics of a song",
    "attributes": {
        "artist": {
            "type": "string",
            "description": "Name of the song artist"
        },
        "length": {
            "type": "integer",
            "description": "Length of the song in seconds"
        },
        "genre": {
            "type": "string",
            "description": "The song genre, one of 'pop', 'rock' or 'rap'"
        }
    }
}
\`\`\`\
`
  .replaceAll("{", "{{")
  .replaceAll("}", "}}");

export const FULL_ANSWER = `\
\`\`\`json
{{
    "query": "teenager love",
    "filter": "and(or(eq(\\"artist\\", \\"Taylor Swift\\"), eq(\\"artist\\", \\"Katy Perry\\")), \
lt(\\"length\\", 180), eq(\\"genre\\", \\"pop\\"))"
}}`;

export const NO_FILTER_ANSWER = `\
\`\`\`json
{{
    "query": "",
    "filter": "NO_FILTER"
}}
\`\`\`\
`;

export const DEFAULT_EXAMPLES = [
  {
    i: "1",
    data_source: SONG_DATA_SOURCE,
    user_query:
      "What are songs by Taylor Swift or Katy Perry about teenage romance under 3 minutes long in the dance pop genre",
    structured_request: FULL_ANSWER,
  },
  {
    i: "2",
    data_source: SONG_DATA_SOURCE,
    user_query: "What are songs that were not published on Spotify",
    structured_request: NO_FILTER_ANSWER,
  },
];

export const EXAMPLE_PROMPT_TEMPLATE = `\
<< Example {i}. >>
Data Source:
{data_source}

User Query:
{user_query}

Structured Request:
{structured_request}
`;

export const EXAMPLE_PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["i", "data_source", "user_query", "structured_request"],
  template: EXAMPLE_PROMPT_TEMPLATE,
});

export const DEFAULT_SCHEMA = `\
<< Structured Request Schema >>
When responding use a markdown code snippet with a JSON object formatted in the \
following schema:

\`\`\`json
{{{{
    "query": string \\ text string to compare to document contents
    "filter": string \\ logical condition statement for filtering documents
}}}}
\`\`\`

The query string should contain only text that is expected to match the contents of \
documents. Any conditions in the filter should not be mentioned in the query as well.

A logical condition statement is composed of one or more comparison and logical \
operation statements.

A comparison statement takes the form: \`comp(attr, val)\`:
- \`comp\` ({allowed_comparators}): comparator
- \`attr\` (string):  name of attribute to apply the comparison to
- \`val\` (string): is the comparison value

A logical operation statement takes the form \`op(statement1, statement2, ...)\`:
- \`op\` ({allowed_operators}): logical operator
- \`statement1\`, \`statement2\`, ... (comparison statements or logical operation \
statements): one or more statements to apply the operation to

Make sure that you only use the comparators and logical operators listed above and \
no others.
Make sure that filters only refer to attributes that exist in the data source.
Make sure that filters only use the attributed names with its function names if there are functions applied on them.
Make sure that filters only use format \`YYYY-MM-DD\` when handling timestamp data typed values.
Make sure that filters take into account the descriptions of attributes and only make \
comparisons that are feasible given the type of data being stored.
Make sure that filters are only used as needed. If there are no filters that should be \
applied return "NO_FILTER" for the filter value.\
`;

export const DEFAULT_PREFIX = `\
Your goal is to structure the user's query to match the request schema provided below.

{schema}\
`;

export const DEFAULT_SUFFIX = `\
<< Example {i}. >>
Data Source:
\`\`\`json
{{{{
    "content": "{content}",
    "attributes": {attributes}
}}}}
\`\`\`

User Query:
{{query}}

Structured Request:
`;
