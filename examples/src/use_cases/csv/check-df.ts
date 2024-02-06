import { DataFrame } from "data-forge";
import { loadCSV } from "./csv.js";

const csvData = loadCSV("/Users/bracesproul/Downloads/titanic.csv");

const df = new DataFrame(csvData);

// Calculate mean
const mean = (series: any) => series.sum() / series.count();

// Calculate covariance
const covariance = (series1: any, series2: any, mean1: number, mean2: number) =>
  series1
    .zip(series2, (x: number, y: number) => (x - mean1) * (y - mean2))
    .sum() /
  (series1.count() - 1);

// Calculate standard deviation
const standardDeviation = (series: any, mean: number) =>
  Math.sqrt(
    series.select((value) => (value - mean) ** 2).sum() / (series.count() - 1)
  );

const ageMean = mean(df.getSeries("Age"));
const fareMean = mean(df.getSeries("Fare"));

const ageFareCovariance = covariance(
  df.getSeries("Age"),
  df.getSeries("Fare"),
  ageMean,
  fareMean
);
const ageStdDev = standardDeviation(df.getSeries("Age"), ageMean);
const fareStdDev = standardDeviation(df.getSeries("Fare"), fareMean);

// Correlation coefficient
const correlation = ageFareCovariance / (ageStdDev * fareStdDev);

console.log("Correlation between Age and Fare:", correlation);
