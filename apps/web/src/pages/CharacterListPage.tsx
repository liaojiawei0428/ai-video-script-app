import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listCharactersApi, backfillCharactersApi } from '../lib/api';
import { ArrowLeft, User, CheckCircle, Clock, Wand2 } from 'lucide-react';

interface Character {
  id: string; name: string; gender?: string; role?: string; confirmed: boolean;
  imageVariants?: any[]; description?: any; extraDescription?: any;
  appearance?: string; personality?: string;
}

function parseDesc(c: Character) {
  const desc = typeof c.description === 'string' ? JSON.parse(c.description || '{}') : (c.description || {});
  const extra = typeof c.extraDescription === 'string' ? JSON.parse(c.extraDescription || '{}') : (c.extraDescription || {});
  return { desc, extra };
}

function getRoleLabel(role?: string) {
  return role === 'protagonist' ? '主角' : role === 'antagonist' ? '反派' : role === 'supporting' ? '配角' : role || '';
}

export function CharacterListPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    listCharactersApi(id).then(r => setList(r.data?.data?.characters || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handleBackfill = async () => {
    if (!id || backfilling) return;
    setBackfilling(true);
    setBackfillMsg('🎭 正在从小说原文重新生成角色详细描述，请稍候...');
    try {
      const r = await backfillCharactersApi(id);
      const d = r.data?.data;
      const parts = [];
      if (d.created > 0) parts.push(`新建 ${d.created} 个角色`);
      parts.push(`描述生成 ${d.descriptionsGenerated || 0}/${d.total || 0} 个`);
      setBackfillMsg(`✅ ${parts.join('，')}。3 秒后刷新...`);
      setTimeout(load, 3000);
    } catch (err: any) {
      setBackfillMsg(`❌ 失败: ${err?.response?.data?.error?.message || err.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div>
      <Link to={`/novels/${id}`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回剧本详情
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">角色库 ({list.length})</h1>
        {/* v2.5.10 修复: 一键回填 (历史 novel 因旧版 regex 漏解析时可用) */}
        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="px-3 py-1.5 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 disabled:opacity-50 flex items-center gap-1.5"
          title="从已有 analysis_report 重新解析角色 (10s 后自动刷新)"
        >
          <Wand2 size={14} /> {backfilling ? '回填中...' : '修复角色库'}
        </button>
      </div>
      {backfillMsg && (
        <div className="glass p-3 mb-4 text-sm">{backfillMsg}</div>
      )}
      {loading ? (
        <div className="text-center py-20 text-text-tertiary">加载中...</div>
      ) : list.length === 0 ? (
        <div className="glass p-10 text-center text-text-tertiary">
          <User size={48} className="mx-auto mb-3" /> 暂无角色
          <p className="text-xs mt-2">可点击右上"修复角色库"从分析报告重提取</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(c => {
            const { desc, extra } = parseDesc(c);
            const age = desc.age || '';
            const height = desc.height || '';
            const build = desc.build || '';
            const eyes = desc.eyes || '';
            const hair = desc.hair_color ? `${desc.hair_color} ${desc.hair_style || ''}` : desc.hair || '';
            const clothing = desc.clothing_top || desc.clothes || '';
            const props = desc.props || '';
            const features = desc.distinctive_features || desc.signature || '';
            const expression = desc.default_expression || '';
            const roleLabel = getRoleLabel(desc.role_type || c.role);
            const hasDetail = desc.age || desc.face || desc.eyes || desc.clothing_top;

            return (
              <Link key={c.id} to={`/characters/${c.id}`} className="glass p-5 block hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {c.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      {c.confirmed ? (
                        <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <CheckCircle size={10} /> 已确认
                        </span>
                      ) : (
                        <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Clock size={10} /> 待确认
                        </span>
                      )}
                      {roleLabel && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">{roleLabel}</span>}
                    </div>

                    {/* 基本信息行 */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary mb-2">
                      {age && <span>🎂 {age}</span>}
                      {height && <span>📏 {height}</span>}
                      {build && <span>🏃 {build}</span>}
                      {desc.gender && <span>👤 {desc.gender === '男' ? '男' : desc.gender === '女' ? '女' : desc.gender}</span>}
                    </div>

                    {/* 详细描述 */}
                    {hasDetail ? (
                      <div className="space-y-1.5 text-sm text-text-secondary">
                        {eyes && <p><span className="text-text-tertiary font-medium">👁 眼睛：</span>{eyes}</p>}
                        {hair && <p><span className="text-text-tertiary font-medium">💇 发型：</span>{hair.trim()}</p>}
                        {clothing && <p><span className="text-text-tertiary font-medium">👔 服装：</span>{clothing}</p>}
                        {props && <p><span className="text-text-tertiary font-medium">🗡 道具：</span>{props}</p>}
                        {features && <p><span className="text-text-tertiary font-medium">✨ 特征：</span>{features}</p>}
                        {expression && <p><span className="text-text-tertiary font-medium">😊 表情：</span>{expression}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-text-tertiary italic">
                        {c.appearance || c.personality || '暂无详细描述'}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
