import { ChatOpenAI } from "@langchain/openai";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const chain = await createSqlQueryChain({
  llm,
  db,
  dialect: "sqlite",
});

const response = await chain.invoke({
  question: "How many employees are there?",
});
console.log("response", response);
/**
response SELECT COUNT(*) FROM "Employee"
 */
console.log("db run result", await db.run(response));
/**
db run result [{"COUNT(*)":8}]
 */
