/**
 * Water Engine Module
 * Computes water forces acting on a potential wedge block.
 */

export type WaterCondition = 'Dry' | 'Damp' | 'Wet' | 'Pressurized';

/**
 * Calculates the water force acting on the sliding plane.
 * Assumes hydrostatic pressure acting normal to the sliding plane.
 * Force = Pressure * Area
 * Pressure = γw * h
 */
export const calculateWaterForce = (
  area: number,
  head: number,
  condition: WaterCondition
): number => {
  if (condition === 'Dry' || head <= 0) return 0;
  
  const gammaW = 9.81; // kN/m³
  const pressure = gammaW * head;
  const force = pressure * area;
  
  // Reduction factors based on condition
  switch (condition) {
    case 'Damp': return force * 0.2;
    case 'Wet': return force * 0.6;
    case 'Pressurized': return force * 1.0;
    default: return 0;
  }
};
