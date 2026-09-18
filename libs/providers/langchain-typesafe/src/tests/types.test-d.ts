/**
 * Exists to make vitest's typecheck pass actually run.
 *
 * `vitest.config.ts` sets `typecheck: { enabled: true }`, but vitest only
 * invokes tsc when the package contains at least one `*.test-d.ts` file.
 * Without one it prints "Type Errors  no errors" while checking nothing —
 * which is how six genuine `TS2349` errors reached a final review unseen.
 * The assertions below are incidental; the file's job is to keep tsc wired
 * into `pnpm test` so that cannot recur.
 */
import { expectTypeOf, test } from "vitest";

import type { ChoiceAnswer, NoulAnswer, Question } from "../index.js";

test("answer variants narrow for middleware consumers", () => {
  expectTypeOf<ChoiceAnswer["choice"]>().toEqualTypeOf<string>();
  expectTypeOf<NoulAnswer["noul"]>().toEqualTypeOf<number>();
  expectTypeOf<Question["type"]>().toEqualTypeOf<"noul" | "choice" | "score">();
});
