/**
 * Exists to make vitest's typecheck pass actually run.
 *
 * `vitest.config.ts` sets `typecheck: { enabled: true }`, but vitest only
 * invokes tsc when the package contains at least one `*.test-d.ts` file.
 * Without one it prints "Type Errors  no errors" while checking nothing —
 * which is how six genuine `TS2349` errors reached a final review unseen.
 * The assertions below are incidental; the file's job is to keep tsc wired
 * into `pnpm test` so that never recurs.
 */
import type { ChoiceAnswer, NoulAnswer, Question } from "../index.js";

declare const choice: ChoiceAnswer;
declare const noul: NoulAnswer;
declare const question: Question;

// Narrowing the discriminated unions must work for middleware consumers.
const _choiceLabel: string = choice.choice;
const _noulValue: number = noul.noul;
const _kind: "noul" | "choice" | "score" = question.type;
void [_choiceLabel, _noulValue, _kind];
