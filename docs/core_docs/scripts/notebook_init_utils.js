/* eslint-disable */
function createGlobalNodeVars() {
  const process = {
    cwd: Deno.cwd,
    env: Deno.env.toObject(),
  };
  globalThis.process = process;
  globalThis.readFile = Deno.readFile;
}

createGlobalNodeVars();
