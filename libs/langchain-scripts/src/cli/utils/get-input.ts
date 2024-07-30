import * as readline from "readline";

type Color = "green" | "red_background" | "white_background";

export const greenText = (text: string) => `\x1b[1m\x1b[92m${text}\x1b[0m`;
export const boldText = (text: string) => `\x1b[1m${text}\x1b[0m`;
export const redBackground = (text: string) => `\x1b[41m\x1b[37m${text}\x1b[0m`;
export const whiteBackground = (text: string) =>
  `\x1b[30m\x1b[47m${text}\x1b[0m`;

/**
 * Prompts the user with a question and returns the user input.
 *
 * @param {string} question The question to log to the users terminal.
 * @param {Color | undefined} color The color to use for the question.
 * @param {boolean | undefined} bold Whether to make the question bold.
 * @returns {Promise<string>} The user input.
 */
export async function getUserInput(
  question: string,
  color?: Color,
  bold?: boolean
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let questionWithStyling = question;
  if (bold) {
    questionWithStyling = boldText(questionWithStyling);
  }
  if (color === "green") {
    questionWithStyling = greenText(questionWithStyling);
  } else if (color === "red_background") {
    questionWithStyling = redBackground(questionWithStyling);
  } else if (color === "white_background") {
    questionWithStyling = whiteBackground(questionWithStyling);
  }

  return new Promise((resolve) => {
    rl.question(questionWithStyling, (input) => {
      rl.close();
      resolve(input);
    });
  });
}
