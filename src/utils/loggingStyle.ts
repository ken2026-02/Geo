export type LoggingStyle = "SHORT" | "FULL";

export const QUALIFIERS = {
  frequency: ["trace", "rare", "occasional", "frequent"],
  intensity: ["minor", "moderate", "significant"],
  distribution: ["localised", "patchy", "continuous"],
  certainty: ["interpreted", "assumed", "observed"]
};

export function applyQualifiers(text: string, selectedQualifiers: string[]): string {
  if (!selectedQualifiers || selectedQualifiers.length === 0) return text;
  
  const qualifierSentence = `Qualifiers: ${selectedQualifiers.join("; ")}.`;
  return `${text.trim()} ${qualifierSentence}`;
}
