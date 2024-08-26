import { test, expect } from "@jest/globals";

test("REGEX WORKS", () => {
  const regex =
    /^download\s+(?:https?:\/\/)?[\w-]+(\.[\w-]+)+[^\s]+\s+password:\s*.+\s+in the installer menu, select\s*.+$/i;

  const comment = `Download
https://www.mediafire.com/file/wpwfw3bpd8gsjey/fix.rar/file
password: changeme
In the installer menu, select "gcc."`;

  expect(regex.test(comment.toLowerCase())).toBe(true);
});
