import React from 'react';
import { GroundwaterCondition } from '../utils/wedgeFoS';
import {
  ANCHOR_CAPACITY_OPTIONS,
  ANCHOR_EFFECTIVENESS_OPTIONS,
  BOLT_CAPACITY_OPTIONS,
  BOLT_EFFECTIVENESS_OPTIONS,
  COHESION_OPTIONS,
  GROUNDWATER_OPTIONS,
  JOINT_FRICTION_OPTIONS,
  PERSISTENCE_FACTOR_OPTIONS,
  SHOTCRETE_REDUCTION_OPTIONS,
  SHOTCRETE_SHEAR_STRENGTH_OPTIONS,
  SHOTCRETE_THICKNESS_OPTIONS,
  UNIT_WEIGHT_OPTIONS,
} from '../config/engineeringParameters';

type WeightMode = 'Manual' | 'Estimate';
type SupportType =
  | 'None'
  | 'Shotcrete only'
  | 'Bolt only'
  | 'Bolt + Shotcrete'
  | 'Anchor / Cable'
  | 'Combined system';

interface WedgeFoSParameterPanelProps {
  controllingPair: string | null | undefined;
  wedgePlunge: number | null | undefined;
  wedgeTrend: number | null | undefined;
  weightMode: WeightMode;
  setWeightMode: (value: WeightMode) => void;
  weight: string;
  setWeight: (value: string) => void;
  wedgeHeight: string;
  setWedgeHeight: (value: string) => void;
  s1: string;
  setS1: (value: string) => void;
  s2: string;
  setS2: (value: string) => void;
  persistenceSelection: number | '';
  setPersistenceSelection: (value: number) => void;
  persistenceFactor: string;
  setPersistenceFactor: (value: string) => void;
  unitWeightSelection: number | '';
  setUnitWeightSelection: (value: number) => void;
  unitWeight: string;
  setUnitWeight: (value: string) => void;
  frictionSelection: number | '';
  setFrictionSelection: (value: number) => void;
  frictionAngle: string;
  setFrictionAngle: (value: string) => void;
  cohesionSelection: number | '';
  setCohesionSelection: (value: number) => void;
  cohesion: string;
  setCohesion: (value: string) => void;
  groundwater: GroundwaterCondition | 'Custom';
  setGroundwater: (value: GroundwaterCondition | 'Custom') => void;
  customGroundwaterPressure: string;
  setCustomGroundwaterPressure: (value: string) => void;
  supportType: SupportType;
  setSupportType: (value: SupportType) => void;
  shotcreteTraceLength: string;
  setShotcreteTraceLength: (value: string) => void;
  shotcreteThicknessSelection: number | '';
  setShotcreteThicknessSelection: (value: number) => void;
  shotcreteThickness: string;
  setShotcreteThickness: (value: string) => void;
  shotcreteShearSelection: number | '';
  setShotcreteShearSelection: (value: number) => void;
  shotcreteShearStrength: string;
  setShotcreteShearStrength: (value: string) => void;
  shotcreteReductionSelection: number | '';
  setShotcreteReductionSelection: (value: number) => void;
  shotcreteReduction: string;
  setShotcreteReduction: (value: string) => void;
  boltCapacitySelection: number | '';
  setBoltCapacitySelection: (value: number) => void;
  boltCapacity: string;
  setBoltCapacity: (value: string) => void;
  boltNumber: string;
  setBoltNumber: (value: string) => void;
  boltTrend: string;
  setBoltTrend: (value: string) => void;
  boltPlunge: string;
  setBoltPlunge: (value: string) => void;
  boltEffectivenessSelection: number | '';
  setBoltEffectivenessSelection: (value: number) => void;
  boltEffectiveness: string;
  setBoltEffectiveness: (value: string) => void;
  anchorCapacitySelection: number | '';
  setAnchorCapacitySelection: (value: number) => void;
  anchorForce: string;
  setAnchorForce: (value: string) => void;
  anchorNumber: string;
  setAnchorNumber: (value: string) => void;
  anchorTrend: string;
  setAnchorTrend: (value: string) => void;
  anchorPlunge: string;
  setAnchorPlunge: (value: string) => void;
  anchorEffectivenessSelection: number | '';
  setAnchorEffectivenessSelection: (value: number) => void;
  anchorEffectiveness: string;
  setAnchorEffectiveness: (value: string) => void;
  showShotcreteWarning: boolean;
}

const formatOrientation = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0.0';

export const WedgeFoSParameterPanel: React.FC<WedgeFoSParameterPanelProps> = ({
  controllingPair,
  wedgePlunge,
  wedgeTrend,
  weightMode,
  setWeightMode,
  weight,
  setWeight,
  wedgeHeight,
  setWedgeHeight,
  s1,
  setS1,
  s2,
  setS2,
  persistenceSelection,
  setPersistenceSelection,
  persistenceFactor,
  setPersistenceFactor,
  unitWeightSelection,
  setUnitWeightSelection,
  unitWeight,
  setUnitWeight,
  frictionSelection,
  setFrictionSelection,
  frictionAngle,
  setFrictionAngle,
  cohesionSelection,
  setCohesionSelection,
  cohesion,
  setCohesion,
  groundwater,
  setGroundwater,
  customGroundwaterPressure,
  setCustomGroundwaterPressure,
  supportType,
  setSupportType,
  shotcreteTraceLength,
  setShotcreteTraceLength,
  shotcreteThicknessSelection,
  setShotcreteThicknessSelection,
  shotcreteThickness,
  setShotcreteThickness,
  shotcreteShearSelection,
  setShotcreteShearSelection,
  shotcreteShearStrength,
  setShotcreteShearStrength,
  shotcreteReductionSelection,
  setShotcreteReductionSelection,
  shotcreteReduction,
  setShotcreteReduction,
  boltCapacitySelection,
  setBoltCapacitySelection,
  boltCapacity,
  setBoltCapacity,
  boltNumber,
  setBoltNumber,
  boltTrend,
  setBoltTrend,
  boltPlunge,
  setBoltPlunge,
  boltEffectivenessSelection,
  setBoltEffectivenessSelection,
  boltEffectiveness,
  setBoltEffectiveness,
  anchorCapacitySelection,
  setAnchorCapacitySelection,
  anchorForce,
  setAnchorForce,
  anchorNumber,
  setAnchorNumber,
  anchorTrend,
  setAnchorTrend,
  anchorPlunge,
  setAnchorPlunge,
  anchorEffectivenessSelection,
  setAnchorEffectivenessSelection,
  anchorEffectiveness,
  setAnchorEffectiveness,
  showShotcreteWarning,
}) => {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-100 pb-2">
        Wedge Stability Parameters
      </h3>

      <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 rounded-lg border border-zinc-100 text-sm mb-6">
        <div>
          <span className="block text-[10px] font-bold text-zinc-500 uppercase">Controlling Pair</span>
          <span className="font-mono font-bold text-zinc-700">{controllingPair || 'N/A'}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-zinc-500 uppercase">Sliding Plunge/Trend</span>
          <span className="font-mono font-bold text-zinc-700">
            {formatOrientation(wedgePlunge)} deg / {formatOrientation(wedgeTrend)} deg
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Wedge Weight Mode</label>
          <select
            value={weightMode}
            onChange={(e) => setWeightMode(e.target.value as WeightMode)}
            className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
          >
            <option value="Manual">Manual</option>
            <option value="Estimate">Estimate from geometry</option>
          </select>
        </div>
        {weightMode === 'Manual' ? (
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Wedge Weight (kN)</label>
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Wedge Exposure Height (m)</label>
              <input
                type="text"
                inputMode="decimal"
                value={wedgeHeight}
                onChange={(e) => setWedgeHeight(e.target.value)}
                className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Joint 1 Spacing S1 (m)</label>
              <input
                type="text"
                inputMode="decimal"
                value={s1}
                onChange={(e) => setS1(e.target.value)}
                className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Joint 2 Spacing S2 (m)</label>
              <input
                type="text"
                inputMode="decimal"
                value={s2}
                onChange={(e) => setS2(e.target.value)}
                className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Joint Persistence</label>
              <select
                value={persistenceSelection}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPersistenceSelection(val);
                  if (val !== -1) setPersistenceFactor(String(val));
                }}
                className="w-full p-2 border border-zinc-200 rounded-lg mb-2 text-sm"
              >
                <option value="">Select reference value...</option>
                {PERSISTENCE_FACTOR_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label} {opt.value !== -1 ? `(${opt.value})` : ''}
                  </option>
                ))}
              </select>
              {persistenceSelection === -1 && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={persistenceFactor}
                  onChange={(e) => setPersistenceFactor(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                  placeholder="Manual override"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Unit Weight (kN/m3)</label>
              <select
                value={unitWeightSelection}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setUnitWeightSelection(val);
                  if (val !== -1) setUnitWeight(String(val));
                }}
                className="w-full p-2 border border-zinc-200 rounded-lg mb-2 text-sm"
              >
                <option value="">Select reference value...</option>
                {UNIT_WEIGHT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label} {opt.value !== -1 ? `(${opt.value} kN/m3)` : ''}
                  </option>
                ))}
              </select>
              {unitWeightSelection === -1 && (
                <input
                  type="text"
                  inputMode="decimal"
                  value={unitWeight}
                  onChange={(e) => setUnitWeight(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                  placeholder="Manual override"
                />
              )}
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Friction Angle (deg)</label>
          <select
            className="w-full p-2 border border-zinc-200 rounded-lg mb-2 text-sm"
            onChange={(e) => {
              const val = Number(e.target.value);
              setFrictionSelection(val);
              if (val !== -1) setFrictionAngle(String(val));
            }}
            value={frictionSelection}
          >
            <option value="">Select reference value...</option>
            {JOINT_FRICTION_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label} {opt.value !== -1 ? `(${opt.value} deg)` : ''}
              </option>
            ))}
          </select>
          {frictionSelection === -1 && (
            <input
              type="text"
              inputMode="decimal"
              value={frictionAngle}
              onChange={(e) => setFrictionAngle(e.target.value)}
              className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
              placeholder="Manual override"
            />
          )}
          <p className="text-[10px] text-zinc-400 mt-1">Typical rock joint friction angles range from 15 deg to 40 deg.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Cohesion (kPa)</label>
          <select
            className="w-full p-2 border border-zinc-200 rounded-lg mb-2 text-sm"
            onChange={(e) => {
              const val = Number(e.target.value);
              setCohesionSelection(val);
              if (val !== -1) setCohesion(String(val));
            }}
            value={cohesionSelection}
          >
            <option value="">Select reference value...</option>
            {COHESION_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label} {opt.value >= 0 ? `(${opt.value} kPa)` : ''}
              </option>
            ))}
          </select>
          {cohesionSelection === -1 && (
            <input
              type="text"
              inputMode="decimal"
              value={cohesion}
              onChange={(e) => setCohesion(e.target.value)}
              className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
              placeholder="Manual override"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Groundwater</label>
          <select
            value={groundwater}
            onChange={(e) => setGroundwater(e.target.value as GroundwaterCondition | 'Custom')}
            className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
          >
            {GROUNDWATER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {(groundwater === 'Pressurized' || groundwater === 'Custom') && (
            <input
              type="text"
              inputMode="decimal"
              value={customGroundwaterPressure}
              onChange={(e) => setCustomGroundwaterPressure(e.target.value)}
              className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
              placeholder="Pressure head / water head (m)"
            />
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-zinc-100">
        <h4 className="text-xs font-bold text-zinc-800 mb-4 uppercase tracking-wider">Support Estimation</h4>
        <div className="mb-4">
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Support Type</label>
          <select
            value={supportType}
            onChange={(e) => setSupportType(e.target.value as SupportType)}
            className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
          >
            <option value="None">None</option>
            <option value="Shotcrete only">Shotcrete only</option>
            <option value="Bolt only">Bolt only</option>
            <option value="Bolt + Shotcrete">Bolt + Shotcrete</option>
            <option value="Anchor / Cable">Anchor / Cable</option>
            <option value="Combined system">Combined system</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(supportType === 'Shotcrete only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') && (
            <>
              <div className="md:col-span-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-100 pb-1">Shotcrete Support</div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Shotcrete Trace Length (m)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={shotcreteTraceLength}
                  onChange={(e) => setShotcreteTraceLength(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Shotcrete Thickness (mm)</label>
                <select
                  value={shotcreteThicknessSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShotcreteThicknessSelection(val);
                    if (val !== -1) setShotcreteThickness(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {SHOTCRETE_THICKNESS_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {shotcreteThicknessSelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shotcreteThickness}
                    onChange={(e) => setShotcreteThickness(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom thickness (mm)"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Shotcrete Shear Strength (kPa)</label>
                <select
                  value={shotcreteShearSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShotcreteShearSelection(val);
                    if (val !== -1) setShotcreteShearStrength(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {SHOTCRETE_SHEAR_STRENGTH_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {shotcreteShearSelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shotcreteShearStrength}
                    onChange={(e) => setShotcreteShearStrength(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom strength (kPa)"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Shotcrete Reduction Factor</label>
                <select
                  value={shotcreteReductionSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShotcreteReductionSelection(val);
                    if (val !== -1) setShotcreteReduction(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {SHOTCRETE_REDUCTION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}{opt.value !== -1 ? ` (${opt.value})` : ''}
                    </option>
                  ))}
                </select>
                {shotcreteReductionSelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shotcreteReduction}
                    onChange={(e) => setShotcreteReduction(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom reduction factor"
                  />
                )}
              </div>
            </>
          )}

          {(supportType === 'Bolt only' || supportType === 'Bolt + Shotcrete' || supportType === 'Combined system') && (
            <>
              <div className="md:col-span-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-100 pb-1">Bolt Support</div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Bolt Capacity (kN)</label>
                <select
                  value={boltCapacitySelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBoltCapacitySelection(val);
                    if (val !== -1) setBoltCapacity(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {BOLT_CAPACITY_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {boltCapacitySelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={boltCapacity}
                    onChange={(e) => setBoltCapacity(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom capacity (kN)"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Bolt Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={boltNumber}
                  onChange={(e) => setBoltNumber(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Bolt Trend (deg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={boltTrend}
                  onChange={(e) => setBoltTrend(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Bolt Plunge (deg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={boltPlunge}
                  onChange={(e) => setBoltPlunge(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Bolt Effectiveness</label>
                <select
                  value={boltEffectivenessSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBoltEffectivenessSelection(val);
                    if (val !== -1) setBoltEffectiveness(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {BOLT_EFFECTIVENESS_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {boltEffectivenessSelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={boltEffectiveness}
                    onChange={(e) => setBoltEffectiveness(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom effectiveness"
                  />
                )}
              </div>
            </>
          )}

          {(supportType === 'Anchor / Cable' || supportType === 'Combined system') && (
            <>
              <div className="md:col-span-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600 border-b border-zinc-100 pb-1">Anchor / Cable Support</div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Anchor Capacity (kN)</label>
                <select
                  value={anchorCapacitySelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAnchorCapacitySelection(val);
                    if (val !== -1) setAnchorForce(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {ANCHOR_CAPACITY_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {anchorCapacitySelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={anchorForce}
                    onChange={(e) => setAnchorForce(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom capacity (kN)"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Anchor Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={anchorNumber}
                  onChange={(e) => setAnchorNumber(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Anchor Trend (deg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={anchorTrend}
                  onChange={(e) => setAnchorTrend(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Anchor Plunge (deg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={anchorPlunge}
                  onChange={(e) => setAnchorPlunge(e.target.value)}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Anchor Effectiveness</label>
                <select
                  value={anchorEffectivenessSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAnchorEffectivenessSelection(val);
                    if (val !== -1) setAnchorEffectiveness(String(val));
                  }}
                  className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {ANCHOR_EFFECTIVENESS_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {anchorEffectivenessSelection === -1 && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={anchorEffectiveness}
                    onChange={(e) => setAnchorEffectiveness(e.target.value)}
                    className="w-full p-2 border border-zinc-200 rounded-lg text-sm mt-1"
                    placeholder="Custom effectiveness"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {showShotcreteWarning && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
            Shotcrete contribution appears unusually high. Check thickness units and support assumptions.
          </div>
        )}
      </div>
    </div>
  );
};
