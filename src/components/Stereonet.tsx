import React from 'react';
import {
  planeToPole,
  poleToStereonetXY,
  lineToStereonetXY,
  planeToGreatCirclePoints,
  wrapAzimuth
} from '../utils/stereonet';

interface JointSet {
  id?: string;
  dip: number;
  dipDir: number;
}

interface StereonetProps {
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

interface LabelPlacement {
  dx: number;
  dy: number;
  anchor?: 'start' | 'middle' | 'end';
}

interface SvgPoint {
  x: number;
  y: number;
}

const labelPlacements: Record<string, LabelPlacement> = {
  Slope: { dx: -18, dy: -12, anchor: 'end' },
  J1: { dx: 10, dy: -10, anchor: 'start' },
  J2: { dx: 10, dy: 14, anchor: 'start' },
  J3: { dx: -10, dy: 14, anchor: 'end' }
};

export default function Stereonet({
  slopeDip,
  slopeDipDir,
  jointSets = [],
  size = 300,
  frictionAngle = 30,
  wedgePossible = false,
  controllingPair = null,
  wedgeTrend = null,
  wedgePlunge = null
}: StereonetProps) {
  const radius = size / 2 - 20;
  const center = size / 2;
  const plotPadding = 20;

  const clampSvgPoint = (point: SvgPoint, padding: number = plotPadding): SvgPoint => ({
    x: Math.max(padding, Math.min(size - padding, point.x)),
    y: Math.max(padding, Math.min(size - padding, point.y))
  });

  const toSvgPoint = (x: number, y: number): SvgPoint => ({
    x: center + x * radius,
    y: center - y * radius
  });

  const toPath = (points: { x: number; y: number }[]) => {
    if (!points.length) return '';
    return points.map((p, i) => {
      const svg = toSvgPoint(p.x, p.y);
      return `${i === 0 ? 'M' : 'L'} ${svg.x} ${svg.y}`;
    }).join(' ');
  };

  const pointAt = (trend: number, plunge: number) => {
    const point = lineToStereonetXY(trend, plunge);
    return toSvgPoint(point.x, point.y);
  };

  const rimPoint = (trend: number, scale: number = 1) => {
    const point = lineToStereonetXY(trend, 0);
    return clampSvgPoint({
      x: center + point.x * radius * scale,
      y: center - point.y * radius * scale
    });
  };

  const labelPointForPole = (pole: SvgPoint, label: string) => {
    const placement = labelPlacements[label] || { dx: 8, dy: -8, anchor: 'start' as const };
    return {
      placement,
      point: clampSvgPoint({ x: pole.x + placement.dx, y: pole.y + placement.dy }, 14)
    };
  };

  const getPlaneRenderGeometry = (dip: number, dipDir: number) => {
    const points = planeToGreatCirclePoints(dip, dipDir);
    const pole = planeToPole(dip, dipDir);
    const poleProj = poleToStereonetXY(pole.trend, pole.plunge);
    const poleSvg = toSvgPoint(poleProj.x, poleProj.y);
    return { points, pole, poleProj, poleSvg };
  };

  const renderGrid = () => {
    const elements: React.ReactNode[] = [];
    elements.push(
      <defs key="defs">
        <marker id="slope-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        </marker>
      </defs>
    );
    elements.push(<circle key="outer" cx={center} cy={center} r={radius} fill="none" stroke="#ccc" strokeWidth="1" />);
    elements.push(<line key="v-line" x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#ccc" strokeWidth="1" />);
    elements.push(<line key="h-line" x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#ccc" strokeWidth="1" />);
    elements.push(<text key="N" x={center} y={center - radius - 5} textAnchor="middle" fontSize="10" fill="#666">N</text>);
    elements.push(<text key="E" x={center + radius + 5} y={center + 3} textAnchor="start" fontSize="10" fill="#666">E</text>);
    elements.push(<text key="S" x={center} y={center + radius + 12} textAnchor="middle" fontSize="10" fill="#666">S</text>);
    elements.push(<text key="W" x={center - radius - 5} y={center + 3} textAnchor="end" fontSize="10" fill="#666">W</text>);

    if (frictionAngle > 0 && frictionAngle < 90) {
      const frictionPoints = [];
      for (let i = 0; i <= 72; i++) {
        frictionPoints.push(lineToStereonetXY((i * 360) / 72, frictionAngle));
      }
      elements.push(
        <path
          key="friction-cone"
          d={toPath(frictionPoints)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />
      );
    }

    if (slopeDip !== undefined && slopeDipDir !== undefined) {
      const arrowStart = pointAt(slopeDipDir, Math.min(14, Math.max(6, slopeDip / 5)));
      const arrowEnd = rimPoint(slopeDipDir, 0.9);
      const arrowLabel = clampSvgPoint({
        x: arrowEnd.x + (arrowEnd.x >= center ? -18 : 18),
        y: arrowEnd.y + (arrowEnd.y >= center ? -8 : 12)
      }, 22);
      elements.push(
        <line
          key="slope-face-arrow"
          x1={arrowStart.x}
          y1={arrowStart.y}
          x2={arrowEnd.x}
          y2={arrowEnd.y}
          stroke="#dc2626"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity="0.45"
          markerEnd="url(#slope-arrow)"
        />
      );
      elements.push(
        <text
          key="slope-face-label"
          x={arrowLabel.x}
          y={arrowLabel.y}
          fontSize="8.5"
          fill="#dc2626"
          fontWeight="bold"
          textAnchor="middle"
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2"
        >
          Slope dip direction
        </text>
      );
    }

    return elements;
  };

  const renderPlane = (dip: number, dipDir: number, color: string, label: string) => {
    const { points, poleSvg } = getPlaneRenderGeometry(dip, dipDir);
    const { placement, point } = labelPointForPole(poleSvg, label);
    const isSlope = label === 'Slope';

    let slopeDipSideSegment = '';
    if (isSlope) {
      const dipPoint = lineToStereonetXY(dipDir, dip);
      const dipIndex = points.reduce((best, p, idx) => {
        const bestDist = (points[best].x - dipPoint.x) ** 2 + (points[best].y - dipPoint.y) ** 2;
        const thisDist = (p.x - dipPoint.x) ** 2 + (p.y - dipPoint.y) ** 2;
        return thisDist < bestDist ? idx : best;
      }, 0);
      const start = Math.max(0, dipIndex - 10);
      const end = Math.min(points.length, dipIndex + 11);
      slopeDipSideSegment = toPath(points.slice(start, end));
    }

    return (
      <g key={label}>
        <path
          d={toPath(points)}
          fill="none"
          stroke={color}
          strokeWidth={isSlope ? '1.4' : '1.2'}
          opacity={isSlope ? '0.5' : '0.72'}
        />
        {isSlope && slopeDipSideSegment && (
          <path
            d={slopeDipSideSegment}
            fill="none"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.95"
          />
        )}
        <circle
          cx={poleSvg.x}
          cy={poleSvg.y}
          r={isSlope ? '4.5' : '3.8'}
          fill={color}
          stroke="#fff"
          strokeWidth="1.2"
        />
        {isSlope && (
          <>
            <circle
              cx={poleSvg.x}
              cy={poleSvg.y}
              r="7.5"
              fill="none"
              stroke={color}
              strokeWidth="1.4"
              strokeOpacity="0.4"
            />
            <line
              x1={poleSvg.x}
              y1={poleSvg.y}
              x2={point.x + (placement.anchor === 'end' ? 6 : -6)}
              y2={point.y + 3}
              stroke={color}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
          </>
        )}
        <text
          x={point.x}
          y={point.y}
          fontSize="10"
          fill={color}
          fontWeight={isSlope ? 'bold' : 'normal'}
          textAnchor={placement.anchor}
          className="select-none pointer-events-none"
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2.5"
        >
          {isSlope ? 'Slope pole' : label}
        </text>
      </g>
    );
  };

  const renderWedgeIntersection = () => {
    if (!wedgePossible || wedgeTrend == null || wedgePlunge == null) return null;
    const wedgePoint = pointAt(wedgeTrend, wedgePlunge);
    const wedgeLabel = clampSvgPoint({
      x: wedgePoint.x + (wedgePoint.x >= center ? -12 : 12),
      y: wedgePoint.y + (wedgePoint.y >= center ? -12 : 12)
    }, 16);

    return (
      <g key="wedge-point">
        <circle
          cx={wedgePoint.x}
          cy={wedgePoint.y}
          r="6"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2.2"
        />
        <line
          x1={wedgePoint.x - 4}
          y1={wedgePoint.y - 4}
          x2={wedgePoint.x + 4}
          y2={wedgePoint.y + 4}
          stroke="#8b5cf6"
          strokeWidth="2"
        />
        <line
          x1={wedgePoint.x + 4}
          y1={wedgePoint.y - 4}
          x2={wedgePoint.x - 4}
          y2={wedgePoint.y + 4}
          stroke="#8b5cf6"
          strokeWidth="2"
        />
        <text
          x={wedgeLabel.x}
          y={wedgeLabel.y}
          fontSize="8.5"
          fill="#7c3aed"
          fontWeight="bold"
          textAnchor="middle"
          paintOrder="stroke"
          stroke="#fff"
          strokeWidth="2.5"
        >
          {controllingPair ? `WEDGE ${controllingPair}` : 'WEDGE'}
        </text>
      </g>
    );
  };

  const colors = ['#3b82f6', '#22c55e', '#f97316'];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="bg-white rounded-full shadow-sm border border-slate-200">
        {renderGrid()}
        {slopeDip !== undefined && slopeDipDir !== undefined && renderPlane(slopeDip, slopeDipDir, '#ef4444', 'Slope')}
        {jointSets.map((j, i) => renderPlane(j.dip, j.dipDir, colors[i % colors.length], j.id || `J${i + 1}`))}
        {renderWedgeIntersection()}
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs px-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <span className="text-slate-600">Red point = slope pole</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500"></div>
          <span className="text-slate-600">Red arrow = slope dip direction</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-red-500 border-dashed"></div>
          <span className="text-slate-600">Friction cone</span>
        </div>
        {wedgePossible && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 flex items-center justify-center border-2 border-violet-500 rounded-sm">
              <div className="w-2 h-0.5 bg-violet-500 rotate-45 absolute"></div>
              <div className="w-2 h-0.5 bg-violet-500 -rotate-45 absolute"></div>
            </div>
            <span className="text-slate-600">Wedge point</span>
          </div>
        )}
      </div>
    </div>
  );
}
