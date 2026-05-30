import { logger } from '../utils/logger';

const cache = new Map<string, string>();

export async function lookupIp(ip: string): Promise<string> {
  if (cache.has(ip)) return cache.get(ip)!;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
    cache.set(ip, '本地');
    return '本地';
  }
  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=regionName,city`);
    const data = await resp.json() as any;
    const loc = data?.regionName && data?.city
      ? `${data.regionName} ${data.city}`
      : (data?.regionName || data?.city || '未知');
    cache.set(ip, loc);
    return loc;
  } catch {
    return '';
  }
}
