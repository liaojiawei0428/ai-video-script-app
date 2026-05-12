declare module 'epub' {
  export class EPub {
    constructor(filePath: string);
    metadata: { title?: string };
    flow: Array<{ id: string }>;
    on(event: string, callback: (...args: any[]) => void): void;
    parse(): void;
    getChapter(id: string, callback: (err: Error | null, text: string) => void): void;
  }
}

declare module 'mammoth' {
  export function extractRawText(options: { path: string }): Promise<{ value: string }>;
}
