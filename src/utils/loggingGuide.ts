export interface LoggingContext {
  material?: string;
  entryType?: string;
}

export function getLoggingHints(context: LoggingContext) {
  const hints: string[] = [];

  if (context.material === "Clay") {
    hints.push("Select plasticity");
    hints.push("Select consistency");
  }

  if (context.material === "Sand" || context.material === "Gravel") {
    hints.push("Select grading");
    hints.push("Select density");
    hints.push("Select fines content");
    hints.push("Select particle angularity");
  }

  if (context.entryType === "Mapping") {
    hints.push("Record joint sets");
    hints.push("Record groundwater condition");
  }

  return hints;
}
