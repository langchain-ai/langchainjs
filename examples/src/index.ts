import path from "path";

const [exampleName, ...args] = process.argv.slice(2);
let runExample;
console.log("exampleName", exampleName);
console.log("__dirname", __dirname);
console.log("path.join(__dirname, exampleName)", path.join(__dirname, exampleName));
try {
  // eslint-disable-next-line import/no-dynamic-require,global-require
  ({ run: runExample } = require(path.join(__dirname, exampleName)));
} catch {
  throw new Error(`Could not load example ${exampleName}`);
}

runExample(args);
