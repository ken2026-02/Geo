/**
 * Geotechnical Action Engine Rules
 * Maps instability indicators to recommended controls.
 */

export const INDICATOR_CONTROL_RULES: Record<string, string[]> = {
  'IND1': ['C1'],           // Loose blocks -> Scaling
  'IND2': ['C1', 'C5'],     // Overhang -> Scaling + Mesh
  'IND4': ['C4'],           // Tension cracks -> Rock Bolts
  'IND7': ['C6'],           // Seepage/wet patch -> Drain holes
  'IND9': ['C10'],          // Erosion/scour -> Berm construction
};

export function getSuggestedControls(indicatorIds: string[]): string[] {
  const suggested = new Set<string>();
  indicatorIds.forEach(id => {
    const controls = INDICATOR_CONTROL_RULES[id];
    if (controls) {
      controls.forEach(c => suggested.add(c));
    }
  });
  return Array.from(suggested);
}
