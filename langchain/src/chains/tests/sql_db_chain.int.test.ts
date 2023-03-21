import { test } from "@jest/globals";
import { DataSource } from "typeorm";
import { OpenAI } from "../../llms/openai.js";
import { SqlDatabaseChain } from "../sql_db/sql_db_chain.js";
import { SqlDatabase } from "../../sql_db.js";

test("Test SqlDatabaseChain", async () => {
  const datasource = new DataSource({
    type: "sqlite",
    database: ":memory:",
    synchronize: true,
  });

  await datasource.initialize();
  await datasource.query(`
        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Alice', 20);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Bob', 21);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Charlie', 22);
    `);

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  const chain = new SqlDatabaseChain({
    llm: new OpenAI({ temperature: 0 }),
    database: db,
  });

  const res = await chain.run("How many users are there?");
  console.log(res);

  await datasource.destroy();
});
