# SQLDatabaseChain

The `SqlDatabaseChain` allows you to answer questions over a SQL database.
This example uses Chinook database, which is a sample database available for SQL Server, Oracle, MySQL, etc.

## Set up

First install `typeorm`:

```bash npm2yarn
npm install typeorm
```

Then install the dependencies needed for your database. For example, for SQLite:

```bash npm2yarn
npm install sqlite3
```

For other databases see https://typeorm.io/#installation

Finally follow the instructions on https://database.guide/2-sample-databases-sqlite/ to get the sample database for this example.

```typescript
import { DataSource } from "typeorm";
import { OpenAI } from "langchain/llms";
import { SqlDatabase } from "langchain/sql_db";
import { SqlDatabaseChain } from "langchain/chains";

export const run = async () => {
  const datasource = new DataSource({
    type: "sqlite",
    database: "Chinook.db",
  });

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  const chain = new SqlDatabaseChain({
    llm: new OpenAI({ temperature: 0 }),
    database: db,
  });

  const res = await chain.run("How many tracks are there?");
  console.log(res);

  await datasource.destroy();
};
```
