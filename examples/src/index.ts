import path from "path";
import url from "url";

const [exampleName, ...args] = process.argv.slice(2);
let runExample;
try {
  ({ run: runExample } = await import(
    path.join(path.dirname(url.fileURLToPath(import.meta.url)), exampleName)
  ));
} catch (e) {
  throw new Error(`Could not load example ${exampleName}: ${e}`);
}

runExample(args);
