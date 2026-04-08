import type { GeometryOutputs, SuspensionModel } from '../model/types';

export function exportCSV(frontOutputs: GeometryOutputs[], rearOutputs: GeometryOutputs[]): string {
  const headers = [
    'travel', 'camber_f', 'toe_f', 'caster_f', 'kpi_f', 'scrub_radius_f',
    'mech_trail_f', 'rc_height_f', 'mr_spring_f', 'wheel_rate_f', 'spring_len_f',
    'camber_r', 'toe_r', 'rc_height_r', 'mr_spring_r', 'wheel_rate_r', 'spring_len_r',
  ];

  const rows = frontOutputs.map((fo, i) => {
    const ro = rearOutputs[i];
    return [
      fo.travel,
      fo.camber.toFixed(4), fo.toe.toFixed(4), fo.caster.toFixed(4), fo.kpi.toFixed(4),
      fo.scrubRadius.toFixed(2), fo.mechanicalTrail.toFixed(2), fo.rollCentreHeight.toFixed(2),
      fo.motionRatioSpring.toFixed(5), fo.wheelRate.toFixed(4), fo.springLength.toFixed(2),
      ro?.camber.toFixed(4) ?? '', ro?.toe.toFixed(4) ?? '', ro?.rollCentreHeight.toFixed(2) ?? '',
      ro?.motionRatioSpring.toFixed(5) ?? '', ro?.wheelRate.toFixed(4) ?? '', ro?.springLength.toFixed(2) ?? '',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportModelJSON(model: SuspensionModel): string {
  return JSON.stringify(model, null, 2);
}
