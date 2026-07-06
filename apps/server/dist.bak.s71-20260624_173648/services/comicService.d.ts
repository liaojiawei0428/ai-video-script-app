import { TaskJob } from '../shared/types';
export declare class ComicService {
    /** 入口: 队列任务并立即返回 task */
    generateComic(episodeId: string, useCharacterLibrary?: boolean): Promise<TaskJob>;
    /** 后台执行漫画生成 */
    private executeComicGeneration;
}
export declare const comicService: ComicService;
