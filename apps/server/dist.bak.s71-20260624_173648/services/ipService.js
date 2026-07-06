"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupIp = lookupIp;
const cache = new Map();
async function lookupIp(ip) {
    if (cache.has(ip))
        return cache.get(ip);
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
        cache.set(ip, '本地');
        return '本地';
    }
    try {
        const resp = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=regionName,city`);
        const data = await resp.json();
        const loc = data?.regionName && data?.city
            ? `${data.regionName} ${data.city}`
            : (data?.regionName || data?.city || '未知');
        cache.set(ip, loc);
        return loc;
    }
    catch {
        return '';
    }
}
