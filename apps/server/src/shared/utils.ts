export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function estimateDuration(content: string): number {
  const dialogueMatches = content.match(/["「『].*?["」』]/g) || [];
  const actionMatches = content.match(/[^「」"']{10,50}/g) || [];

  const dialogueDuration = dialogueMatches.length * 3;
  const actionDuration = actionMatches.length * 2;
  const transitionDuration = 5;

  return dialogueDuration + actionDuration + transitionDuration;
}

export function chunkText(text: string, chunkSize: number, overlap: number = 500): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= end) break;
  }

  return chunks;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
}

export function sliceTextAtBoundary(
  text: string,
  start: number,
  end: number,
  overlap: number = 500
): string {
  const actualStart = Math.max(0, start - overlap);
  const actualEnd = Math.min(text.length, end + overlap);

  let sliceStart = actualStart;
  while (sliceStart > 0 && text[sliceStart] !== '\n') sliceStart--;

  let sliceEnd = actualEnd;
  while (sliceEnd < text.length && text[sliceEnd] !== '\n') sliceEnd++;

  return text.slice(sliceStart, sliceEnd);
}

export function estimateTokens(chineseChars: number): number {
  return Math.ceil(chineseChars * 1.5);
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000000) * 0.5;
  const outputCost = (outputTokens / 1000000) * 2.0;
  return Math.round((inputCost + outputCost) * 100) / 100;
}
