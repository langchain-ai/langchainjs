import type {
  Choice,
  ChoiceAnswer,
  JsonValue,
  Noul,
  NoulAnswer,
  NoulCriteria,
  QuestionContent,
  Score,
  ScoreAnswer,
} from "../index.js";

// Each alias must resolve; an unexported name fails the typecheck pass.
declare const a: Choice;
declare const b: ChoiceAnswer;
declare const c: Noul;
declare const d: NoulAnswer;
declare const e: NoulCriteria;
declare const f: QuestionContent;
declare const g: Score;
declare const h: ScoreAnswer;
declare const i: JsonValue;
void [a, b, c, d, e, f, g, h, i];
