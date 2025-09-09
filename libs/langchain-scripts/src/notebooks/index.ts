import { checkNotebookTypeErrors } from "./check_notebook_type_errors.js";
import { checkUnexpectedRebuildError } from "./check_unexpected_rebuild_timer.js";

async function main() {
  await Promise.all([checkNotebookTypeErrors(), checkUnexpectedRebuildError()]);
}

try {
  await main();
} catch {
  process.exit(1);
}
