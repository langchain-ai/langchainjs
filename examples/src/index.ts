import path from "path";
import url from "url";

const [exampleName, ...args] = process.argv.slice(2);

// Allow people to pass all possible variations of a path to an example
// ./src/foo.ts, ./dist/foo.js, src/foo.ts, dist/foo.js, foo.ts
let exampleRelativePath: string;
if (exampleName.startsWith("./src/")) {
  exampleRelativePath = exampleName.slice(6);
} else if (exampleName.startsWith("./dist/")) {
  exampleRelativePath = exampleName.slice(7);
} else if (exampleName.startsWith("src/")) {
  exampleRelativePath = exampleName.slice(4);
} else if (exampleName.startsWith("dist/")) {
  exampleRelativePath = exampleName.slice(5);
} else {
  exampleRelativePath = exampleName;
}

let runExample;
try {
  ({ run: runExample } = await import(
    path.join(
      path.dirname(url.fileURLToPath(import.meta.url)),
      exampleRelativePath
    )
  ));
} catch (e) {
  throw new Error(`Could not load example ${exampleName}: ${e}`);
}

const maybePromise = runExample(args);

if (maybePromise instanceof Promise) {
  maybePromise.catch((e) => {
    console.error(`Example failed with ${e}`);
    process.exit(1);
  });
}
