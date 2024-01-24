import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";
import {
  ChatPromptTemplate,
  FewShotPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { SqlToolkit, createSqlAgent } from "langchain/agents/toolkits/sql";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
console.log(db.allTables.map((t) => t.tableName));
/**
[
  'Album',       'Artist',
  'Customer',    'Employee',
  'Genre',       'Invoice',
  'InvoiceLine', 'MediaType',
  'Playlist',    'PlaylistTrack',
  'Track'
]
 */
console.log(await db.run("SELECT * FROM Artist LIMIT 10;"));
/**
[{"ArtistId":1,"Name":"AC/DC"},{"ArtistId":2,"Name":"Accept"},{"ArtistId":3,"Name":"Aerosmith"},{"ArtistId":4,"Name":"Alanis Morissette"},{"ArtistId":5,"Name":"Alice In Chains"},{"ArtistId":6,"Name":"Antônio Carlos Jobim"},{"ArtistId":7,"Name":"Apocalyptica"},{"ArtistId":8,"Name":"Audioslave"},{"ArtistId":9,"Name":"BackBeat"},{"ArtistId":10,"Name":"Billy Cobham"}]
 */

// ## Agent
// We’ll use an OpenAI chat model and an "openai-tools" agent, which will use OpenAI’s function-calling API to drive the agent’s tool selection and invocations.
const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
const agentExecutor = createSqlAgent(llm, new SqlToolkit(db, llm));

// console.log(
//   await agentExecutor.invoke({
//     input: "List the total sales per country. Which country's customers spent the most?"
//   })
// );
/**
{
  output: 'The country whose customers spent the most is USA.',
  intermediateSteps: [
    {
      action: [Object],
      observation: 'Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track'
    },
    {
      action: [Object],
      observation: '[{"Country":"USA","TotalSales":523.0600000000003}]'
    },
    {
      action: [Object],
      observation: '[{"Country":"USA","TotalSales":523.0600000000003}]'
    }
  ]
}
 */
// LangSmith trace: https://smith.langchain.com/public/bfff9152-5de9-4cca-ab05-205a66855cfb/r

// console.log(
//   await agentExecutor.invoke({
//     input: "Describe the playlisttrack table",
//   })
// );
/**
{
  output: 'The PlaylistTrack table has two columns: PlaylistId and TrackId.',
  intermediateSteps: [
    {
      action: [Object],
      observation: 'Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track'
    },
    {
      action: [Object],
      observation: 'CREATE TABLE PlaylistTrack (\n' +
        'PlaylistId INTEGER NOT NULL, TrackId INTEGER NOT NULL) \n' +
        'SELECT * FROM "PlaylistTrack" LIMIT 3;\n' +
        ' PlaylistId TrackId\n' +
        ' 1 3402\n' +
        ' 1 3389\n' +
        ' 1 3390\n'
    }
  ]
}
 */
// LangSmith trace: https://smith.langchain.com/public/be407687-67ad-4e1d-ac85-b083960a287c/r

// ## Using a dynamic few-shot prompt

// To optimize agent performance, we can provide a custom prompt with domain-specific knowledge.
// In this case we’ll create a few shot prompt with an example selector, that will dynamically build the few shot prompt based on the user input.

// First we need some user input \<> SQL query examples:
const examples = [
  { input: "List all artists.", query: "SELECT * FROM Artist;" },
  {
    input: "Find all albums for the artist 'AC/DC'.",
    query:
      "SELECT * FROM Album WHERE ArtistId = (SELECT ArtistId FROM Artist WHERE Name = 'AC/DC');",
  },
  {
    input: "List all tracks in the 'Rock' genre.",
    query:
      "SELECT * FROM Track WHERE GenreId = (SELECT GenreId FROM Genre WHERE Name = 'Rock');",
  },
  {
    input: "Find the total duration of all tracks.",
    query: "SELECT SUM(Milliseconds) FROM Track;",
  },
  {
    input: "List all customers from Canada.",
    query: "SELECT * FROM Customer WHERE Country = 'Canada';",
  },
  {
    input: "How many tracks are there in the album with ID 5?",
    query: "SELECT COUNT(*) FROM Track WHERE AlbumId = 5;",
  },
  {
    input: "Find the total number of invoices.",
    query: "SELECT COUNT(*) FROM Invoice;",
  },
  {
    input: "List all tracks that are longer than 5 minutes.",
    query: "SELECT * FROM Track WHERE Milliseconds > 300000;",
  },
  {
    input: "Who are the top 5 customers by total purchase?",
    query:
      "SELECT CustomerId, SUM(Total) AS TotalPurchase FROM Invoice GROUP BY CustomerId ORDER BY TotalPurchase DESC LIMIT 5;",
  },
  {
    input: "Which albums are from the year 2000?",
    query: "SELECT * FROM Album WHERE strftime('%Y', ReleaseDate) = '2000';",
  },
  {
    input: "How many employees are there",
    query: 'SELECT COUNT(*) FROM "Employee"',
  },
];

// Now we can create an example selector. This will take the actual user input and select some number of examples to add to our few-shot prompt.
// We’ll use a SemanticSimilarityExampleSelector, which will perform a semantic search using the embeddings and vector store we configure to find the examples most similar to our input:

const exampleSelector = await SemanticSimilarityExampleSelector.fromExamples(
  examples,
  new OpenAIEmbeddings(),
  HNSWLib,
  {
    k: 5,
    inputKeys: ["input"],
  }
);
// Now we can create our FewShotPromptTemplate, which takes our example selector, an example prompt for formatting each example, and a string prefix and suffix to put before and after our formatted examples:
const SYSTEM_PREFIX = `You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct {dialect} query to run, then look at the results of the query and return the answer.
Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most {top_k} results.
You can order the results by a relevant column to return the most interesting examples in the database.
Never query for all the columns from a specific table, only ask for the relevant columns given the question.
You have access to tools for interacting with the database.
Only use the given tools. Only use the information returned by the tools to construct your final answer.
You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.

If the question does not seem related to the database, just return "I don't know" as the answer.

Here are some examples of user inputs and their corresponding SQL queries:`;

const fewShotPrompt = new FewShotPromptTemplate({
  exampleSelector,
  examplePrompt: PromptTemplate.fromTemplate(
    "User input: {input}\nSQL query: {query}"
  ),
  inputVariables: ["input", "dialect", "top_k"],
  prefix: SYSTEM_PREFIX,
  suffix: "",
});

// Since our underlying agent is an [OpenAI tools agent](https://js.langchain.com/docs/modules/agents/agent_types/openai_tools_agent), which uses OpenAI function calling, our full prompt should be a chat prompt with a human message template and an agentScratchpad MessagesPlaceholder. The few-shot prompt will be used for our system message:

const fullPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessagePromptTemplate(fewShotPrompt),
  ["human", "{input}"],
  new MessagesPlaceholder("agentScratchpad"),
]);

const promptValue = await fullPrompt.invoke({
  input: "How many artists are there?",
  top_k: 5,
  dialect: "SQLite",
  agentScratchpad: [],
});
console.log(promptValue);
/**
ChatPromptValue {
  lc_serializable: true,
  lc_kwargs: { messages: [ [SystemMessage], [HumanMessage] ] },
  lc_namespace: [ 'langchain_core', 'prompt_values' ],
  messages: [
    SystemMessage {
      lc_serializable: true,
      lc_kwargs: [Object],
      lc_namespace: [Array],
      content: 'You are an agent designed to interact with a SQL database.\n' +
        'Given an input question, create a syntactically correct SQLite query to run, then look at the results of the query and return the answer.\n' +
        'Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most 5 results.\n' +
        'You can order the results by a relevant column to return the most interesting examples in the database.\n' +
        'Never query for all the columns from a specific table, only ask for the relevant columns given the question.\n' +
        'You have access to tools for interacting with the database.\n' +
        'Only use the given tools. Only use the information returned by the tools to construct your final answer.\n' +
        'You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.\n' +
        '\n' +
        'DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.\n' +
        '\n' +
        `If the question does not seem related to the database, just return "I don't know" as the answer.\n` +
        '\n' +
        'Here are some examples of user inputs and their corresponding SQL queries:\n' +
        '\n' +
        'User input: List all artists.\n' +
        'SQL query: SELECT * FROM Artist;\n' +
        '\n' +
        'User input: How many employees are there\n' +
        'SQL query: SELECT COUNT(*) FROM "Employee"\n' +
        '\n' +
        'User input: How many tracks are there in the album with ID 5?\n' +
        'SQL query: SELECT COUNT(*) FROM Track WHERE AlbumId = 5;\n' +
        '\n' +
        'User input: Which albums are from the year 2000?\n' +
        "SQL query: SELECT * FROM Album WHERE strftime('%Y', ReleaseDate) = '2000';\n" +
        '\n' +
        "User input: List all tracks in the 'Rock' genre.\n" +
        "SQL query: SELECT * FROM Track WHERE GenreId = (SELECT GenreId FROM Genre WHERE Name = 'Rock');\n" +
        '\n',
      name: undefined,
      additional_kwargs: {}
    },
    HumanMessage {
      lc_serializable: true,
      lc_kwargs: [Object],
      lc_namespace: [Array],
      content: 'How many artists are there?',
      name: undefined,
      additional_kwargs: {}
    }
  ]
}
 */

// @TODO need to add more args like in PY to `createSqlAgent`!!
const agent = createSqlAgent(llm, new SqlToolkit(db, llm), {
  prompt: fewShotPrompt,
});