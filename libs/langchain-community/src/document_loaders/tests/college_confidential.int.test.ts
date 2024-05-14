import { test } from "@jest/globals";
import { CollegeConfidentialLoader } from "../web/college_confidential.js";

test("Test College confidential loader", async () => {
  const loader = new CollegeConfidentialLoader(
    "https://www.collegeconfidential.com/colleges/brown-university/"
  );
  await loader.load();
});
