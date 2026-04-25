import React from 'react';

export function PileGeometryCard({
  verificationResult,
  torManual,
}: {
  verificationResult: any;
  torManual: boolean;
}) {
  const r: any = verificationResult || {};
  const fmt = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)} m` : '-');
  const fmtLen = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)} m` : '-');

  const badge = (kind: 'input' | 'calc' | 'missing') => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        kind === 'input'
          ? 'bg-emerald-50 text-emerald-800'
          : kind === 'calc'
            ? 'bg-indigo-50 text-indigo-800'
            : 'bg-rose-50 text-rose-800'
      }`}
    >
      {kind === 'input' ? 'from input' : kind === 'calc' ? 'calculated' : 'missing'}
    </span>
  );

  const casingInputOk = typeof r.casing_to_depth_m === 'number' && Number.isFinite(r.casing_to_depth_m);

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] font-bold uppercase text-zinc-500">Pile geometry (field view)</div>
      <div className="mt-1 text-[12px] text-zinc-600">
        Depths are metres below ground (m). This card is explanatory only and does not change calculations.
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Base of casing depth</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmt(r.casing_to_depth_m)}</div>
          <div className="mt-1">{casingInputOk ? badge('input') : badge('missing')}</div>
        </div>
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Top of rock (ToR)</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmt(r.actual_tor_depth_m)}</div>
          <div className="mt-1">{torManual ? badge('input') : badge('calc')}</div>
        </div>
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Final depth</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmt(r.actual_total_depth_m)}</div>
          <div className="mt-1">{badge('calc')}</div>
        </div>
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Base of socket</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmt(r.base_of_socket_depth_m ?? r.actual_total_depth_m)}</div>
          <div className="mt-1">{badge('calc')}</div>
        </div>
        <div className="rounded-lg border bg-white p-2 ring-1 ring-zinc-200">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Casing plunge into rock</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmtLen(r.plunge_length_actual_m)}</div>
          <div className="mt-1 text-[11px] text-zinc-600">Design: {fmtLen(r.required_plunge_length_m)}</div>
          <div className="mt-1">{casingInputOk && r.actual_tor_depth_m != null ? badge('calc') : badge('missing')}</div>
        </div>
        <div className="rounded-lg border bg-white p-2 ring-1 ring-zinc-200">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Socket length</div>
          <div className="mt-1 font-semibold text-zinc-900">
            {String(r.socket_basis || 'gross_socket') === 'net_competent_socket' ? fmtLen(r.net_socket_length_m) : fmtLen(r.gross_socket_length_m)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-600">Design: {fmtLen(r.required_socket_length_m)}</div>
          <div className="mt-1">{r.actual_total_depth_m != null && r.actual_tor_depth_m != null ? badge('calc') : badge('missing')}</div>
        </div>
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Weak band deduction</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmtLen(r.weak_band_deduction_m)}</div>
          <div className="mt-1">{badge('input')}</div>
        </div>
        <div className="rounded-lg border bg-zinc-50 p-2">
          <div className="text-[11px] font-bold uppercase text-zinc-500">Overdrill</div>
          <div className="mt-1 font-semibold text-zinc-900">{fmtLen(r.overdrill_length_m)}</div>
          <div className="mt-1 text-[11px] text-zinc-600">Limit: {fmtLen(r.max_overdrill_m)}</div>
          <div className="mt-1">{r.overdrill_length_m != null ? badge('calc') : badge('missing')}</div>
        </div>
      </div>
    </div>
  );
}
