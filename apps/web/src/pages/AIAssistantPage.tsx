import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { chatApi } from '../lib/api';
import { Send, Sparkles } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  '帮我润色当前剧本的对白',
  '如何让开头更有吸引力?',
  '推荐适合的镜头切换技巧',
  '如何塑造立体角色?',
];

export function AIAssistantPage() {
  const { novelId } = useParams<{ novelId?: string }>();
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: '你好, 我是 Deep剧本 AI 创作助手 ✨\n\n我可以帮你:\n• 润色/改写剧本对白\n• 剧情结构建议\n• 角色塑造指导\n• 镜头与分镜优化\n\n告诉我你想做什么吧!',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content }]);
    setLoading(true);
    try {
      const r = await chatApi([{ role: 'user', content }]);
      const reply = r.data?.data?.reply || r.data?.data?.message || '...';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `❌ ${e?.response?.data?.error?.message || e?.message || '请求失败'}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-primary" size={24} />
        <h1 className="text-xl font-bold">AI 创作助手</h1>
        {novelId && <span className="text-xs text-text-tertiary ml-2">· 上下文: 当前小说</span>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto glass p-4 space-y-3 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              m.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-bg-tertiary rounded-tl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="px-3 py-1.5 text-xs bg-bg-tertiary hover:bg-primary/20 border border-border rounded-full transition-colors" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="向 AI 助手提问..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button className="btn-primary px-4" onClick={() => send()} disabled={loading || !input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
