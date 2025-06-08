/* eslint-disable no-process-env */
/* eslint-disable import/no-extraneous-dependencies */
import { expect, test } from "@jest/globals";
import oracledb from "oracledb";
import { OracleTextSplitter } from "../oracle_text_splitter.js";

test("Test splitting by character count.", async () => {
  const text =
    "The tower is 324 meters (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 meters (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 meters. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 meters (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct.";
  const pref = { by: "chars", max: 500 };

  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
  });
  const splitter = new OracleTextSplitter(connection, pref);
  const output = await splitter.splitText(text);
  await connection.close();

  expect(output.length).toEqual(2);
});

test("Test splitting by words.", async () => {
  const text =
    "The tower is 324 meters (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 meters (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 meters. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 meters (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct.";
  const pref = { by: "words", max: 100 };

  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
  });
  const splitter = new OracleTextSplitter(connection, pref);
  const output = await splitter.splitText(text);
  await connection.close();

  expect(output.length).toEqual(2);
});
