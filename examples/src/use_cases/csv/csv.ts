import dataForge from "data-forge";
import "data-forge-fs";

export const loadCSV = (filePath: string) => {
  const result = dataForge
    .readFileSync(filePath) // Read input file.
    .parseCSV()
    .asJSON();
  return (result as any).dataframe.content;
};