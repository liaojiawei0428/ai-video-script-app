import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCharacterApi, apiClient, updateCharacterFullApi } from '../lib/api';
import {
  ArrowLeft, CheckCircle, Image as ImageIcon, Loader, AlertCircle, Palette, Sparkles,
  Edit2, Save, X,
} from 'lucide-react';

interface CharacterDetail {
  id: string; novelId: string; name: string; aliases: string[];
  appearance: string; personality: string; roleType: string;
  relationships: any[]; referenceImage: string; imageVariants: any[];
  confirmed: boolean; imageGenStatus: string;
  description?: any; extraDescription?: any;
  gender?: string; role?: string;
}

const SCALAR_DESC_FIELDS: Array<{ key: string; label: string; icon: string; long?: boolean }> = [
  { key: 'age', label: '年龄', icon: '🎂' },
  { key: 'gender', label: '性别', icon: '⚧' },
  { key: 'height', label: '身高', icon: '📏' },
  { key: 'build', label: '体型', icon: '🏃' },
  { key: 'skin', label: '肤色', icon: '🧖' },
  { key: 'makeup', label: '妆容', icon: '💄' },
  { key: 'face', label: '脸型', icon: '👤', long: true },
  { key: 'eyes', label: '眼睛', icon: '👁', long: true },
  { key: 'eyebrows', label: '眉毛', icon: '✏️' },
  { key: 'nose', label: '鼻子', icon: '👃' },
  { key: 'lips', label: '嘴唇', icon: '👄' },
  { key: 'ears', label: '耳朵', icon: '👂' },
  { key: 'hair_color', label: '发色', icon: '🎨' },
  { key: 'hair_style', label: '发型', icon: '💇', long: true },
  { key: 'hair_length', label: '发长', icon: '📏' },
  { key: 'hair_texture', label: '发质', icon: '✨' },
  { key: 'hair_accessories', label: '发饰', icon: '🎀' },
  { key: 'clothing_top', label: '上衣', icon: '👕', long: true },
  { key: 'clothing_bottom', label: '下装', icon: '👖' },
  { key: 'clothing_outer', label: '外披', icon: '🧥', long: true },
  { key: 'clothing_shoes', label: '鞋履', icon: '👟' },
  { key: 'clothing_underwear', label: '内衣', icon: '🎽' },
  { key: 'clothing_socks', label: '袜', icon: '🧦' },
  { key: 'accessories_neck', label: '颈饰', icon: '📿' },
  { key: 'accessories_ears', label: '耳饰', icon: '🪩' },
  { key: 'accessories_hands', label: '手饰', icon: '💍' },
  { key: 'accessories_waist', label: '腰饰', icon: '🎗' },
  { key: 'accessories_other', label: '其他配饰', icon: '🎁' },
  { key: 'props', label: '道具', icon: '🗡', long: true },
  { key: 'distinctive_features', label: '显著特征', icon: '✨', long: true },
  { key: 'default_expression', label: '默认表情', icon: '😊' },
  { key: 'emotional_range', label: '情绪范围', icon: '🎭', long: true },
  { key: 'body_language', label: '肢体语言', icon: '🤸', long: true },
  { key: 'personality_visual', label: '性格(视觉)', icon: '🧠', long: true },
  { key: 'social_class_visual', label: '社会阶层(视觉)', icon: '👑', long: true },
  { key: 'role_type', label: '角色类型', icon: '🏷' },
];

const SECTION_GROUPS: Array<{ title: string; icon: string; keys: string[] }> = [
  { title: '基本信息', icon: '📋', keys: ['age', 'gender', 'height', 'build', 'skin', 'makeup'] },
  { title: '五官面容', icon: '👁', keys: ['face', 'eyes', 'eyebrows', 'nose', 'lips', 'ears'] },
  { title: '发型发色', icon: '💇', keys: ['hair_color', 'hair_style', 'hair_length', 'hair_texture', 'hair_accessories'] },
  { title: '服装', icon: '👕', keys: ['clothing_top', 'clothing_bottom', 'clothing_outer', 'clothing_shoes', 'clothing_underwear', 'clothing_socks'] },
  { title: '配饰', icon: '💍', keys: ['accessories_neck', 'accessories_ears', 'accessories_hands', 'accessories_waist', 'accessories_other'] },
  { title: '道具与特征', icon: '🗡', keys: ['props', 'distinctive_features', 'default_expression', 'emotional_range', 'body_language'] },
  { title: '性格与社会属性', icon: '🧠', keys: ['personality_visual', 'social_class_visual', 'role_type'] },
];

function parseDesc(c: CharacterDetail) {
  const desc = typeof c.description === 'string' ? JSON.parse(c.description || '{}') : (c.description || {});
  const extra = typeof c.extraDescription === 'string' ? JSON.parse(c.extraDescription || '{}') : (c.extraDescription || {});
  return { desc, extra };
}

export function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingResult, setGeneratingResult] = useState<string>('');

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [descDraft, setDescDraft] = useState<Record<string, any>>({});
  const [extraDraft, setExtraDraft] = useState<Record<string, any>>({});
  const [paletteDraft, setPaletteDraft] = useState<string>('');
  const [doNotChangeDraft, setDoNotChangeDraft] = useState<string>('');
  const [aliasesDraft, setAliasesDraft] = useState<string>('');
  const [nameDraft, setNameDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string>('');

  useEffect(() => { if (id) load(); }, [id]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    getCharacterApi(id)
      .then(r => setCharacter(r.data?.data || r.data))
      .catch(() => setCharacter(null))
      .finally(() => setLoading(false));
  };

  const startEdit = () => {
    if (!character) return;
    const { desc, extra } = parseDesc(character);
    setDescDraft({ ...desc });
    setExtraDraft({ ...extra });
    setPaletteDraft(Array.isArray(desc.color_palette) ? desc.color_palette.join(', ') : (desc.color_palette || ''));
    setDoNotChangeDraft(Array.isArray(desc.do_not_change) ? desc.do_not_change.join('\n') : (desc.do_not_change || ''));
    setAliasesDraft((character.aliases || []).join('、'));
    setNameDraft(character.name || '');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveBanner(''); };

  const saveEdit = async () => {
    if (!id || saving) return;
    setSaving(true);
    setSaveBanner('');
    try {
      const newDesc: Record<string, any> = { ...descDraft, name: nameDraft || character?.name || '' };
      if (paletteDraft.trim()) newDesc.color_palette = paletteDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      else delete newDesc.color_palette;
      if (doNotChangeDraft.trim()) newDesc.do_not_change = doNotChangeDraft.split('\n').map(s => s.trim()).filter(Boolean);
      else delete newDesc.do_not_change;
      const aliases = aliasesDraft.split(/[、,,]/).map(s => s.trim()).filter(Boolean);
      const newExtra: Record<string, any> = {
        ...extraDraft,
        color_palette: newDesc.color_palette || [],
        do_not_change: newDesc.do_not_change || [],
      };
      await updateCharacterFullApi(id, {
        name: nameDraft,
        description: newDesc,
        extraDescription: newExtra,
      });
      setCharacter(prev => prev ? {
        ...prev,
        name: nameDraft || prev.name,
        aliases,
        description: newDesc,
        extraDescription: newExtra,
      } : prev);
      setSaveBanner('✅ 已保存');
      setTimeout(() => { setEditing(false); setSaveBanner(''); }, 800);
    } catch (e: any) {
      setSaveBanner('❌ 保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    if (!id || confirming) return;
    setConfirming(true);
    try {
      await apiClient.post(`/characters/${id}/confirm`, {});
      setCharacter(prev => prev ? { ...prev, confirmed: true } : prev);
    } catch (e: any) { alert(e?.response?.data?.error?.message || '确认失败'); }
    finally { setConfirming(false); }
  };

  const handleGenerateImages = async () => {
    if (!id || generatingImages) return;
    setGeneratingImages(true);
    setGeneratingResult('');
    try {
      const res = await apiClient.post(`/characters/${id}/generate-images`);
      const data = res.data?.data || res.data;
      const count = data?.variants?.length || data?.imageVariants?.length || 0;
      setGeneratingResult(count > 0 ? '角色三视图生成成功！' : '生成失败，请稍后重试');
      load();
    } catch (e: any) {
      setGeneratingResult(e?.response?.data?.error?.message || '生图失败');
    } finally { setGeneratingImages(false); }
  };

  if (loading) return <div className="text-center py-20 text-text-tertiary">加载中...</div>;
  if (!character) return (
    <div className="text-center py-20">
      <AlertCircle size={48} className="text-error mx-auto mb-3" />
      <p className="text-text-secondary">角色不存在</p>
      <button className="btn-ghost mt-4" onClick={() => nav(-1)}>返回</button>
    </div>
  );

  const { desc, extra } = parseDesc(character);
  const roleLabel = desc.role_type === 'protagonist' ? '主角' :
                    desc.role_type === 'antagonist' ? '反派' :
                    desc.role_type === 'supporting' ? '配角' :
                    desc.role_type === 'minor' ? '龙套' : desc.role_type || character.roleType || '未知角色';
  const hasPalette = Array.isArray(desc.color_palette) && desc.color_palette.length > 0;
  const hasDoNot = desc.do_not_change && (Array.isArray(desc.do_not_change) ? desc.do_not_change.length : desc.do_not_change);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <Link to={`/novels/${character.novelId}/characters`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回角色库
      </Link>

      {/* 头部 */}
      <div className="glass p-6 mb-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
          {character.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {editing ? (
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                className="text-2xl font-bold bg-bg-secondary border border-border rounded px-2 py-1 w-full max-w-[200px]"
              />
            ) : (
              <h1 className="text-2xl font-bold">{character.name}</h1>
            )}
            {character.confirmed && <CheckCircle size={18} className="text-success" />}
            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">{roleLabel}</span>
            {desc.gender && <span className="text-xs bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary">{desc.gender}</span>}
            {editing && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">编辑中</span>}
          </div>
          {editing ? (
            <input
              value={aliasesDraft}
              onChange={e => setAliasesDraft(e.target.value)}
              placeholder="别名（用 、 或 , 分隔）"
              className="text-xs bg-bg-secondary border border-border rounded px-2 py-1 w-full mt-1"
            />
          ) : (
            character.aliases && character.aliases.length > 0 && (
              <p className="text-xs text-text-tertiary">别名：{character.aliases.join('、')}</p>
            )
          )}
        </div>
        {!editing ? (
          <button onClick={startEdit} className="px-3 py-1.5 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex items-center gap-1 flex-shrink-0">
            <Edit2 size={14} /> 编辑
          </button>
        ) : (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={cancelEdit} className="px-2.5 py-1.5 text-sm border border-border rounded-lg hover:bg-bg-secondary flex items-center gap-1">
              <X size={14} /> 取消
            </button>
            <button onClick={saveEdit} disabled={saving} className="px-2.5 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
              <Save size={14} /> {saving ? '保存中' : '保存'}
            </button>
          </div>
        )}
      </div>

      {saveBanner && (
        <div className="glass p-3 mb-3 text-sm text-center">{saveBanner}</div>
      )}

      {/* 7 大分组 (v2.5.13 — 旧版 appearance/personality/roleType 编辑块已清理, 全部走 37 字段 description) */}
      {SECTION_GROUPS.map(group => {
        if (editing) {
          return (
            <div key={group.title} className="glass p-5 mb-4">
              <h2 className="font-semibold mb-3 text-text-primary">{group.icon} {group.title}</h2>
              <div className="space-y-2">
                {group.keys.map(key => {
                  const f = SCALAR_DESC_FIELDS.find(x => x.key === key);
                  if (!f) return null;
                  const val = descDraft[key] ?? desc[key] ?? '';
                  return (
                    <div key={key}>
                      <label className="text-xs text-text-tertiary">{f.icon} {f.label}</label>
                      {f.long ? (
                        <textarea value={val} onChange={e => setDescDraft({ ...descDraft, [key]: e.target.value })} rows={2}
                          className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2 mt-1 resize-y" />
                      ) : (
                        <input value={val} onChange={e => setDescDraft({ ...descDraft, [key]: e.target.value })}
                          className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        const hasContent = group.keys.some(k => desc[k]);
        if (!hasContent) return null;
        return (
          <div key={group.title} className="glass p-5 mb-4">
            <h2 className="font-semibold mb-3 text-text-primary">{group.icon} {group.title}</h2>
            <div className="space-y-1.5">
              {group.keys.map(key => {
                if (!desc[key]) return null;
                const f = SCALAR_DESC_FIELDS.find(x => x.key === key)!;
                return (
                  <div key={key} className="text-sm">
                    <span className="text-text-tertiary font-medium">{f.icon} {f.label}：</span>
                    <span className="text-text-secondary ml-1 whitespace-pre-line">{desc[key]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 色板 & 不可变元素 */}
      {(editing || hasPalette || hasDoNot) && (
        <div className="glass p-5 mb-4">
          <h2 className="font-semibold mb-3 text-text-primary flex items-center gap-1.5"><Palette size={16} /> 色板 & 不可变元素</h2>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">🎨 色彩主调 (用 , 或 ， 分隔多个 hex)</label>
                <input value={paletteDraft} onChange={e => setPaletteDraft(e.target.value)}
                  placeholder="#0D0D0D, #B22222, #C0C0C0"
                  className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2 mt-1 font-mono" />
              </div>
              <div>
                <label className="text-xs text-text-tertiary">🔒 不可变元素 (每行一个)</label>
                <textarea value={doNotChangeDraft} onChange={e => setDoNotChangeDraft(e.target.value)} rows={3}
                  placeholder="苍白脸色及血红嘴唇&#10;狭长上挑眼及剑眉&#10;紫金冠与红宝石"
                  className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2 mt-1 resize-y" />
              </div>
            </div>
          ) : (
            <>
              {hasPalette && (
                <div className="mb-3">
                  <div className="text-xs text-text-tertiary mb-2">🎨 色彩主调</div>
                  <div className="flex flex-wrap gap-2">
                    {desc.color_palette.map((color: string, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: color }} />
                        <span className="text-text-tertiary font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasDoNot && (
                <div>
                  <div className="text-xs text-text-tertiary mb-2">🔒 不可变元素</div>
                  <div className="text-sm text-text-secondary whitespace-pre-line">
                    {Array.isArray(desc.do_not_change) ? desc.do_not_change.join('\n') : desc.do_not_change}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* prompt 提示词 */}
      {(editing || desc.prompt_safe_description) && (
        <PromptEdit editing={editing} label="AI 生图英文提示词 (prompt_safe_description)" icon={<Sparkles size={16} />}
          value={descDraft.prompt_safe_description ?? desc.prompt_safe_description ?? ''}
          onChange={v => setDescDraft({ ...descDraft, prompt_safe_description: v })} />
      )}
      {(editing || desc.negative_prompt_suggestion) && (
        <PromptEdit editing={editing} label="Negative Prompt (负面提示词)" icon={<span>⚠️</span>}
          value={descDraft.negative_prompt_suggestion ?? desc.negative_prompt_suggestion ?? ''}
          onChange={v => setDescDraft({ ...descDraft, negative_prompt_suggestion: v })} />
      )}

      {/* 角色三视图 */}
      {(character.imageVariants?.length > 0) && (
        <div className="glass p-5 mb-4">
          <h2 className="font-semibold mb-3 text-text-primary">角色三视图</h2>
          <div className="space-y-3">
            {character.imageVariants.map((v: any, i: number) => (
              <div key={i} className="bg-bg-secondary rounded-lg overflow-hidden">
                {v.url ? (
                  <img src={v.url} alt={`${character.name} ${v.angle}`} className="w-full object-contain" />
                ) : (
                  <div className="w-full aspect-[3/2] flex items-center justify-center text-text-tertiary text-xs">生成中...</div>
                )}
                <div className="text-xs text-text-secondary text-center py-1">
                  {v.angle === 'sheet' ? '三视图' : v.angle === 'front_bust' ? '正面' : v.angle === 'side_bust' ? '侧面' : '全身'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {generatingResult && (
        <div className="glass p-3 mb-4 text-sm text-accent text-center">{generatingResult}</div>
      )}

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg-primary/95 backdrop-blur border-t border-white/5 p-3 z-10">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Link to={`/novels/${character.novelId}/characters`} className="btn-ghost flex-1 text-center">返回列表</Link>
          {!character.confirmed ? (
            <button onClick={handleConfirm} disabled={confirming} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {confirming ? <><Loader size={16} className="animate-spin" /> 确认中...</> : <><CheckCircle size={16} /> 确认角色</>}
            </button>
          ) : (
            <button onClick={handleGenerateImages} disabled={generatingImages} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {generatingImages ? <><Loader size={16} className="animate-spin" /> 生成中 (约20s)...</> : <><ImageIcon size={16} /> 生成三视图 (¥0.10)</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PromptEdit({ editing, label, icon, value, onChange }: { editing: boolean; label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void }) {
  if (editing) {
    return (
      <div className="glass p-5 mb-4">
        <h2 className="font-semibold mb-3 text-text-primary flex items-center gap-1.5">{icon} {label}</h2>
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
          className="w-full text-xs bg-bg-secondary border border-border rounded-lg p-2 font-mono leading-relaxed resize-y" />
        <div className="text-xs text-text-tertiary mt-1 text-right">{value.length} 字符</div>
      </div>
    );
  }
  return (
    <details className="glass p-5 mb-4">
      <summary className="font-semibold text-text-primary cursor-pointer flex items-center gap-1.5">
        {icon} {label} ({value.length} 字符)
      </summary>
      <p className="text-xs text-text-secondary leading-relaxed mt-3 font-mono bg-bg-secondary p-3 rounded whitespace-pre-wrap">
        {value}
      </p>
    </details>
  );
}
