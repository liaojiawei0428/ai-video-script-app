// apps/web/src/pages/DownloadPage.tsx
// v3.0.0 (S58 P1): APP 下载页 (用户浏览器访问 ab.maque.uno/download 看到)
// v3.0.29 (S64): 硬编码 fallback 改为 import 单一来源 (修复 BUG-067)
//
// APK 路径: https://ab.maque.uno/app/DeepScript_v{VERSION}.apk (nginx alias 公开)

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Smartphone, Download, CheckCircle, ChevronRight, Shield, Image as ImageIcon, Video as VideoIcon, ListChecks, Wallet, Sparkles, Home, ArrowLeft, Crown } from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE } from '../config/version';

interface VersionInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  highlights?: string[];
  buildDate?: string;
  forceUpdate: boolean;
  needUpdate: boolean;
  sizeBytes?: number;
}

const APK_SIZE_BYTES_FALLBACK = 30_073_380; // v3.0.29 真实大小 28.7 MB, fallback 仅 server 不可达时使用

export function DownloadPage() {
  const location = useLocation();
  const [serverVer, setServerVer] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    // 直接 fetch server 公开端点, 拿真实当前版本
    fetch('https://ab.maque.uno/api/version')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          // v3.0.29 (S64): sizeBytes 直接用 server /api/version 返回的, 没有 fallback (server 不可达就显示 '未知')
          setServerVer({ ...j.data, sizeBytes: j.data.sizeBytes ?? APK_SIZE_BYTES_FALLBACK });
        } else {
          setErr(j.error?.message || '获取版本失败');
        }
      })
      .catch(e => setErr(e?.message || '网络错误'))
      .finally(() => setLoading(false));
  }, []);

  const version = serverVer?.version || APP_VERSION;
  const downloadUrl = serverVer?.downloadUrl || `https://ab.maque.uno/app/DeepScript_v${APP_VERSION}.apk`;
  const sizeMB = serverVer?.sizeBytes ? (serverVer.sizeBytes / 1024 / 1024).toFixed(1) : (APK_SIZE_BYTES_FALLBACK / 1024 / 1024).toFixed(1);
  const highlights = serverVer?.highlights || [];
  const buildDate = serverVer?.buildDate || APP_BUILD_DATE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      {/* 顶部 (简洁) */}
      <header className="border-b border-border bg-bg-primary/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary">
            <ArrowLeft size={18} />
            <span className="text-sm">返回 Deep剧本</span>
          </Link>
          <Link to="/" className="text-sm text-text-tertiary hover:text-text-primary">
            maque.uno
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent text-white shadow-2xl">
            <Smartphone size={40} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">
            Deep剧本 · 移动 APP
          </h1>
          <p className="text-sm md:text-base text-text-secondary max-w-xl mx-auto">
            把 AI 视频剧本创作装进你口袋
          </p>
          {loading ? (
            <p className="text-xs text-text-tertiary">正在获取最新版本信息...</p>
          ) : err ? (
            <p className="text-xs text-error">无法连接服务器: {err}</p>
          ) : serverVer ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle size={12} />
              当前最新版本: v{version} · {sizeMB} MB
            </div>
          ) : null}
        </div>

        {/* 下载主按钮 */}
        <div className="glass p-6 md:p-8 rounded-3xl border border-border text-center space-y-4">
        <a
          href={downloadUrl}
          download={`DeepScript_v${version}.apk`}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-br from-primary to-accent text-white text-lg font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-100 transition-all"
        >
          <Download size={22} />
          下载 APP v{version}
          <span className="text-xs font-normal opacity-80">({sizeMB} MB)</span>
        </a>
        <p className="text-xs text-text-tertiary">
          APK 直链 · 支持 Android 5.0+ (API 21)
        </p>
      </div>

      {/* 核心功能 */}
        <div className="glass p-5 md:p-6 rounded-2xl border border-border">
          <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            核心功能
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { Icon: Home, title: '书架管理', desc: '本地缓存, 离线浏览' },
              { Icon: ListChecks, title: '任务进度', desc: 'AI 分析/生成 实时跟踪' },
              { Icon: ImageIcon, title: 'AI 生图', desc: '角色一致性 无限画布' },
              { Icon: VideoIcon, title: 'AI 视频', desc: '分镜一键生成短视频' },
              { Icon: Wallet, title: '在线充值', desc: '支付宝 · 微信支付' },
              { Icon: Crown, title: 'VIP 优惠', desc: '¥10/年 · 全场 8 折' },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-bg-secondary/50">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 更新日志 */}
        {(serverVer?.changelog || highlights.length > 0) && (
          <div className="glass p-5 md:p-6 rounded-2xl border border-border">
            <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-success" />
              v{version} 更新内容
              <span className="text-xs text-text-tertiary font-normal ml-1">({buildDate})</span>
            </h2>
            {serverVer?.changelog && (
              <div className="text-sm text-text-secondary leading-relaxed">
                {serverVer.changelog}
              </div>
            )}
            {highlights.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-xs text-text-secondary">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight size={12} className="text-primary flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-tertiary mt-3">本次更新内容详见版本说明</p>
            )}
          </div>
        )}

        {/* 技术栈 */}
        <div className="glass p-5 md:p-6 rounded-2xl border border-border">
          <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Shield size={16} className="text-info" />
            系统要求
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-text-secondary">
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">系统</p>
              <p className="font-medium text-text-primary mt-1">Android 5.0+</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">架构</p>
              <p className="font-medium text-text-primary mt-1">arm64-v8a</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">大小</p>
              <p className="font-medium text-text-primary mt-1">{sizeMB} MB</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">技术</p>
              <p className="font-medium text-text-primary mt-1">React Native 0.73</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">签名</p>
              <p className="font-medium text-text-primary mt-1">SHA256withRSA</p>
            </div>
            <div className="p-3 rounded-xl bg-bg-secondary/50">
              <p className="text-text-tertiary">网络</p>
              <p className="font-medium text-text-primary mt-1">需要联网</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary">
          © 2026 Deep剧本 · maque.uno
        </p>
      </div>
    </div>
  );
}
