export function logfmtFormat(obj: any) {
  // simple logfmt formatter placeholder — original implementation depended on a small module file
  const parts: string[] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const safe = typeof value === 'string' && value.includes(' ') ? `"${String(value).replace(/"/g, '\\"')}"` : String(value);
    parts.push(`${key}=${safe}`);
  }
  return parts.join(' ');
}

export default logfmtFormat;
