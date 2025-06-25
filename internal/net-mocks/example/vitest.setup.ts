import { beforeAll } from "vitest";
import { net } from "../src";

beforeAll(() =>
  net.setupVitest({
    redactedKeys: ["x-api-key"],
    useTimings: true,
  })
);
