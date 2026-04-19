import React from 'react';
import {
  buildFrictionCone,
  buildGreatCircle,
  planeToPole,
  projectLineEqualAngle,
  RocsciencePoint2D
} from '../utils/stereonetRocscience';

interface JointSet {
  id?: string;
  dip: number;
  dipDir: number;
}

interface StereonetRocscienceProps {
  slopeDip?: number;
  slopeDipDir?: number;
  jointSets?: JointSet[];
  size?: number;
  frictionAngle?: number;
  planarPossible?: boolean;
  wedgePossible?: boolean;
  topplingPossible?: boolean;
  controllingSet?: string | null;
  controllingPair?: string | null;
  wedgeTrend?: number | null;
  wedgePlunge?: number | null;
}

interface SvgPoint {
  x: number;
  y: number;
}

interface NetCircle {
  radius: number;
  label: string;
}

interface LabelPlacement {
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
}

const labelPlacements: Record<string, LabelPlacement> = {
  Slope: { dx: -14, dy: -10, anchor: 'end' },
  J1: { dx: 10, dy: -10, anchor: 'start' },
  J2: { dx: 10, dy: 14, anchor: 'start' },
  J3: { dx: -10, dy: 14, anchor: 'end' }
};

const netCircles: NetCircle[] = [
  { radius: 30, label: '30' },
  { radius: 60, label: '60' }
];

export default function StereonetRocscience({
  slopeDip,
  slopeDipDir,
  jointSets = [],
  size = 300,
  frictionAngle = 30,
  planarPossible = false,
  wedgePossible = false,
  topplingPossible = false,
  controllingSet = null,
  controllingPair = null,
  wedgeTrend = null,
  wedgePlunge = null
}: StereonetRocscienceProps) {
  const numericSlopeDip = slopeDip === undefined ? undefined : Number(slopeDip);
  const numericSlopeDipDir = slopeDipDir === undefined ? undefined : Number(slopeDipDir);
  const numericJointSets = jointSets.map((joint) => ({
    ...joint,
    dip: Number(joint.dip),
    dipDir: Number(joint.dipDir)
  }));
  const numericFrictionAngle = Number(frictionAngle);
  const numericWedgeTrend = wedgeTrend == null ? null : Number(wedgeTrend);
  const numericWedgePlunge = wedgePlunge == null ? null : Number(wedgePlunge);

  const radius = size / 2 - 20;
  const center = size / 2;

  const toSvgPoint = (point: RocsciencePoint2D): SvgPoint => ({
    x: center + point.x * radius,
    y: center - point.y * radius
  });

  const toPath = (points: RocsciencePoint2D[]) => {
    if (!points.length) return '';
    return points.map((point, index) => {
      const svg = toSvgPoint(point);
      return `${index === 0 ? 'M' : 'L'} ${svg.x} ${svg.y}`;
    }).join(' ');
  };

  const pointAt = (trend: number, plunge: number): SvgPoint => toSvgPoint(projectLineEqualAngle(trend, plunge));

  const offsetPoint = (point: SvgPoint, dx: number, dy: number): SvgPoint => ({ x: point.x + dx, y: point.y + dy });

  const labelAnchorForPoint = (point: SvgPoint): LabelPlacement => ({
    dx: point.x >= center ? 10 : -10,
    dy: point.y >= center ? 14 : -10,
    anchor: point.x >= center ? 'start' : 'end'
  });

  const renderPole = (dip: number, dipDir: number, color: string, label: string) => {
    const pole = planeToPole(dip, dipDir);
    const poleSvg = toSvgPoint(projectLineEqualAngle(pole.trend, pole.plunge));
    const placement = labelPlacements[label] || { dx: 8, dy: -8, anchor: 'start' as const };

    return (
      <g key={`${label}-pole`}>
        <circle cx={poleSvg.x} cy={poleSvg.y} r="3.8" fill={color} stroke="#fff" strokeWidth="1.2" />
        <text
          x={poleSvg.x + placement.dx}
          y={poleSvg.y + placement.dy}
          fontSize="10"
          fill={color}
          textAnchor={placement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2.2"
          className="select-none pointer-events-none"
        >
          {label}
        </text>
        <title>{`${label}: pole ${Math.round(pole.trend)} / ${Math.round(pole.plunge)}`}</title>
      </g>
    );
  };

  const renderGreatCircle = (dip: number, dipDir: number, color: string, key: string) => (
    <path
      key={key}
      d={toPath(buildGreatCircle(dip, dipDir))}
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      opacity="0.78"
      strokeLinecap="round"
    />
  );


  const renderDaylightMarker = () => {
    if (numericSlopeDipDir === undefined || (!planarPossible && !wedgePossible)) return null;
    const daylightPoint = pointAt(numericSlopeDipDir, 6);
    const labelPlacement = { dx: 8, dy: 4, anchor: 'start' as const };
    const labelPoint = offsetPoint(daylightPoint, labelPlacement.dx, labelPlacement.dy);

    return (
      <g key="daylight-marker">
        <circle cx={daylightPoint.x} cy={daylightPoint.y} r="3.4" fill="#f59e0b" opacity="0.9" />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          fontSize="8.5"
          fill="#b45309"
          textAnchor={labelPlacement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
          className="select-none pointer-events-none"
        >
          Daylight
        </text>
      </g>
    );
  };

  const renderTopplingMarker = () => {
    if (numericSlopeDipDir === undefined || !topplingPossible) return null;
    const topplingTrend = (numericSlopeDipDir + 180) % 360;
    const topplingPoint = pointAt(topplingTrend, 6);
    const labelPlacement = labelAnchorForPoint(topplingPoint);
    const labelPoint = offsetPoint(topplingPoint, labelPlacement.dx, labelPlacement.dy - 8);

    return (
      <g key="toppling-marker">
        <circle cx={topplingPoint.x} cy={topplingPoint.y} r="3.4" fill="#059669" opacity="0.9" />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          fontSize="8.5"
          fill="#047857"
          textAnchor={labelPlacement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
          className="select-none pointer-events-none"
        >
          Toppling side{controllingSet ? ` ${controllingSet}` : ''}
        </text>
      </g>
    );
  };

  const renderWedgeDirection = () => {
    if (!wedgePossible || numericWedgeTrend == null || numericWedgePlunge == null) return null;
    const start = pointAt(numericWedgeTrend, Math.min(85, numericWedgePlunge + 10));
    const end = pointAt(numericWedgeTrend, Math.max(2, numericWedgePlunge - 8));
    const labelPlacement = { dx: 18, dy: -6, anchor: 'start' as const };
    const labelPoint = offsetPoint(end, labelPlacement.dx, labelPlacement.dy);

    return (
      <g key="wedge-direction" opacity="0.85">
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#7c3aed"
          strokeWidth="1.1"
          strokeDasharray="3 2"
        />
        <line x1={end.x} y1={end.y} x2={end.x - 4} y2={end.y - 1} stroke="#7c3aed" strokeWidth="1.1" />
        <line x1={end.x} y1={end.y} x2={end.x - 1} y2={end.y - 4} stroke="#7c3aed" strokeWidth="1.1" />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          fontSize="8.5"
          fill="#6d28d9"
          textAnchor={labelPlacement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
          className="select-none pointer-events-none"
        >
          Wedge slide dir
        </text>
      </g>
    );
  };

  const renderSlopeDipDirection = () => {
    if (numericSlopeDip === undefined || numericSlopeDipDir === undefined) return null;
    const arrowStart = pointAt(numericSlopeDipDir, Math.min(18, Math.max(8, numericSlopeDip / 3.5)));
    const arrowEnd = pointAt(numericSlopeDipDir, 2);
    const labelPlacement = { dx: -14, dy: -2, anchor: 'end' as const };
    const labelPoint = offsetPoint(arrowEnd, labelPlacement.dx, labelPlacement.dy);

    return (
      <g key="slope-dip-direction" opacity="0.75">
        <line
          x1={arrowStart.x}
          y1={arrowStart.y}
          x2={arrowEnd.x}
          y2={arrowEnd.y}
          stroke="#dc2626"
          strokeWidth="1.1"
          strokeDasharray="4 3"
        />
        <line
          x1={arrowEnd.x}
          y1={arrowEnd.y}
          x2={arrowEnd.x - 4}
          y2={arrowEnd.y - 1}
          stroke="#dc2626"
          strokeWidth="1.1"
        />
        <line
          x1={arrowEnd.x}
          y1={arrowEnd.y}
          x2={arrowEnd.x - 1}
          y2={arrowEnd.y - 4}
          stroke="#dc2626"
          strokeWidth="1.1"
        />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          fontSize="8.5"
          fill="#dc2626"
          textAnchor={labelPlacement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
          className="select-none pointer-events-none"
        >
          Slope dip dir
        </text>
      </g>
    );
  };

  const renderWedgePoint = () => {
    if (!wedgePossible || numericWedgeTrend == null || numericWedgePlunge == null) return null;
    const point = pointAt(numericWedgeTrend, numericWedgePlunge);
    const labelPlacement = { dx: 18, dy: 14, anchor: 'start' as const };
    const labelPoint = offsetPoint(point, labelPlacement.dx, labelPlacement.dy);
    const label = controllingPair ? `Wedge ${controllingPair}` : `Wedge ${Math.round(numericWedgeTrend)}/${Math.round(numericWedgePlunge)}`;

    return (
      <g key="wedge-point">
        <circle cx={point.x} cy={point.y} r="5.5" fill="none" stroke="#8b5cf6" strokeWidth="2" />
        <line x1={point.x - 4} y1={point.y - 4} x2={point.x + 4} y2={point.y + 4} stroke="#8b5cf6" strokeWidth="1.8" />
        <line x1={point.x + 4} y1={point.y - 4} x2={point.x - 4} y2={point.y + 4} stroke="#8b5cf6" strokeWidth="1.8" />
        <line x1={point.x} y1={point.y} x2={labelPoint.x - 4} y2={labelPoint.y - 4} stroke="#8b5cf6" strokeWidth="1.2" opacity="0.7" />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          fontSize="8.5"
          fill="#7c3aed"
          textAnchor={labelPlacement.anchor}
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
          className="select-none pointer-events-none"
        >
          {label}
        </text>
      </g>
    );
  };

  const colors = ['#3b82f6', '#22c55e', '#f97316'];
  const frictionCone = numericFrictionAngle > 0 && numericFrictionAngle < 90 ? buildFrictionCone(numericFrictionAngle) : [];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="bg-white rounded-full shadow-sm border border-slate-200">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#cbd5e1" strokeWidth="1" />
        {netCircles.map((circle) => (
          <circle
            key={circle.label}
            cx={center}
            cy={center}
            r={Math.tan(((90 - circle.radius) * Math.PI) / 360) * radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />
        ))}
        <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#cbd5e1" strokeWidth="1" />
        <text x={center} y={center - radius - 5} textAnchor="middle" fontSize="10" fill="#64748b">N</text>
        <text x={center + radius + 5} y={center + 3} textAnchor="start" fontSize="10" fill="#64748b">E</text>
        <text x={center} y={center + radius + 12} textAnchor="middle" fontSize="10" fill="#64748b">S</text>
        <text x={center - radius - 5} y={center + 3} textAnchor="end" fontSize="10" fill="#64748b">W</text>

        {frictionCone.length > 0 && (
          <path d={toPath(frictionCone)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
        )}

        {numericSlopeDip !== undefined && numericSlopeDipDir !== undefined && renderGreatCircle(numericSlopeDip, numericSlopeDipDir, '#ef4444', 'slope-great-circle')}
        {numericJointSets.map((joint, index) => renderGreatCircle(joint.dip, joint.dipDir, colors[index % colors.length], `${joint.id || `J${index + 1}`}-great-circle`))}

        {numericSlopeDip !== undefined && numericSlopeDipDir !== undefined && renderPole(numericSlopeDip, numericSlopeDipDir, '#ef4444', 'Slope')}
        {numericJointSets.map((joint, index) => renderPole(joint.dip, joint.dipDir, colors[index % colors.length], joint.id || `J${index + 1}`))}

        {renderSlopeDipDirection()}
        {renderDaylightMarker()}
        {renderTopplingMarker()}
        {renderWedgeDirection()}
        {renderWedgePoint()}
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-600 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><circle cx="6" cy="6" r="3.5" fill="#ef4444" stroke="#fff" strokeWidth="1" /></svg>
          <span>Slope pole</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><path d="M 2 10 L 20 2" fill="none" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" /></svg>
          <span>Slope plane</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><line x1="2" y1="10" x2="20" y2="2" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 2" /></svg>
          <span>Slope dip dir</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><circle cx="6" cy="6" r="3.2" fill="#3b82f6" stroke="#fff" strokeWidth="1" /></svg>
          <span>Joint poles</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><path d="M 2 10 C 8 2, 14 2, 20 10" fill="none" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" /></svg>
          <span>Joint planes</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><circle cx="11" cy="6" r="4.5" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" /></svg>
          <span>Friction check</span>
        </div>
        {(planarPossible || wedgePossible) && (
          <div className="flex items-center gap-2">
            <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><circle cx="6" cy="6" r="3.2" fill="#f59e0b" /></svg>
            <span>Daylight</span>
          </div>
        )}
        {topplingPossible && (
          <div className="flex items-center gap-2">
            <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><circle cx="6" cy="6" r="3.2" fill="#059669" /></svg>
            <span>Toppling side</span>
          </div>
        )}
        {wedgePossible && (
          <div className="flex items-center gap-2">
            <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0"><line x1="6" y1="2" x2="16" y2="10" stroke="#7c3aed" strokeWidth="1.5" /><line x1="16" y1="2" x2="6" y2="10" stroke="#7c3aed" strokeWidth="1.5" /></svg>
            <span>Wedge</span>
          </div>
        )}
      </div>
    </div>
  );
}
