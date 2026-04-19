export interface Location {
  id: string;
  chainage_start: number;
  chainage_end: number;
  side: 'LHS' | 'RHS' | 'CL';
  position: 'Toe' | 'Mid' | 'Crest' | 'Face' | 'Bench';
  description?: string;
}

export function formatLocationShort(loc: Location | any): string {
  if (!loc) return 'Unknown Location';
  const start = loc.chainage_start;
  const end = loc.chainage_end !== undefined && loc.chainage_end !== null ? loc.chainage_end : start;
  const side = loc.side || 'NA';
  const pos = loc.position || 'NA';

  if (start === undefined || start === null) {
    return 'Location';
  }

  if (start === end) {
    return `CH ${start}-${start} ${side} | ${pos}`;
  }
  return `CH ${start}-${end} ${side} | ${pos}`;
}

export function formatTimestamp(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year}, ${time}`;
}
