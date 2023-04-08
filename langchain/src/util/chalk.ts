import chalk from "chalk";

export const LogColor = {
    Red: "red",
    Green: "green",
    Yellow: "yellow",
    Blue: "blue",
    Magenta: "magenta",
    Cyan: "cyan",
    White: "white",
    Black: "black",
    Gray: "gray",
} as const;

type LogColor = typeof LogColor[keyof typeof LogColor];

export const colorLog = (color: LogColor, message: string, ...optionalParams: any[]) => {
    const colorFunction = chalk[color];
    colorFunction.level = 1;
    console.log(colorFunction(message, optionalParams));
};