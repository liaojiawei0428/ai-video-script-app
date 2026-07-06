"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUUID = generateUUID;
exports.formatDate = formatDate;
exports.estimateDuration = estimateDuration;
exports.chunkText = chunkText;
exports.sanitizeFilename = sanitizeFilename;
exports.sliceTextAtBoundary = sliceTextAtBoundary;
exports.estimateTokens = estimateTokens;
exports.estimateCost = estimateCost;
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
function formatDate(timestamp) {
    return new Date(timestamp).toISOString();
}
function estimateDuration(content) {
    const dialogueMatches = content.match(/["「『].*?["」』]/g) || [];
    const actionMatches = content.match(/[^「」"']{10,50}/g) || [];
    const dialogueDuration = dialogueMatches.length * 3;
    const actionDuration = actionMatches.length * 2;
    const transitionDuration = 5;
    return dialogueDuration + actionDuration + transitionDuration;
}
function chunkText(text, chunkSize, overlap = 500) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = end - overlap;
        if (start >= end)
            break;
    }
    return chunks;
}
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
}
function sliceTextAtBoundary(text, start, end, overlap = 500) {
    const actualStart = Math.max(0, start - overlap);
    const actualEnd = Math.min(text.length, end + overlap);
    let sliceStart = actualStart;
    while (sliceStart > 0 && text[sliceStart] !== '\n')
        sliceStart--;
    let sliceEnd = actualEnd;
    while (sliceEnd < text.length && text[sliceEnd] !== '\n')
        sliceEnd++;
    return text.slice(sliceStart, sliceEnd);
}
function estimateTokens(chineseChars) {
    return Math.ceil(chineseChars * 1.5);
}
function estimateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000000) * 0.5;
    const outputCost = (outputTokens / 1000000) * 2.0;
    return Math.round((inputCost + outputCost) * 100) / 100;
}
