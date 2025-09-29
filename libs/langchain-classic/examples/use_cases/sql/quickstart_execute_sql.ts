import { ChatOpenAI } from "@langchain/openai";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { QuerySqlTool } from "langchain/tools/sql";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
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
