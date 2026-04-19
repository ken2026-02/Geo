/**
 * GeoField AU - Deterministic Phrase Templates
 * Formal Australian Geotechnical Consulting Tone
 */

export const MAPPING_TEMPLATE = {
  header: "Geotechnical mapping of rock exposure was conducted.",
  lithology: (lith: string, weather: string, strength: string) => 
    `The exposure comprises ${weather.toLowerCase()}, ${strength.toLowerCase()} ${lith.toUpperCase()}.`,
  structure: (struct: string) => `The rock mass is characterized as ${struct.toLowerCase()}.`,
  groundwater: (gw: string) => `Groundwater condition was observed as ${gw.toLowerCase()}.`,
  jointSet: (num: number, dip: number | null, dipDir: number | null, spacing: string, roughness: string, infill: string) => {
    const orientation = (dip !== null && !isNaN(dip) && dipDir !== null && !isNaN(dipDir)) 
      ? `${dip}/${dipDir.toString().padStart(3, '0')}, ` 
      : '';
    return `Joint Set ${num}: ${orientation}${spacing.toLowerCase() || 'unknown'} spacing, ${roughness.toLowerCase() || 'unknown'} with ${infill.toLowerCase() || 'unknown'} infill.`;
  }
};

export const SLOPE_TEMPLATE = {
  header: (type: string, height: number, angle: number) => 
    `Slope assessment performed on a ${type.toLowerCase()} batter (Height: ${height}m, Angle: ${angle}°).`,
  failureMode: (mode: string) => `Primary potential failure mode identified as ${mode.toLowerCase()}.`,
  conditions: (bench: string, toe: string, drainage: string) => 
    `Bench condition is ${bench.toLowerCase()}, toe is ${toe.toLowerCase()}, and drainage is ${drainage.toLowerCase()}.`,
  risk: (likelihood: string, consequence: string) => 
    `Risk assessment: ${likelihood} likelihood of failure with ${consequence} consequence.`,
  indicators: (list: string[]) => `Observed instability indicators: ${list.join(', ')}.`,
  controls: (list: string[]) => `Recommended controls: ${list.join(', ')}.`,
  prediction: (modes: string[]) => `Based on the discontinuity orientations relative to the slope geometry, potential failure mechanisms may include: ${modes.join(', ')}.`
};

export const Q_TEMPLATE = {
  summary: (q: number, rqd: number, quality: string, jn: string, jr: string, ja: string, jw: string, srf: string) => 
    `Rock mass classification using the Q-system was performed. The calculated Q-value is ${q.toFixed(2)}, indicating '${quality}' rock mass quality. ` +
    `Parameters: RQD=${rqd}%, Jn=${jn}, Jr=${jr}, Ja=${ja}, Jw=${jw}, SRF=${srf}.`,
  recommendation: (q: number, quality: string, support: string) =>
    `Based on the calculated Q-value of ${q.toFixed(2)}, the rock mass is classified as ${quality.toLowerCase()}. Recommended support includes ${support.toLowerCase()}.`,
  supportDesign: (label: string, spacing: string | null, mesh: boolean, shotcrete: string | null) => {
    const parts = [`Indicative support measures may include ${label.toLowerCase()}.`];
    if (spacing) parts.push(`Bolt spacing: ${spacing}.`);
    if (mesh) parts.push(`Wire mesh required.`);
    if (shotcrete) parts.push(`Shotcrete thickness: ${shotcrete}.`);
    return parts.join(' ');
  }
};

export const QA_TEMPLATE = {
  anchor: (id: string, type: string, load: number, result: string) => 
    `QA inspection for Anchor ${id} (${type}). Test load: ${load}kN. Result: ${result}.`,
  bolt: (id: string, type: string, length: number, result: string) => 
    `QA inspection for Rock Bolt ${id} (${type}, Length: ${length}m). Result: ${result}.`,
  shotcrete: (id: string, thick: number, result: string) => 
    `QA inspection for Shotcrete Panel ${id} (Thickness: ${thick}mm). Result: ${result}.`,
  retaining: (type: string, cond: string, result: string) => 
    `QA inspection for ${type} retaining structure. Condition: ${cond}. Result: ${result}.`
};

export const INVESTIGATION_TEMPLATE = {
  soil: (material: string, plasticity: string, moisture: string, consistency: string, structure: string, origin: string, secondary: string) => {
    const parts = [material];
    if (plasticity) parts.push(plasticity.toLowerCase());
    if (moisture) parts.push(moisture.toLowerCase());
    if (consistency) parts.push(consistency.toLowerCase());
    if (structure) parts.push(structure.toLowerCase());
    if (origin) parts.push(origin.toLowerCase());
    if (secondary) parts.push(`with ${secondary.toLowerCase()}`);
    return parts.join(', ') + '.';
  },
  granular: (material: string, grading: string, moisture: string, density: string, structure: string, origin: string, secondary: string) => {
    const parts = [material];
    if (grading) parts.push(grading.toLowerCase());
    if (moisture) parts.push(moisture.toLowerCase());
    if (density) parts.push(density.toLowerCase());
    if (structure) parts.push(structure.toLowerCase());
    if (origin) parts.push(origin.toLowerCase());
    if (secondary) parts.push(`with ${secondary.toLowerCase()}`);
    return parts.join(', ') + '.';
  },
  fill: (type: string, composition: string, moisture: string, density: string, inclusions: string, contaminants: string) => {
    const parts = [`FILL: ${type}`];
    if (composition) parts.push(composition.toLowerCase());
    if (moisture) parts.push(moisture.toLowerCase());
    if (density) parts.push(density.toLowerCase());
    if (inclusions) parts.push(`inclusions of ${inclusions.toLowerCase()}`);
    if (contaminants) parts.push(`contaminants: ${contaminants.toLowerCase()}`);
    return parts.join(', ') + '.';
  },
  transition: (material: string, moisture: string, consistency: string, structure: string, origin: string) => {
    const parts = [material];
    if (moisture) parts.push(moisture.toLowerCase());
    if (consistency) parts.push(consistency.toLowerCase());
    if (structure) parts.push(structure.toLowerCase());
    if (origin) parts.push(origin.toLowerCase());
    return parts.join(', ') + '.';
  }
};

export const LOGGING_ASSISTANT_TEMPLATE = {
  rock: (style: "SHORT" | "FULL", lith: string, weather: string, strength: string, colour: string, structure: string, setsSummary?: string, gw?: string, notes?: string) => {
    if (style === "SHORT") {
      const parts = [weather, strength, lith];
      if (colour) parts.push(colour);
      return parts.filter(Boolean).join(' ') + (notes ? `. ${notes}` : '.');
    }
    
    // FULL AS1726 style
    const parts = [];
    // 1. Lithology + weathering + strength
    parts.push(`${lith.toUpperCase()}, ${weather.toLowerCase()}, ${strength.toLowerCase()}`);
    // 2. Colour + structure/fabric
    const colStruct = [colour, structure].filter(Boolean).join(', ');
    if (colStruct) parts.push(colStruct);
    // 3. Discontinuities
    if (setsSummary) parts.push(setsSummary);
    // 4. Groundwater
    if (gw) parts.push(`Groundwater: ${gw.toLowerCase()}`);
    // 5. Defects/Remarks
    if (notes) parts.push(notes);
    
    return parts.join('. ') + (parts.length > 0 ? '.' : '');
  },
  
  soil: (style: "SHORT" | "FULL", material: string, plasticityOrGrading: string, moisture: string, consistencyOrDensity: string, structure: string, origin: string, secondary: string, notes?: string) => {
    if (style === "SHORT") {
      const parts = [consistencyOrDensity, moisture, material];
      return parts.filter(Boolean).join(' ') + (notes ? `. ${notes}` : '.');
    }

    // FULL AS1726 style
    const parts = [];
    // 1. Material
    parts.push(material.toUpperCase());
    // 2. Plasticity or grading
    if (plasticityOrGrading) parts.push(plasticityOrGrading.toLowerCase());
    // 3. Moisture
    if (moisture) parts.push(moisture.toLowerCase());
    // 4. Consistency or density
    if (consistencyOrDensity) parts.push(consistencyOrDensity.toLowerCase());
    // 5. Structure
    if (structure) parts.push(structure.toLowerCase());
    // 6. Origin
    if (origin) parts.push(`Origin: ${origin.toLowerCase()}`);
    // 7. Secondary components
    if (secondary) parts.push(`with ${secondary.toLowerCase()}`);
    // 8. Notes
    if (notes) parts.push(notes);

    return parts.join(', ') + (parts.length > 0 ? '.' : '');
  }
};
