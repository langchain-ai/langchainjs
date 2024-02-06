import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { loadCSV } from "./load-csv.js";

const df = loadCSV("/Users/bracesproul/Downloads/titanic.csv");

// Connect to the database & initialize.
const datasource = new DataSource({
  type: "postgres",
  host: "localhost", // or the appropriate hostname
  port: 5432,
  schema: "public", // default schema is "public", change if necessary
  username: "postgres", // default username for PostgreSQL
  password: "", // if you set a password, specify it here
  database: "postgres", // specify the database you want to connect to
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

await db.run(`DROP TABLE IF EXISTS passengers;`);

// Create our titanic table
await db.run(`CREATE TABLE IF NOT EXISTS passengers (
  "Survived" TEXT,
  "Pclass" TEXT,
  "Name" TEXT,
  "Sex" TEXT,
  "Age" TEXT,
  "Siblings/Spouses Aboard" TEXT,
  "Parents/Children Aboard" TEXT,
  "Fare" TEXT
);`);

function createInsertCommand(data: string[][], columnNames: string[]): string {
  const tableName = "passengers";
  // Map each sub-array to a string representing the values to insert, escaping single quotes.
  const valuesList = data
    .map(
      (row) =>
        `(${row.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ")})`
    )
    .join(",\n");

  // Construct the full INSERT INTO command.
  const command = `INSERT INTO "${tableName}" (${columnNames
    .map((name) => `"${name}"`)
    .join(", ")}) VALUES ${valuesList};`;

  return command;
}

// Create the INSERT INTO command and execute it.
const sqlInsertCommand = createInsertCommand(df.values.rows, df.columnNames);
await db.run(sqlInsertCommand);

console.log(
  JSON.parse(
    await db.run(
      `SELECT * FROM passengers WHERE "Name" = 'Mrs. Charles Melville (Clara Jennings Gregg) Hays';`
    )
  )
);
/**
[
  {
    Survived: '1',
    Pclass: '1',
    Name: 'Mrs. Charles Melville (Clara Jennings Gregg) Hays',
    Sex: 'female',
    Age: '52',
    'Siblings/Spouses Aboard': '1',
    'Parents/Children Aboard': '1',
    Fare: '93.5'
  }
]
 */
