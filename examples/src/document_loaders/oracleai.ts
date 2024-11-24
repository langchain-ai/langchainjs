import oracledb from 'oracledb';
import { OracleDocLoader, OracleLoadFromType } from "@langchain/community/document_loaders/web/oracleai";

let connection: oracledb.Connection;

// Replace the placeholders with your information
const username = "<username>";
const pwd = "<password>";
const dsn = "<hostname>/<service_name>";

try {
  connection = await oracledb.getConnection({
      user: username,
      password: pwd,
      connectString: dsn
  });
  console.log("Connection Successful");
} catch  (err) {
  console.error('Connection failed:', err);
  throw err;
}

// Loading a local file (replace <filepath> with the path of the file you want to load.)
const loader = new OracleDocLoader(connection, "src/document_loaders/example_data/bitcoin.pdf", OracleLoadFromType.FILE);
    
/*
// Loading from a local directory (replace <dirpath> with the path of the directory you want to load from.)
const loader = new OracleDocLoader(connection, <dirpath>, OracleLoadFromType.DIR);
    
    
// Loading from Oracle Database table (replace the placeholders with your information, optionally add a [metadata_cols] parameter to include columns as metadata.)
const loader = new OracleDocLoader(connection, <tablename>, OracleLoadFromType.TABLE, <owner_name>, <colname>);
*/
    
// Load the docs
const docs = loader.load();
console.log("Number of docs loaded:", docs.length);
console.log("Document-0:", docs[0].page_content); // content


