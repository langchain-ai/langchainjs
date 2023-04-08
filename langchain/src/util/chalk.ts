import chalk from "chalk"

// Color Enums

export enum LogColor {
    Red = "red",
    Green = "green",
    Yellow = "yellow",
    Blue = "blue",
    Magenta = "magenta",
    Cyan = "cyan",
    White = "white",
    Black = "black",
    Gray = "gray",
}

export const colorLog = (color: LogColor, message: string, ...optionalParams: any[]) => {
    const colorFunction = chalk[color];
    colorFunction.level = 1;
    console.log(colorFunction(message, optionalParams));
};