export interface RocsciencePoint2D {
  x: number;
  y: number;
}

export interface PlaneOrientation {
  dip: number;
  dipDir: number;
}

export interface TrendPlunge {
  trend: number;
  plunge: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

const EPS = 1e-9;

export const wrapAzimuth = (angle: number): number => ((angle % 360) + 360) % 360;

const normalizeVector = (vector: Vector3): Vector3 => {
  const magnitude = Math.sqrt((vector.x ** 2) + (vector.y ** 2) + (vector.z ** 2));
  if (magnitude < EPS) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude
  };
};

const lineVector = (trend: number, plunge: number): Vector3 => {
  const trendRad = (wrapAzimuth(trend) * Math.PI) / 180;
  const plungeRad = (plunge * Math.PI) / 180;

  return {
    x: Math.cos(plungeRad) * Math.sin(trendRad),
    y: Math.cos(plungeRad) * Math.cos(trendRad),
    z: -Math.sin(plungeRad)
  };
};

const vectorToTrendPlunge = (vector: Vector3): TrendPlunge => {
  let unit = normalizeVector(vector);
  if (unit.z > 0) {
    unit = { x: -unit.x, y: -unit.y, z: -unit.z };
  }

  return {
    trend: wrapAzimuth(Math.atan2(unit.x, unit.y) * (180 / Math.PI)),
    plunge: Math.asin(Math.min(1, Math.max(-1, -unit.z))) * (180 / Math.PI)
  };
};

const planeToNormal = (dip: number, dipDir: number): Vector3 => {
  const pole = planeToPole(dip, dipDir);
  return lineVector(pole.trend, pole.plunge);
};

export const planeToPole = (dip: number, dipDir: number): TrendPlunge => ({
  trend: wrapAzimuth(dipDir + 180),
  plunge: 90 - dip
});

export const projectLineEqualAngle = (trend: number, plunge: number): RocsciencePoint2D => {
  const trendRad = (wrapAzimuth(trend) * Math.PI) / 180;
  const radius = Math.tan(((90 - plunge) * Math.PI) / 360);

  return {
    x: radius * Math.sin(trendRad),
    y: radius * Math.cos(trendRad)
  };
};

export const projectPoleEqualAngle = (dip: number, dipDir: number): RocsciencePoint2D => {
  const pole = planeToPole(dip, dipDir);
  return projectLineEqualAngle(pole.trend, pole.plunge);
};

export const buildGreatCircle = (dip: number, dipDir: number, segments: number = 180): RocsciencePoint2D[] => {
  const normal = planeToNormal(dip, dipDir);
  const strike = lineVector(wrapAzimuth(dipDir - 90), 0);
  let dipVector = normalizeVector({
    x: normal.y * strike.z - normal.z * strike.y,
    y: normal.z * strike.x - normal.x * strike.z,
    z: normal.x * strike.y - normal.y * strike.x
  });

  if (dipVector.z > 0) {
    dipVector = { x: -dipVector.x, y: -dipVector.y, z: -dipVector.z };
  }

  const points: RocsciencePoint2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (Math.PI * i) / segments;
    let raw = normalizeVector({
      x: strike.x * Math.cos(theta) + dipVector.x * Math.sin(theta),
      y: strike.y * Math.cos(theta) + dipVector.y * Math.sin(theta),
      z: strike.z * Math.cos(theta) + dipVector.z * Math.sin(theta)
    });

    if (raw.z > 0) {
      raw = { x: -raw.x, y: -raw.y, z: -raw.z };
    }

    const line = vectorToTrendPlunge(raw);
    points.push(projectLineEqualAngle(line.trend, line.plunge));
  }

  return points;
};

export const buildFrictionCone = (frictionAngle: number, segments: number = 180): RocsciencePoint2D[] => {
  const points: RocsciencePoint2D[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(projectLineEqualAngle((360 * i) / segments, frictionAngle));
  }
  return points;
};
