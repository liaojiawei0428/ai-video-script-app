// apps/web/src/pages/FeedbackPage.tsx
// v3.0.1 (S56): 意见反馈页
// 后端: POST /api/feedback (auth middleware, createFeedbackApi)

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createFeedbackApi, getMyFeedbacksApi } from '../lib/api';
import { ArrowLeft, MessageSquare, Send, Loader, AlertCircle, CheckCircle, Clock, CheckCheck, XCircle } from 'lucide-react';

interface FeedbackRecord {
  id: string;
  content: string;
  type: string;
  status: string;
  adminReply?: string;
  createdAt: number;
  repliedAt?: number;
}

const FEEDBACK_TYPES = [
  { value: 'bug', label: '🐛 Bug 报告' },
  { value: 'suggestion', label: '💡 功能建议' },
  { value: 'question', label: '❓ 使用问题' },
  { value: 'other', label: '💬 其他' },
];

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: '待回复', color: 'text-warning bg-warning/10', icon: Clock },
  read:     { label: '已查看', color: 'text-text-secondary bg-bg-tertiary', icon: CheckCheck },
  replied:  { label: '已回复', color: 'text-success bg-success/10', icon: CheckCircle },
  closed:   { label: '已关闭', color: 'text-text-tertiary bg-bg-tertiary', icon: XCircle },
};

export function FeedbackPage() {
  const [content, setContent] = useState('');
  const [type, setType] = useState('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const r = await getMyFeedbacksApi();
      setHistory(r.data?.data?.records || r.data?.data?.feedbacks || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setSuccess('');
    if (!content.trim()) { setErr('请输入反馈内容'); return; }
    if (content.length < 5) { setErr('反馈内容太短 (至少 5 字)'); return; }
    setSubmitting(true);
    try {
      await createFeedbackApi(content, type);
      setSuccess('✅ 反馈已提交, 感谢您的支持!');
      setContent('');
      await loadHistory();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/profile" className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare size={18} />
          意见反馈
        </h1>
      </div>

      {/* 提交表单 */}
      <form onSubmit={handleSubmit} className="glass p-5 rounded-2xl border border-border space-y-4">
        <div>
          <label className="text-sm font-medium text-text-primary block mb-2">反馈类型</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FEEDBACK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  type === t.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-bg-secondary text-text-secondary hover:border-primary/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary block mb-2">
            反馈内容 <span className="text-xs text-text-tertiary">({content.length}/1000)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 1000))}
            placeholder="请详细描述您遇到的问题或建议..."
            rows={5}
            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none resize-y"
          />
        </div>

        {err && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
            <AlertCircle size={14} /> {err}
          </div>
        )}
        {success && (
          <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-sm text-success flex items-center gap-2">
            <CheckCircle size={14} /> {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          提交反馈
        </button>
      </form>

      {/* 历史反馈 */}
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-3 px-2">我的反馈</h2>
        {loading ? (
          <div className="glass p-6 rounded-2xl text-center text-text-tertiary">
            <Loader size={20} className="animate-spin mx-auto" />
          </div>
        ) : history.length === 0 ? (
          <div className="glass p-8 rounded-2xl text-center text-text-tertiary text-sm">
            暂无反馈记录
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((f) => {
              const meta = STATUS_META[f.status] || STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <div key={f.id} className="glass p-4 rounded-xl border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-text-primary flex-1">{f.content}</p>
                    <span className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 ${meta.color} flex-shrink-0`}>
                      <Icon size={12} />
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    {new Date(f.createdAt).toLocaleString('zh-CN')}
                  </p>
                  {f.adminReply && (
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs font-semibold text-primary mb-1">📞 客服回复</p>
                      <p className="text-sm text-text-primary whitespace-pre-wrap">{f.adminReply}</p>
                      {f.repliedAt && (
                        <p className="text-xs text-text-tertiary mt-1">
                          {new Date(f.repliedAt).toLocaleString('zh-CN')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
