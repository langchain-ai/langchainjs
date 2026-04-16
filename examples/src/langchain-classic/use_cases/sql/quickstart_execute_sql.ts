import { ChatOpenAI } from "@langchain/openai";
import { createSqlQueryChain } from "@langchain/classic/chains/sql_db";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { QuerySqlTool } from "@langchain/classic/tools/sql";

const db = await SqlDatabase.fromOptionsParams({
  appDataSourceOptions: {
    type: "sqlite",
    database: "../../../../Chinook.db",
  },
});
const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });

const executeQuery = new QuerySqlTool(db);
const writeQuery = await createSqlQueryChain({
  llm,
  db,
  dialect: "sqlite",
});

const chain = writeQuery.pipe(executeQuery);
console.log(await chain.invoke({ question: "How many employees are there" }));
/**
[{"COUNT(*)":8}]
 */
