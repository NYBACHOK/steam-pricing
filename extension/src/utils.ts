import { ConversionMethod } from "./comparison/fetch";

export function getConversionMethodName(method: ConversionMethod): string {
  switch (method) {
    case 1:
      return "Default Multi Variable";
    case 2:
      return "Purchase Power";
    case 3:
      return "Raw Conversion";
    default:
      return "Unknown";
  }
}

export function getConversionMethodDescription(
  method: ConversionMethod,
): string {
  switch (method) {
    case 1:
      return "Valve default pricing model using multiple variables.";
    case 2:
      return "Adjusted using regional purchasing power parity.";
    case 3:
      return "Direct currency conversion based on exchange rates.";
    default:
      return "";
  }
}
