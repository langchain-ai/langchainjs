import { ChatOpenAI } from "@langchain/openai";
import {
  SqlToolkit,
  createSqlAgentRunnable,
} from "langchain/agents/toolkits/sql";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
const agentExecutor = await createSqlAgentRunnable({
  llm,
  toolkit: new SqlToolkit(db, llm),
  agentType: "openai-tools"
});

console.log(
  "\n\n",
  await agentExecutor.invoke({
    input:
      "List the total sales per country. Which country's customers spent the most?",
  }),
  "\n\n",
);
/**
 {
  input: "List the total sales per country. Which country's customers spent the most?",
  output: 'The total sales per country are as follows:\n' +
    '\n' +
    '1. USA: $523.06\n' +
    '2. Canada: $303.96\n' +
    '3. France: $195.10\n' +
    '4. Brazil: $190.10\n' +
    '5. Germany: $156.48\n' +
    '6. United Kingdom: $112.86\n' +
    '7. Czech Republic: $90.24\n' +
    '8. Portugal: $77.24\n' +
    '9. India: $75.26\n' +
    '10. Chile: $46.62\n' +
    '\n' +
    "To find out which country's customers spent the most, we can see that the USA has the highest total sales with $523.06.\n" +
    '\n' +
    'Answer: The country whose customers spent the most is the USA.'
}
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/886aeea4-7fcf-4ba8-94e1-1a98a8919ec9/r

// -------------

console.log(
  "\n\n",
  await agentExecutor.invoke({
    input: "Describe the playlisttrack table",
  }),
  "\n\n",
);
/**
 {
  input: 'Describe the playlisttrack table',
  output: 'The `PlaylistTrack` table has two columns: `PlaylistId` and `TrackId`. Both columns are of type INTEGER and are not nullable (NOT NULL).\n' +
    '\n' +
    'Here are three sample rows from the `PlaylistTrack` table:\n' +
    '\n' +
    '| PlaylistId | TrackId |\n' +
    '|------------|---------|\n' +
    '| 1          | 3402    |\n' +
    '| 1          | 3389    |\n' +
    '| 1          | 3390    |\n' +
    '\n' +
    "Please let me know if there's anything else I can help with!"
}
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/065a9cc5-8f11-4045-b141-e751b8034b61/r

// -------------
