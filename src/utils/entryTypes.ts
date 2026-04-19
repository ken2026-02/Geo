export const ENTRY_TYPE_LABEL: Record<string, string> = {
  ET1: "Mapping",
  ET2: "Water Observation",
  ET3: "Defect Log",
  ET4: "Anchor QA",
  ET5: "Retaining QA",
  ET6: "Slope Failure",
  ET7: "Quick Log",
  ET8: "Shotcrete QA",
  ET9: "Bolt QA",
  ET10: "Site Instruction",
  ET11: "Rock Classification",
  ET12: "Investigation Log",
  ET13: "Rock Mass Rating",
  ET14: "Geological Strength Index",
  ET15: "Structural Assessment",
  ET16: "Support Design",
  ET17: "Support Design Calculator",
  ET18: "Bearing Capacity",
  ET19: "Earth Pressure",
  ET20: "Settlement Screening",
  ET22: "Retaining Wall Check",
  ET23: "Soil Slope Stability",
  ET24: "Location Judgement",
  ET25: "Wedge FoS Analysis"
};

export function getEntryTypeLabel(id?: string) {
  if (!id) return "Unknown";
  return ENTRY_TYPE_LABEL[id] || "Unknown";
}
