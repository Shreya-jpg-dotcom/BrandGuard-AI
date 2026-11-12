export function normalizeDocument(content) {
  const original = String(content || '').replace(/\r\n?/g, '\n');
  const text = original.replace(/\u0000/g, '').trim();
  const lines = text.split('\n');
  const headings = [];
  let offset = 0;
  for (const line of lines) {
    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (match) headings.push({ level: match[1].length, text: match[2].trim(), start: offset, end: offset + line.length });
    offset += line.length + 1;
  }
  return { text, original, headings, paragraphs: text.split(/\n\s*\n/).filter(Boolean) };
}
