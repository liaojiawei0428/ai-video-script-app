// apps/mobile/src/db/updateMemory.ts
// v3.0.35 (S72 batch 5): BUG-087 修法 - 在线升级"已取消/已看过"记忆 (24h 抑制)
//
// 背景:
//   之前 App.tsx useEffect(checkUpdate, []) 启动时跑一次, fetch /api/version,
//   server 返 needUpdate=true 时弹 "发现新版本" 弹窗. 但用户点 "取消" 后无任何记忆,
//   下次冷启动 (杀进程/退出登录/重开 APP) 又 fetch 又弹 → "无限发现新版本".
//
// 修法:
//   - 用 RNFS (跟 tokenStorage.ts 同款, 不引入新依赖) 写 .update_memory 文件
//   - 记录 {lastDismissedVersion, lastDismissedAt}
//   - showUpdateDialog 弹窗前查 memory: 同版本 + 24h 内已取消 → 不弹
//   - forceUpdate=true → 强制弹 (不查 memory, 安全/关键修复必须弹)
//
// 触发场景 (4 类):
//   1. 老用户 v3.0.29 → v3.0.34: 第一次启动弹 (新版本), 用户取消 → 24h 内不弹
//   2. 老用户 v3.0.29 → v3.0.34: 24h 后再启动 → 重新弹
//   3. 老用户 v3.0.29 → v3.0.34: 已升级到 v3.0.34 → server 返 needUpdate=false → 不弹
//   4. forceUpdate=true (安全漏洞): 永远弹 (24h 抑制无效)

import RNFS from 'react-native-fs';

const UPDATE_MEMORY_FILE = RNFS.DocumentDirectoryPath + '/.update_memory';

export interface UpdateMemory {
  lastDismissedVersion: string;  // 用户取消过的 server 版本 (e.g. "3.0.34")
  lastDismissedAt: number;       // 时间戳 (ms, Date.now())
}

const DISMISS_SUPPRESS_HOURS = 24;  // 24h 抑制窗口 (跨项目通用, 用户期望的"非骚扰"标准)
const DISMISS_SUPPRESS_MS = DISMISS_SUPPRESS_HOURS * 60 * 60 * 1000;

/**
 * 读取 update memory 文件
 * @returns UpdateMemory | null (文件不存在 / 解析失败 → null, 当首次启动)
 */
export async function getUpdateMemory(): Promise<UpdateMemory | null> {
  try {
    const exists = await RNFS.exists(UPDATE_MEMORY_FILE);
    if (!exists) return null;
    const content = await RNFS.readFile(UPDATE_MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (typeof parsed?.lastDismissedVersion === 'string' && typeof parsed?.lastDismissedAt === 'number') {
      return parsed as UpdateMemory;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 写入"用户取消了这个 server 版本" (24h 抑制窗口起点)
 * @param serverVersion server /api/version 返回的 version 字段
 */
export async function setUpdateDismissed(serverVersion: string): Promise<void> {
  try {
    const memory: UpdateMemory = {
      lastDismissedVersion: serverVersion,
      lastDismissedAt: Date.now(),
    };
    await RNFS.writeFile(UPDATE_MEMORY_FILE, JSON.stringify(memory), 'utf8');
  } catch (e) {
    // 写入失败不抛错, 下次会重新弹 (不影响主流程)
    console.warn('[updateMemory] setUpdateDismissed failed', e);
  }
}

/**
 * 清除 update memory (forceUpdate 升级成功后, 清掉抑制, 让下个版本正常提示)
 * 也可以在 settings "重置" 选项手动调用
 */
export async function clearUpdateMemory(): Promise<void> {
  try {
    const exists = await RNFS.exists(UPDATE_MEMORY_FILE);
    if (exists) await RNFS.unlink(UPDATE_MEMORY_FILE);
  } catch {}
}

/**
 * BUG-087 核心决策函数: 是否应该跳过弹窗 (24h 抑制)
 *
 * @param serverVersion server /api/version 返回的 version
 * @param forceUpdate server 强制升级标志 (true = 24h 抑制无效)
 * @returns true = 跳过弹窗 (24h 内已取消过同版本); false = 继续弹
 */
export async function shouldSuppressUpdateDialog(
  serverVersion: string,
  forceUpdate: boolean
): Promise<boolean> {
  // forceUpdate=true → 不抑制 (强制升级, 防安全漏洞漏掉)
  if (forceUpdate) return false;

  const memory = await getUpdateMemory();
  if (!memory) return false;

  // 同版本 + 24h 内 → 抑制
  const sameVersion = memory.lastDismissedVersion === serverVersion;
  const withinWindow = Date.now() - memory.lastDismissedAt < DISMISS_SUPPRESS_MS;

  return sameVersion && withinWindow;
}
