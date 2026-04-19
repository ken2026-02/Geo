/**
 * Geometry Core Module
 * Robust geological orientation and stereographic math utilities.
 */

// Constants
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface Plane {
  dip: number;
  dipDirection: number;
}

export interface Line {
  plunge: number;
  trend: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Converts Dip/DipDirection to a unit normal vector (x, y, z).
 * Assumes North=y, East=x, Down=z.
 */
export const planeToNormal = (plane: Plane): Vector3 => {
  const dipRad = plane.dip * DEG_TO_RAD;
  const dipDirRad = plane.dipDirection * DEG_TO_RAD;
  
  // Normal vector calculation
  return {
    x: -Math.sin(dipRad) * Math.sin(dipDirRad),
    y: -Math.sin(dipRad) * Math.cos(dipDirRad),
    z: Math.cos(dipRad)
  };
};

/**
 * Calculates the intersection line of two planes.
 */
export const intersectPlanes = (p1: Plane, p2: Plane): Line => {
  const n1 = planeToNormal(p1);
  const n2 = planeToNormal(p2);
  
  // Cross product n1 x n2
  const l = {
    x: n1.y * n2.z - n1.z * n2.y,
    y: n1.z * n2.x - n1.x * n2.z,
    z: n1.x * n2.y - n1.y * n2.x
  };
  
  // Normalize to get plunge/trend
  const length = Math.sqrt(l.x * l.x + l.y * l.y + l.z * l.z);
  const nx = l.x / length;
  const ny = l.y / length;
  const nz = l.z / length;
  
  // Plunge is angle from horizontal (xy plane).
  // nz is vertical component.
  const plunge = Math.asin(Math.abs(nz)) * RAD_TO_DEG;
  
  // Trend is direction in xy plane.
  const trend = (Math.atan2(nx, ny) * RAD_TO_DEG + 360) % 360;
  
  return { plunge, trend };
};

/**
 * Converts a normal vector (x, y, z) to Dip/DipDirection.
 * Assumes North=y, East=x, Down=z.
 */
export const normalToPlane = (normal: Vector3): Plane => {
  const dip = Math.acos(normal.z) * RAD_TO_DEG;
  const dipDirection = (Math.atan2(normal.x, normal.y) * RAD_TO_DEG + 360) % 360;
  return { dip, dipDirection };
};

/**
 * Checks if a plane daylights relative to a slope face.
 */
export const isDaylighting = (plane: Plane, slope: Plane): boolean => {
  // Simple check: plane dip < slope dip, and dip direction is within 90 degrees of slope dip direction
  const diff = Math.abs(plane.dipDirection - slope.dipDirection);
  const normalizedDiff = Math.min(diff, 360 - diff);
  
  return plane.dip < slope.dip && normalizedDiff < 90;
};
