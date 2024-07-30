import * as readline from "readline";

/**
 * Prompts the user with a question and returns the user input.
 *
 * @param {string} question The question to log to the users terminal.
 * @returns {Promise<string>} The user input.
 */
export async function getUserInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\x1b[30m\x1b[47m${question}\x1b[0m`, (input) => {
      rl.close();
      resolve(input);
    });
  });
}
