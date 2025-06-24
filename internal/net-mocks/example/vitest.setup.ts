import { beforeAll } from "vitest";
import { net } from "../collector";

beforeAll(() =>
  net.setupVitest({
    maxAge: 60000,
    redactedKeys: ["x-api-key"],
    useTimings: false,
  })
);
