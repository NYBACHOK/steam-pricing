import { ConversionMethod } from "./types";

export function getConversionMethodName(method: ConversionMethod): string {
  switch (method) {
    case 1:
      return "Raw Conversion";
    case 2:
      return "Purchase Power";
    case 3:
      return "Default Multi Variable";
    default:
      return "Unknown";
  }
}

export function getConversionMethodDescription(
  method: ConversionMethod,
): string {
  switch (method) {
    case 1:
      return "Direct currency conversion based on exchange rates.";
    case 2:
      return "Adjusted using regional purchasing power parity.";
    case 3:
      return "Valve default pricing model using multiple variables.";
    default:
      return "";
  }
}
