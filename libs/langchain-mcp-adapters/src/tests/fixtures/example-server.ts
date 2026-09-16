import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const name = process.argv[2];
if (name !== "calculator" && name !== "modern") {
  throw new Error("Expected calculator or modern example name");
}

const file = resolve(
  import.meta.dirname,
  "../../../examples",
  name === "calculator" ? "calculator_server_shttp_sse.ts" : "modern_server.ts"
);
const module = await import(pathToFileURL(file).href);
const server =
  name === "calculator"
    ? await module.listenCalculatorServer(0)
    : await module.listenModernServer(0);
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Example server did not listen");
}
console.log(`http://127.0.0.1:${address.port}`);

const close = () => {
  server.close();
  server.closeAllConnections();
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
