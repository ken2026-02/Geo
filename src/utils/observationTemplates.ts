export interface ObservationTemplate {
  id: string;
  label: string;
  entry_type: string;
  summary: string;
  risk: string;
  status: string;
}

export const OBSERVATION_TEMPLATES: ObservationTemplate[] = [
  {
    id: "wet_patch",
    label: "Wet Patch",
    entry_type: "ET12",
    summary: "Wet patch observed on slope face.",
    risk: "Medium",
    status: "Open"
  },
  {
    id: "rockfall_debris",
    label: "Rockfall Debris",
    entry_type: "ET7",
    summary: "Rockfall debris observed at slope toe.",
    risk: "High",
    status: "Open"
  },
  {
    id: "tension_crack",
    label: "Tension Crack",
    entry_type: "ET7",
    summary: "Tension crack observed near crest.",
    risk: "High",
    status: "Open"
  },
  {
    id: "blocked_drain",
    label: "Blocked Drain",
    entry_type: "ET12",
    summary: "Drainage path appears blocked by debris.",
    risk: "Medium",
    status: "Open"
  }
];
