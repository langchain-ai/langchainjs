import path from "path";

const [exampleName, ...args] = process.argv.slice(2);
let runExample;
try {
  // eslint-disable-next-line import/no-dynamic-require,global-require
  ({ run: runExample } = require(path.join(__dirname, exampleName)));
} catch (e) {
  throw new Error(`Could not load example ${exampleName}: ${e}`);
}

runExample(args);
