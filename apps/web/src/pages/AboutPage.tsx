// apps/web/src/pages/AboutPage.tsx
// v3.0.1 (S56): 关于我们页 (版本号 + 法律 + 算法备案)

import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Info, FileText, Shield, Code, Server } from 'lucide-react';

const APP_VERSION = '3.0.0';
const BUILD_DATE = '2026-06-13';

export function AboutPage() {
  const location = useLocation();
  const hash = location.hash.replace('#', '');

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/profile" className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <Info size={18} />
          关于我们
        </h1>
      </div>

      {/* Logo + 版本 */}
      <div className="glass p-6 rounded-2xl border border-border text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold mb-3">
          D
        </div>
        <h2 className="text-xl font-bold text-text-primary">Deep剧本</h2>
        <p className="text-sm text-text-tertiary mt-1">v{APP_VERSION} · {BUILD_DATE}</p>
        <p className="text-xs text-text-tertiary mt-3">
          AI 驱动的剧本生成平台<br />
          角色一致性 · 分集大纲 · 无限画布 · 智能助手
        </p>
      </div>

      {/* 服务信息 */}
      <div className="glass p-5 rounded-2xl border border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Server size={16} className="text-primary" />
          技术栈
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-bg-secondary rounded-lg">
            <p className="text-xs text-text-tertiary">前端</p>
            <p className="text-text-primary">React 18 + Vite + TypeScript</p>
          </div>
          <div className="p-2 bg-bg-secondary rounded-lg">
            <p className="text-xs text-text-tertiary">后端</p>
            <p className="text-text-primary">Node.js 22 + Express + MySQL</p>
          </div>
          <div className="p-2 bg-bg-secondary rounded-lg">
            <p className="text-xs text-text-tertiary">AI 模型</p>
            <p className="text-text-primary">DeepSeek · Agnes 视频/图像</p>
          </div>
          <div className="p-2 bg-bg-secondary rounded-lg">
            <p className="text-xs text-text-tertiary">部署</p>
            <p className="text-text-primary">Nginx + PM2 + 宝塔</p>
          </div>
        </div>
      </div>

      {/* 算法备案 */}
      <div className="glass p-5 rounded-2xl border border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-2">
          <Shield size={16} className="text-primary" />
          算法备案公示
        </h3>
        <p className="text-xs text-text-tertiary leading-relaxed">
          本平台使用生成式人工智能服务, 已按照《生成式人工智能服务管理暂行办法》要求完成相关备案。
          模型生成的内容仅供参考, 用户应自行判断其准确性、合法性、适用性。
        </p>
      </div>

      {/* 法律链接 */}
      <div className="glass rounded-2xl border border-border overflow-hidden divide-y divide-border">
        <Link
          to="/about#agreement"
          className="flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">用户服务协议</p>
            <p className="text-xs text-text-tertiary mt-0.5">使用平台前请阅读</p>
          </div>
        </Link>
        <Link
          to="/about#privacy"
          className="flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">隐私政策</p>
            <p className="text-xs text-text-tertiary mt-0.5">数据收集与使用说明</p>
          </div>
        </Link>
      </div>

      {/* 选中 hash 时显示对应内容 */}
      {hash === 'agreement' && (
        <div className="glass p-5 rounded-2xl border border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-2">用户服务协议 (摘要)</h3>
          <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
            <p>1. 您应妥善保管账号密码, 因密码泄露造成的损失由您自行承担。</p>
            <p>2. 充值金额不支持无理由退款, 误充请在 24 小时内联系客服。</p>
            <p>3. 生成内容仅供创作参考, 不得用于违法违规用途。</p>
            <p>4. 平台保留根据法律法规和业务发展调整本协议的权利。</p>
          </div>
        </div>
      )}
      {hash === 'privacy' && (
        <div className="glass p-5 rounded-2xl border border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-2">隐私政策 (摘要)</h3>
          <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
            <p>1. 我们收集您的账号信息 (用户名、密码哈希) 和生成数据用于提供服务。</p>
            <p>2. 您的密码使用 bcrypt 加密存储, 我们不会以明文形式查看或导出。</p>
            <p>3. 您的生成内容仅您可见, 不会用于训练第三方模型。</p>
            <p>4. 您可以随时申请导出或删除个人数据。</p>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-text-tertiary">
        © 2026 Deep剧本 · 保留所有权利
      </p>
    </div>
  );
}
