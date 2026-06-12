// Empty stub for Node.js built-in modules that are unavailable in the browser.
// Used by turbopack resolveAlias in next.config.js.
// Must be CJS so Turbopack treats it as a dynamic module and does not
// statically validate named exports (e.g. `import { writeFile } from "fs"`).
module.exports = {};
