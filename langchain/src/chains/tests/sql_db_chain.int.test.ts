import { expect, test } from "@jest/globals";
import { DataSource } from "typeorm";
import { OpenAI } from "../../llms/openai.js";
import { SqlDatabaseChain } from "../sql_db/sql_db_chain.js";
import { SqlDatabase } from "../../sql_db.js";
import { SQL_SQLITE_PROMPT } from "../sql_db/sql_db_prompt.js";

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

  expect(chain.prompt).toBe(SQL_SQLITE_PROMPT);

  const run = await chain.run("How many users are there?");
  console.log(run);

  await datasource.destroy();
});

test("Test SqlDatabaseChain with sqlOutputKey", async () => {
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
    inputKey: "query",
    sqlOutputKey: "sql",
  });

  expect(chain.prompt).toBe(SQL_SQLITE_PROMPT);

  const run = await chain.call({ query: "How many users are there?" });
  console.log(run);

  expect(run).toHaveProperty("sql");
  await datasource.destroy();
});

// We create this string to reach the token limit of the query built to describe the database and get the SQL query.
const veryLongString = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam orci nisi, vulputate ac pulvinar eu, maximus a tortor. Duis suscipit, nibh vel fermentum vehicula, mauris ante convallis metus, et feugiat turpis mauris non felis. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas efficitur nibh in nisi sagittis ultrices. Donec id velit nunc. Nam a lacus risus. Vestibulum molestie massa eget convallis pellentesque.
Mauris a nisl eget velit finibus blandit ac a odio. Sed sagittis consequat urna a egestas. Curabitur pretium convallis nibh, in ullamcorper odio tempus nec. Curabitur laoreet nec nisl sed accumsan. Sed elementum eleifend molestie. Aenean ullamcorper interdum risus, eget pharetra est volutpat ut. Aenean maximus consequat justo rutrum finibus. Mauris consequat facilisis consectetur. Vivamus rutrum dignissim libero, non aliquam lectus tempus id. In hac habitasse platea dictumst. Sed at magna dignissim, tincidunt lectus in, malesuada risus. Phasellus placerat blandit ligula. Integer posuere id elit at commodo. Sed consequat sagittis odio eget congue.
Aliquam ultricies, sapien a porta luctus, dolor nibh dignissim erat, dictum luctus orci lorem non quam. Quisque dapibus tempus mattis. Suspendisse gravida consequat mi at viverra. Quisque sed est purus. Fusce tincidunt semper massa eu blandit. Donec in lacus a tortor facilisis facilisis. Interdum et malesuada fames ac ante ipsum primis in faucibus. In aliquam dignissim eros ac consectetur. Aliquam fringilla magna erat. Nullam tincidunt maximus nulla, quis gravida est varius vel. Aliquam cursus, diam non facilisis mollis, nunc diam convallis enim, ac tempus diam tortor in dui. Nunc feugiat ligula odio, eleifend fermentum quam tincidunt sed. Duis pellentesque quam eget volutpat commodo.
Aliquam ex velit, porta sit amet augue vulputate, rhoncus fermentum magna. Integer non elementum augue. Phasellus rhoncus nisl nec magna lacinia vulputate. Suspendisse diam nibh, egestas a porta a, pellentesque ut nisl. Donec tempus ligula at leo convallis consequat. Duis sapien lorem, lobortis ac nisl dapibus, bibendum mollis lorem. Sed congue porttitor ex, eget scelerisque ligula consectetur quis. Mauris felis mauris, sodales quis nunc non, condimentum eleifend quam. Ut vitae viverra lorem. Vivamus lacinia et dolor vitae cursus. Proin faucibus venenatis enim vitae tincidunt. Sed sed venenatis leo.
Donec eu erat ullamcorper, consectetur dui sed, cursus tellus. Phasellus consectetur felis augue, quis auctor odio semper ac. In scelerisque gravida ligula eget lobortis. Sed tristique ultricies fringilla. Nunc in ultrices purus. Curabitur dictum cursus ante, at tempus est interdum at. Donec gravida lectus ut purus vestibulum, eu accumsan nisl pharetra.
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam orci nisi, vulputate ac pulvinar eu, maximus a tortor. Duis suscipit, nibh vel fermentum vehicula, mauris ante convallis metus, et feugiat turpis mauris non felis. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas efficitur nibh in nisi sagittis ultrices. Donec id velit nunc. Nam a lacus risus. Vestibulum molestie massa eget convallis pellentesque.
Mauris a nisl eget velit finibus blandit ac a odio. Sed sagittis consequat urna a egestas. Curabitur pretium convallis nibh, in ullamcorper odio tempus nec. Curabitur laoreet nec nisl sed accumsan. Sed elementum eleifend molestie. Aenean ullamcorper interdum risus, eget pharetra est volutpat ut. Aenean maximus consequat justo rutrum finibus. Mauris consequat facilisis consectetur. Vivamus rutrum dignissim libero, non aliquam lectus tempus id. In hac habitasse platea dictumst. Sed at magna dignissim, tincidunt lectus in, malesuada risus. Phasellus placerat blandit ligula. Integer posuere id elit at commodo. Sed consequat sagittis odio eget congue.
Aliquam ultricies, sapien a porta luctus, dolor nibh dignissim erat, dictum luctus orci lorem non quam. Quisque dapibus tempus mattis. Suspendisse gravida consequat mi at viverra. Quisque sed est purus. Fusce tincidunt semper massa eu blandit. Donec in lacus a tortor facilisis facilisis. Interdum et malesuada fames ac ante ipsum primis in faucibus. In aliquam dignissim eros ac consectetur. Aliquam fringilla magna erat. Nullam tincidunt maximus nulla, quis gravida est varius vel. Aliquam cursus, diam non facilisis mollis, nunc diam convallis enim, ac tempus diam tortor in dui. Nunc feugiat ligula odio, eleifend fermentum quam tincidunt sed. Duis pellentesque quam eget volutpat commodo.
Aliquam ex velit, porta sit amet augue vulputate, rhoncus fermentum magna. Integer non elementum augue. Phasellus rhoncus nisl nec magna lacinia vulputate. Suspendisse diam nibh, egestas a porta a, pellentesque ut nisl. Donec tempus ligula at leo convallis consequat. Duis sapien lorem, lobortis ac nisl dapibus, bibendum mollis lorem. Sed congue porttitor ex, eget scelerisque ligula consectetur quis. Mauris felis mauris, sodales quis nunc non, condimentum eleifend quam. Ut vitae viverra lorem. Vivamus lacinia et dolor vitae cursus. Proin faucibus venenatis enim vitae tincidunt. Sed sed venenatis leo.
Donec eu erat ullamcorper, consectetur dui sed, cursus tellus. Phasellus consectetur felis augue, quis auctor odio semper ac. In scelerisque gravida ligula eget lobortis. Sed tristique ultricies fringilla. Nunc in ultrices purus. Curabitur dictum cursus ante, at tempus est interdum at. Donec gravida lectus ut purus vestibulum, eu accumsan nisl pharetra.
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam orci nisi, vulputate ac pulvinar eu, maximus a tortor. Duis suscipit, nibh vel fermentum vehicula, mauris ante convallis metus, et feugiat turpis mauris non felis. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas efficitur nibh in nisi sagittis ultrices. Donec id velit nunc. Nam a lacus risus. Vestibulum molestie massa eget convallis pellentesque.
Mauris a nisl eget velit finibus blandit ac a odio. Sed sagittis consequat urna a egestas. Curabitur pretium convallis nibh, in ullamcorper odio tempus nec. Curabitur laoreet nec nisl sed accumsan. Sed elementum eleifend molestie. Aenean ullamcorper interdum risus, eget pharetra est volutpat ut. Aenean maximus consequat justo rutrum finibus. Mauris consequat facilisis consectetur. Vivamus rutrum dignissim libero, non aliquam lectus tempus id. In hac habitasse platea dictumst. Sed at magna dignissim, tincidunt lectus in, malesuada risus. Phasellus placerat blandit ligula. Integer posuere id elit at commodo. Sed consequat sagittis odio eget congue.
Aliquam ultricies, sapien a porta luctus, dolor nibh dignissim erat, dictum luctus orci lorem non quam. Quisque dapibus tempus mattis. Suspendisse gravida consequat mi at viverra. Quisque sed est purus. Fusce tincidunt semper massa eu blandit. Donec in lacus a tortor facilisis facilisis. Interdum et malesuada fames ac ante ipsum primis in faucibus. In aliquam dignissim eros ac consectetur. Aliquam fringilla magna erat. Nullam tincidunt maximus nulla, quis gravida est varius vel. Aliquam cursus, diam non facilisis mollis, nunc diam convallis enim, ac tempus diam tortor in dui. Nunc feugiat ligula odio, eleifend fermentum quam tincidunt sed. Duis pellentesque quam eget volutpat commodo.
Aliquam ex velit, porta sit amet augue vulputate, rhoncus fermentum magna. Integer non elementum augue. Phasellus rhoncus nisl nec magna lacinia vulputate. Suspendisse diam nibh, egestas a porta a, pellentesque ut nisl. Donec tempus ligula at leo convallis consequat. Duis sapien lorem, lobortis ac nisl dapibus, bibendum mollis lorem. Sed congue porttitor ex, eget scelerisque ligula consectetur quis. Mauris felis mauris, sodales quis nunc non, condimentum eleifend quam. Ut vitae viverra lorem. Vivamus lacinia et dolor vitae cursus. Proin faucibus venenatis enim vitae tincidunt. Sed sed venenatis leo.
Donec eu erat ullamcorper, consectetur dui sed, cursus tellus. Phasellus consectetur felis augue, quis auctor odio semper ac. In scelerisque gravida ligula eget lobortis. Sed tristique ultricies fringilla. Nunc in ultrices purus. Curabitur dictum cursus ante, at tempus est interdum at. Donec gravida lectus ut purus vestibulum, eu accumsan nisl pharetra.
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam orci nisi, vulputate ac pulvinar eu, maximus a tortor. Duis suscipit, nibh vel fermentum vehicula, mauris ante convallis metus, et feugiat turpis mauris non felis. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas efficitur nibh in nisi sagittis ultrices. Donec id velit nunc. Nam a lacus risus. Vestibulum molestie massa eget convallis pellentesque.
Mauris a nisl eget velit finibus blandit ac a odio. Sed sagittis consequat urna a egestas. Curabitur pretium convallis nibh, in ullamcorper odio tempus nec. Curabitur laoreet nec nisl sed accumsan. Sed elementum eleifend molestie. Aenean ullamcorper interdum risus, eget pharetra est volutpat ut. Aenean maximus consequat justo rutrum finibus. Mauris consequat facilisis consectetur. Vivamus rutrum dignissim libero, non aliquam lectus tempus id. In hac habitasse platea dictumst. Sed at magna dignissim, tincidunt lectus in, malesuada risus. Phasellus placerat blandit ligula. Integer posuere id elit at commodo. Sed consequat sagittis odio eget congue.
Aliquam ultricies, sapien a porta luctus, dolor nibh dignissim erat, dictum luctus orci lorem non quam. Quisque dapibus tempus mattis. Suspendisse gravida consequat mi at viverra. Quisque sed est purus. Fusce tincidunt semper massa eu blandit. Donec in lacus a tortor facilisis facilisis. Interdum et malesuada fames ac ante ipsum primis in faucibus. In aliquam dignissim eros ac consectetur. Aliquam fringilla magna erat. Nullam tincidunt maximus nulla, quis gravida est varius vel. Aliquam cursus, diam non facilisis mollis, nunc diam convallis enim, ac tempus diam tortor in dui. Nunc feugiat ligula odio, eleifend fermentum quam tincidunt sed. Duis pellentesque quam eget volutpat commodo.
Aliquam ex velit, porta sit amet augue vulputate, rhoncus fermentum magna. Integer non elementum augue. Phasellus rhoncus nisl nec magna lacinia vulputate. Suspendisse diam nibh, egestas a porta a, pellentesque ut nisl. Donec tempus ligula at leo convallis consequat. Duis sapien lorem, lobortis ac nisl dapibus, bibendum mollis lorem. Sed congue porttitor ex, eget scelerisque ligula consectetur quis. Mauris felis mauris, sodales quis nunc non, condimentum eleifend quam. Ut vitae viverra lorem. Vivamus lacinia et dolor vitae cursus. Proin faucibus venenatis enim vitae tincidunt. Sed sed venenatis leo.
`;

test.skip("Test token limit SqlDatabaseChain", async () => {
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

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('${veryLongString}', 22);
    `);

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  const chain = new SqlDatabaseChain({
    llm: new OpenAI({ temperature: 0 }),
    database: db,
  });

  const runChain = async () => {
    await chain.run("How many users are there?");
  };

  await expect(runChain()).rejects.toThrow();

  await datasource.destroy();
});
