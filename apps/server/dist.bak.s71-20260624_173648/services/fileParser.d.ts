export declare class FileParserService {
    parseFile(filePath: string): Promise<{
        content: string;
        title: string;
    }>;
    private parseTxt;
    /** 自动检测并解码文本文件编码（支持 UTF-8、GBK、GB2312 等） */
    private decodeText;
    private parseEpub;
    private parseDocx;
    private cleanHtml;
}
export declare const fileParserService: FileParserService;
