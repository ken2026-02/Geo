import { entryRepo } from '../repositories/entryRepo';
import { projectRepo } from '../repositories/projectRepo';
import { mediaRepo } from '../repositories/mediaRepo';
import { bearingCapacityRepo } from '../repositories/bearingCapacityRepo';
import { BEARING_BASIS_LIBRARY, DISTRIBUTION_PRESETS } from '../config/bearingCapacityBasis';
import { getEntryTypeLabel } from './entryTypes';

/**
 * Download a string as a file.
 */
function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export entries as CSV.
 */
export function exportEntriesCSV(projectId: string) {
  const entries = entryRepo.listByProject(projectId);
  const headers = ['Timestamp', 'Location', 'Type', 'Summary', 'Risk', 'Status'];
  const rows = entries.map(e => [
    new Date(e.timestamp).toLocaleString(),
    `${e.chainage_start}-${e.chainage_end} ${e.side} | ${e.position}`,
    getEntryTypeLabel(e.entry_type_id),
    `"${(e.summary || '').replace(/"/g, '""')}"`,
    e.risk_label,
    e.status
  ]);

  const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadFile(csvContent, `entries-project-${projectId}.csv`, 'text/csv');
}

/**
 * Export actions as CSV.
 */
export function exportActionsCSV(projectId: string) {
  const entries = entryRepo.listByProject(projectId).filter(e => e.status === 'Open' || e.status_id === 'ST_OPEN');
  const headers = ['Timestamp', 'Location', 'Type', 'Action Required', 'Risk'];
  const rows = entries.map(e => [
    new Date(e.timestamp).toLocaleString(),
    `${e.chainage_start}-${e.chainage_end} ${e.side} | ${e.position}`,
    getEntryTypeLabel(e.entry_type_id),
    `"${(e.summary || '').replace(/"/g, '""')}"`,
    e.risk_label
  ]);

  const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadFile(csvContent, `actions-project-${projectId}.csv`, 'text/csv');
}

/**
 * Generate a project summary report.
 */
function openPrintWindow(title: string, html: string) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateProjectSummary(projectId: string) {
  const project = projectRepo.getById(projectId);
  const entries = entryRepo.listByProject(projectId);
  const openActions = entries.filter(e => e.status === 'Open' || e.status_id === 'ST_OPEN').length;
  const highRisk = entries.filter(e => e.risk_level_id === 'R3' || e.risk_level_id === 'R4').length;
  const recentEntries = entries.slice(0, 10);

  const riskDist = entries.reduce((acc, e) => {
    acc[e.risk_label] = (acc[e.risk_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const html = `
    <html>
      <head>
        <title>Project Summary - ${project?.code || projectId}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; padding: 32px; background: #f8fafc; }
          h1,h2 { margin: 0 0 12px; }
          .sub { color: #6b7280; margin-bottom: 24px; }
          .hero { background: linear-gradient(135deg, #ecfeff, #eef2ff); border: 1px solid #dbeafe; border-radius: 18px; padding: 22px; margin-bottom: 24px; }
          .hero-title { font-size: 28px; font-weight: 800; margin: 0 0 6px; }
          .hero-sub { color: #475569; font-size: 13px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
          .label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; }
          .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 10px 8px; font-size: 12px; vertical-align: top; }
          th { text-transform: uppercase; color: #6b7280; font-size: 11px; }
          .pill { display:inline-block; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 700; background:#f3f4f6; }
          .section { margin-top: 28px; }
          .no-print { text-align:right; margin-bottom:16px; }
          @media print { .no-print { display:none; } body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
        <div class="hero">
          <div class="hero-title">Project Delivery Summary</div>
          <div class="hero-sub">${escapeHtml(project?.name || 'Unknown project')} (${escapeHtml(project?.code || projectId)}) &middot; Generated ${escapeHtml(new Date().toLocaleString())}</div>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Total records</div><div class="value">${entries.length}</div></div>
          <div class="card"><div class="label">Open actions</div><div class="value">${openActions}</div></div>
          <div class="card"><div class="label">High / critical</div><div class="value">${highRisk}</div></div>
          <div class="card"><div class="label">Entry types</div><div class="value">${new Set(entries.map(e => e.entry_type_id)).size}</div></div>
        </div>
        <div class="section">
          <h2>Risk distribution overview</h2>
          <table>
            <thead><tr><th>Risk</th><th>Count</th></tr></thead>
            <tbody>${Object.entries(riskDist).map(([risk, count]) => `<tr><td>${escapeHtml(risk)}</td><td>${count}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="section">
          <h2>Recent field records and engineering logs</h2>
          <table>
            <thead><tr><th>Time</th><th>Location</th><th>Type</th><th>Risk</th><th>Summary</th></tr></thead>
            <tbody>${recentEntries.map(e => `<tr><td>${escapeHtml(new Date(e.timestamp).toLocaleString())}</td><td>${escapeHtml(`${e.chainage_start}-${e.chainage_end} ${e.side} ${e.position}`)}</td><td>${escapeHtml(getEntryTypeLabel(e.entry_type_id))}</td><td><span class="pill">${escapeHtml(e.risk_label)}</span></td><td>${escapeHtml(e.summary || '')}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  openPrintWindow(`Project Summary - ${project?.code || projectId}`, html);
}

/**
 * Export Photo Sheet (HTML for printing).
 */
export function exportPhotoSheet(projectId: string) {
  const entries = entryRepo.listByProject(projectId);
  const photos = entries.flatMap(e => {
    const media = mediaRepo.listByEntry(e.id);
    return media.map(m => ({ ...m, entry: e }));
  });

  const html = `
    <html>
      <head>
        <title>Photo Sheet - Project ${projectId}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .photo-card { border: 1px solid #ccc; padding: 10px; page-break-inside: avoid; }
          .photo-card img { width: 100%; height: 200px; object-fit: cover; }
          .caption { font-size: 12px; margin-top: 10px; }
          h1 { text-align: center; }
          .no-print { text-align: center; margin-bottom: 20px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer;">Return to App</button>
        </div>
        <div style="background:linear-gradient(135deg,#eff6ff,#f8fafc);border:1px solid #dbeafe;border-radius:16px;padding:18px;margin-bottom:20px;text-align:center;"><h1 style="margin:0;">Photo Sheet</h1><div style="margin-top:6px;font-size:12px;color:#475569;">Project ${escapeHtml(projectId)} field photo record</div></div>
        <div class="photo-grid">
          ${photos.map(p => `
            <div class="photo-card">
              <img src="${p.data_url}" />
              <div class="caption">
                <strong>Location:</strong> ${escapeHtml(`${p.entry.chainage_start}-${p.entry.chainage_end} ${p.entry.side}`)}<br/>
                <strong>Summary:</strong> ${escapeHtml(p.entry.summary)}<br/>
                <strong>Caption:</strong> ${escapeHtml(p.caption || 'No caption')}<br/>
                <strong>Date:</strong> ${escapeHtml(new Date(p.entry.timestamp).toLocaleString())}
              </div>
            </div>
          `).join('')}
        </div>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `;

  openPrintWindow(`Photo Sheet - Project ${projectId}`, html);
}

const buildChartPath = (values: number[], maxValue: number, width: number, height: number): string => {
  if (!values.length || maxValue <= 0) return '';
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const formatDistributionRatio = (value: number | null | undefined) => `1V:${(value ?? 0).toFixed(2)}H`;

type BearingAppendixRecord = {
  code: string;
  title: string;
  definition: string;
  guidance: string;
  source: string;
  usedIn: string[];
  formula?: string;
  category: string;
  sectionId?: string;
};

const getBearingBasisAppendix = (distributionBasisIds: string[]) => {
  const distributionRecords: BearingAppendixRecord[] = distributionBasisIds
    .map((id) => {
      const preset = DISTRIBUTION_PRESETS[id as keyof typeof DISTRIBUTION_PRESETS];
      if (!preset) return null;
      return {
        code: `BC-DIST-${id.toUpperCase()}`,
        category: 'distribution',
        title: preset.label,
        definition: 'Linear load distribution ratio',
        guidance: preset.guidance,
        source: preset.source,
        usedIn: ['Platform > Distribution basis', 'Soil profile > Distribution basis', 'Report > Soil Layers'],
      };
    })
    .filter((item): item is BearingAppendixRecord => Boolean(item));

  return [...BEARING_BASIS_LIBRARY, ...distributionRecords] satisfies BearingAppendixRecord[];
};

const getUsedInText = (item: { usedIn?: string[] }) => (Array.isArray(item.usedIn) ? item.usedIn.join('; ') : '');

export function exportBearingCapacityReport(entryId: string) {
  const entry = entryRepo.getWithDetails(entryId);
  const bearing = bearingCapacityRepo.getByEntryId(entryId);
  if (!entry || !bearing || !bearing.result) {
    window.alert('Bearing capacity report data is not available for this entry.');
    return;
  }
  const project = projectRepo.getById(entry.project_id);
  const entryLocation = (entry as typeof entry & {
    location?: {
      chainage_start?: number | string;
      chainage_end?: number | string;
      side?: string;
      position?: string;
    };
  }).location;
  const projectText = project?.name || project?.code || entry.project_id;
  const locationParts = [
    entryLocation?.chainage_start != null && entryLocation?.chainage_end != null
      ? `${entryLocation.chainage_start}-${entryLocation.chainage_end}`
      : '',
    entryLocation?.side || '',
    entryLocation?.position || '',
  ].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(' ') : entry.location_id;

  const allLayers = [bearing.platform, ...bearing.layers].filter(Boolean);
  const maxChartValue = Math.max(
    ...(bearing.chart?.pressureLinear || [0]),
    ...(bearing.chart?.pressureWestergaard || [0]),
    ...(bearing.chart?.pressureBoussinesq || [0]),
    ...(bearing.chart?.allowableStep || [0]),
    1
  );
  const chartWidth = 760;
  const chartHeight = 280;
  const chart = bearing.chart;
  const basisAppendix = getBearingBasisAppendix([
    bearing.platform.distributionBasisId,
    ...bearing.layers.map((layer) => layer.distributionBasisId),
  ]);

  const html = `
    <html>
      <head>
        <title>Bearing Capacity Report - ${escapeHtml(bearing.title || entryId)}</title>
        <style>
          @page { margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; background: #f8fafc; }
          .no-print { text-align:right; margin-bottom:16px; }
          .hero { display:grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-bottom: 18px; }
          .card { border:1px solid #d1d5db; border-radius:12px; padding:14px; background:#fff; }
          .hero-title { font-size:22px; font-weight:800; margin-bottom:6px; }
          .label { font-size:11px; text-transform:uppercase; color:#6b7280; font-weight:700; }
          .value { font-size:13px; font-weight:600; color:#111827; margin-top:4px; }
          .meta-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .section { margin-top: 24px; }
          h2 { margin: 0 0 10px; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
          th, td { border-bottom:1px solid #e5e7eb; text-align:left; padding:7px 7px; font-size:11px; vertical-align:top; }
          th { background:#f8fafc; text-transform:uppercase; color:#6b7280; font-size:10px; letter-spacing: .02em; }
          tr { break-inside: avoid; }
          .ok { color:#047857; font-weight:700; }
          .fail { color:#b91c1c; font-weight:700; }
          .chart-wrap { border:1px solid #e5e7eb; border-radius:14px; background:#fff; padding:16px; }
          .legend { display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; font-size:11px; color:#475569; }
          .legend span { display:inline-flex; align-items:center; gap:6px; }
          .dot { width:10px; height:2px; display:inline-block; }
          .note { white-space: pre-line; background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:16px; font-size:13px; }
          .badge { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:3px 8px; font-size:10px; font-weight:700; color:#475569; background:#f8fafc; }
          .appendix-block { margin-top: 12px; }
          .appendix-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color:#475569; margin: 0 0 8px; }
          .page-break { page-break-before: always; break-before: page; }
          @media print { .no-print { display:none; } body { padding: 12px; } }
        </style>
      </head>
      <body>
        <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
        <div class="hero">
          <div class="card">
            <div class="hero-title">Bearing Capacity Report</div>
            <div class="value">${escapeHtml(bearing.title || 'Tracked plant / platform bearing check')}</div>
            <div class="value">${escapeHtml(bearing.geotech_ref || '')}</div>
            <div style="margin-top:10px"><span class="badge">Platform bearing check</span></div>
          </div>
          <div class="card">
            <div class="meta-grid">
              <div><div class="label">Project</div><div class="value">${escapeHtml(projectText)}</div></div>
              <div><div class="label">Location</div><div class="value">${escapeHtml(locationText)}</div></div>
              <div><div class="label">Machinery</div><div class="value">${escapeHtml(bearing.machinery || '')}</div></div>
              <div><div class="label">Date</div><div class="value">${escapeHtml(bearing.assessment_date || '')}</div></div>
              <div><div class="label">Prepared By</div><div class="value">${escapeHtml(bearing.prepared_by || entry.author || '')}</div></div>
              <div><div class="label">Result</div><div class="value">${bearing.overall_pass ? 'Pass' : 'Review required'}</div></div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Key Inputs</h2>
          <table>
            <thead><tr><th>P - Pressure (kPa)</th><th>L - Track Length (m)</th><th>B - Track Width (m)</th><th>D - Platform Thickness (m)</th><th>Bearing FOS</th></tr></thead>
            <tbody><tr><td>${(bearing.pressure_kpa ?? 0).toFixed(1)}</td><td>${(bearing.track_length_m ?? 0).toFixed(3)}</td><td>${(bearing.track_width_m ?? 0).toFixed(3)}</td><td>${(bearing.platform_thickness_m ?? 0).toFixed(3)}</td><td>${(bearing.factor_of_safety ?? 0).toFixed(2)}</td></tr></tbody>
          </table>
        </div>

        <div class="section">
          <h2>Soil Layers</h2>
          <table>
            <thead><tr><th>Layer</th><th>Description</th><th>Thickness</th><th>Su</th><th>phi</th><th>c</th><th>gamma</th><th>nu</th><th>Distribution</th></tr></thead>
            <tbody>
              ${allLayers.map((layer) => `
                <tr>
                  <td>${escapeHtml(layer?.name || '')}</td>
                  <td>${escapeHtml(layer?.description || '')}</td>
                  <td>${(layer?.thicknessM ?? 0).toFixed(2)}</td>
                  <td>${(layer?.suKPa ?? 0).toFixed(1)}</td>
                  <td>${(layer?.phiDeg ?? 0).toFixed(1)}</td>
                  <td>${(layer?.cKPa ?? 0).toFixed(1)}</td>
                  <td>${(layer?.gammaKNm3 ?? 0).toFixed(1)}</td>
                  <td>${(layer?.nu ?? 0).toFixed(2)}</td>
                  <td>${formatDistributionRatio(layer?.distributionRatio)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Bearing Check</h2>
          <table>
            <thead><tr><th>Layer</th><th>Base Depth (m)</th><th>Qall (kPa)</th><th>Linear</th><th>Westergaard</th><th>Boussinesq</th></tr></thead>
            <tbody>
              ${bearing.result.layerChecks.map((check) => `
                <tr>
                  <td>${escapeHtml(check.layerName)}</td>
                  <td>${check.baseDepthM.toFixed(2)}</td>
                  <td>${check.bearing.qall.toFixed(1)}</td>
                  <td class="${check.pass.linear ? 'ok' : 'fail'}">${check.stress.linear.toFixed(1)} ${check.pass.linear ? 'Ok' : 'Not ok'}</td>
                  <td class="${check.pass.westergaard ? 'ok' : 'fail'}">${check.stress.westergaard.toFixed(1)} ${check.pass.westergaard ? 'Ok' : 'Not ok'}</td>
                  <td class="${check.pass.boussinesq ? 'ok' : 'fail'}">${check.stress.boussinesq.toFixed(1)} ${check.pass.boussinesq ? 'Ok' : 'Not ok'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Pressure / Bearing Capacity Profile</h2>
          <div class="chart-wrap">
            <svg viewBox="0 0 ${chartWidth + 60} ${chartHeight + 40}" width="100%" height="340" role="img" aria-label="Bearing chart">
              <g transform="translate(40,10)">
                <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#e5e7eb" />
                <path d="${buildChartPath(chart?.pressureLinear || [], maxChartValue, chartWidth, chartHeight)}" fill="none" stroke="#6b7280" stroke-width="2" />
                <path d="${buildChartPath(chart?.pressureWestergaard || [], maxChartValue, chartWidth, chartHeight)}" fill="none" stroke="#f97316" stroke-width="2" />
                <path d="${buildChartPath(chart?.pressureBoussinesq || [], maxChartValue, chartWidth, chartHeight)}" fill="none" stroke="#2563eb" stroke-width="2" />
                <path d="${buildChartPath(chart?.allowableStep || [], maxChartValue, chartWidth, chartHeight)}" fill="none" stroke="#eab308" stroke-width="2.5" />
              </g>
            </svg>
            <div class="legend">
              <span><i class="dot" style="background:#6b7280"></i> Linear</span>
              <span><i class="dot" style="background:#f97316"></i> Westergaard</span>
              <span><i class="dot" style="background:#2563eb"></i> Boussinesq</span>
              <span><i class="dot" style="background:#eab308"></i> Allowable Bearing Capacity</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Bearing Capacity Factors / Allowables</h2>
          <table>
            <thead><tr><th>Layer</th><th>Overburden (kPa)</th><th>Nq</th><th>Nc</th><th>Ngamma</th><th>Qult (kPa)</th><th>Qall (kPa)</th></tr></thead>
            <tbody>
              ${bearing.result.layerChecks.map((check) => `
                <tr>
                  <td>${escapeHtml(check.layerName)}</td>
                  <td>${check.bearing.overburdenKPa.toFixed(1)}</td>
                  <td>${check.bearing.nq.toFixed(2)}</td>
                  <td>${check.bearing.nc.toFixed(2)}</td>
                  <td>${check.bearing.ngamma.toFixed(2)}</td>
                  <td>${check.bearing.qult.toFixed(1)}</td>
                  <td>${check.bearing.qall.toFixed(1)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${bearing.notes ? `<div class="section"><h2>Assessment Note</h2><div class="note">${escapeHtml(bearing.notes)}</div></div>` : ''}

        <div class="section page-break">
          <h2>Basis / Source Appendix</h2>
          ${[
            ['inputs', 'Inputs'],
            ['distribution', 'Distribution'],
            ['bearing', 'Bearing'],
            ['stress', 'Stress methods'],
            ['reporting', 'Reporting'],
          ].map(([key, label]) => {
            const rows = basisAppendix.filter((item) => item.category === key);
            if (!rows.length) return '';
            return `
              <div class="appendix-block">
                <div class="appendix-title">${escapeHtml(label)}</div>
                <table>
                  <thead><tr><th>Code</th><th>Title</th><th>Used In</th><th>Definition</th><th>Guidance</th><th>Formula</th><th>Source</th></tr></thead>
                  <tbody>
                    ${rows.map((item) => `
                      <tr>
                        <td>${escapeHtml(item.code)}</td>
                        <td>${escapeHtml(item.title)}</td>
                        <td>${escapeHtml(getUsedInText(item))}</td>
                        <td>${escapeHtml(item.definition)}</td>
                        <td>${escapeHtml(item.guidance)}</td>
                        <td>${escapeHtml(item.formula || '')}</td>
                        <td>${escapeHtml(item.source)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </body>
    </html>
  `;

  openPrintWindow(`Bearing Capacity Report - ${bearing.title || entryId}`, html);
}

