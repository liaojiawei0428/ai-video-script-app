// apps/web/src/pages/CharacterListPage.tsx
// v2.5.34 重大重构: 角色卡片可展开/折叠, 展开后直接在卡片内编辑保存
//
// 设计动机:
//   旧版: 卡片只显示 age/eyes/hair/clothing 等提取字段, 11 字段填不全时显示空
//   新版: 卡片默认折叠, 只显示头像/名字/状态/角色类型 + 描述前 100 字符摘要
//         点击卡片 → 下拉展开 → 显示完整描述 + 2 个 textarea + 保存按钮
//         不再有 "字段" 概念, 一个 textarea 显示完整 Markdown 描述
//
// 兼容: 自动处理新格式(字符串) 和 旧格式(11 字段 JSON 对象)

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listCharactersApi, backfillCharactersApi, updateCharacterFullApi } from '../lib/api';
import {
  ArrowLeft, User, CheckCircle, Clock, Wand2, ChevronDown, ChevronUp, Save, Loader, X, Image as ImageIcon, Sparkles, Edit2,
} from 'lucide-react';
import { extractDescriptionText, summaryOf, getRoleLabel, getRoleColor } from '../lib/characterUtils';

interface Character {
  id: string;
  name: string;
  aliases?: string[];
  gender?: string;
  role?: string;        // 旧字段别名
  roleType?: string;    // 新字段
  confirmed: boolean;
  imageVariants?: any[];
  imageGenStatus?: string;
  description?: any;        // 兼容: 旧 JSON 对象 / 新字符串
  extraDescription?: any;   // 兼容: 旧 JSON 对象 / 新字符串
  appearance?: string;
  personality?: string;
}

export function CharacterListPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  // 展开状态: Map<characterId, boolean>
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // 编辑状态: Map<characterId, { name, aliases, roleType, description, extraDescription, saving }>
  const [editStates, setEditStates] = useState<Record<string, any>>({});

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    listCharactersApi(id)
      .then(r => setList(r.data?.data?.characters || r.data?.data || []))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleBackfill = async () => {
    if (!id || backfilling) return;
    setBackfilling(true);
    setBackfillMsg('🎭 正在从小说原文重新生成角色详细描述，请稍候...');
    try {
      const r = await backfillCharactersApi(id);
      const d = r.data?.data;
      const parts: string[] = [];
      if (d?.created > 0) parts.push(`新建 ${d.created} 个角色`);
      parts.push(`描述生成 ${d?.descriptionsGenerated || 0}/${d?.total || 0} 个`);
      setBackfillMsg(`✅ ${parts.join('，')}。3 秒后刷新...`);
      setTimeout(load, 3000);
    } catch (err: any) {
      setBackfillMsg(`❌ 失败: ${err?.response?.data?.error?.message || err.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  const toggleExpand = (charId: string) => {
    setExpanded(prev => {
      const isExpanding = !prev[charId];
      const next = { ...prev, [charId]: isExpanding };
      // 首次展开时初始化 editStates
      if (isExpanding && !editStates[charId]) {
        const c = list.find(x => x.id === charId);
        if (c) {
          setEditStates(s => ({
            ...s,
            [charId]: {
              name: c.name,
              aliases: (c.aliases || []).join(', '),
              roleType: c.roleType || c.role || 'supporting',
              description: extractDescriptionText(c.description),
              extraDescription: extractDescriptionText(c.extraDescription),
              saving: false,
              error: '',
              success: '',
            },
          }));
        }
      }
      return next;
    });
  };

  const updateEdit = (charId: string, field: string, value: any) => {
    setEditStates(s => ({ ...s, [charId]: { ...s[charId], [field]: value, error: '', success: '' } }));
  };

  const handleSave = async (charId: string) => {
    const state = editStates[charId];
    if (!state) return;
    setEditStates(s => ({ ...s, [charId]: { ...s[charId], saving: true, error: '', success: '' } }));
    try {
      await updateCharacterFullApi(charId, {
        name: state.name?.trim() || undefined,
        aliases: state.aliases.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
        roleType: state.roleType,
        description: state.description,
        extraDescription: state.extraDescription,
      });
      // 同步更新 list 状态
      setList(prev => prev.map(c => c.id === charId ? {
        ...c,
        name: state.name?.trim() || c.name,
        aliases: state.aliases.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
        roleType: state.roleType,
        description: state.description,
        extraDescription: state.extraDescription,
      } : c));
      setEditStates(s => ({ ...s, [charId]: { ...s[charId], saving: false, success: '✅ 已保存' } }));
      setTimeout(() => {
        setEditStates(s => ({ ...s, [charId]: { ...s[charId], success: '' } }));
      }, 2000);
    } catch (e: any) {
      setEditStates(s => ({ ...s, [charId]: { ...s[charId], saving: false, error: '❌ ' + (e?.response?.data?.error?.message || e?.message || '保存失败') } }));
    }
  };

  const handleCancel = (charId: string) => {
    // 还原初始值
    const c = list.find(x => x.id === charId);
    if (c) {
      setEditStates(s => ({
        ...s,
        [charId]: {
          ...s[charId],
          name: c.name,
          aliases: (c.aliases || []).join(', '),
          roleType: c.roleType || c.role || 'supporting',
          description: extractDescriptionText(c.description),
          extraDescription: extractDescriptionText(c.extraDescription),
          error: '',
          success: '',
        },
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link to={`/novels/${id}`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回剧本详情
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">角色库 ({list.length})</h1>
        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="px-3 py-1.5 text-sm bg-primary/20 text-primary rounded-lg hover:bg-primary/30 disabled:opacity-50 flex items-center gap-1.5"
          title="从已有分析报告重新提取角色"
        >
          <Wand2 size={14} /> {backfilling ? '回填中...' : '重新分析角色'}
        </button>
      </div>

      {backfillMsg && (
        <div className="glass p-3 mb-4 text-sm">{backfillMsg}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-text-tertiary">
          <Loader className="inline animate-spin mr-2" size={16} />加载中...
        </div>
      ) : list.length === 0 ? (
        <div className="glass p-10 text-center text-text-tertiary">
          <User size={48} className="mx-auto mb-3" /> 暂无角色
          <p className="text-xs mt-2">可点击右上"重新分析角色"从小说原文提取</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => {
            const descText = extractDescriptionText(c.description);
            const extraText = extractDescriptionText(c.extraDescription);
            const isExpanded = expanded[c.id];
            const editState = editStates[c.id];
            const role = c.roleType || c.role;
            const roleLabel = getRoleLabel(role);
            const roleColor = getRoleColor(role);
            const sheetImg = (c.imageVariants || []).find((v: any) => v.angle === 'sheet');
            const descSummary = descText ? summaryOf(descText, 80) : '暂无描述, 点击下方"重新分析角色"生成';

            return (
              <div key={c.id} className="glass overflow-hidden">
                {/* 卡片头部 (始终显示) */}
                <div
                  onClick={() => toggleExpand(c.id)}
                  className="p-4 cursor-pointer hover:bg-bg-secondary/30 transition-colors flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {c.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      {roleLabel && <span className={`text-xs px-1.5 py-0.5 rounded ${roleColor}`}>{roleLabel}</span>}
                      {c.confirmed ? (
                        <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <CheckCircle size={10} />已确认
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Clock size={10} />待确认
                        </span>
                      )}
                      {sheetImg?.url && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ImageIcon size={10} />已生图
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {descSummary}
                    </p>
                  </div>
                  <div className="text-text-tertiary flex-shrink-0">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* 展开内容 (点击后下拉显示) */}
                {isExpanded && editState && (
                  <div className="border-t border-border p-4 bg-bg-secondary/30 space-y-3">
                    {/* 基本信息行 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">🏷 角色类型</div>
                        <select
                          value={editState.roleType}
                          onChange={e => updateEdit(c.id, 'roleType', e.target.value)}
                          className="w-full bg-bg-primary border border-border rounded px-2 py-1"
                        >
                          <option value="protagonist">主角 (protagonist)</option>
                          <option value="antagonist">反派 (antagonist)</option>
                          <option value="supporting">配角 (supporting)</option>
                          <option value="minor">次要 (minor)</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">📛 别名</div>
                        <input
                          value={editState.aliases}
                          onChange={e => updateEdit(c.id, 'aliases', e.target.value)}
                          placeholder="别名1, 别名2"
                          className="w-full bg-bg-primary border border-border rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">⚧ 性别</div>
                        <div className="text-text-primary px-2 py-1">
                          {c.gender || '-'}
                        </div>
                      </div>
                    </div>

                    {/* 主描述 textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-text-tertiary flex items-center gap-1">
                          <User size={12} /> 角色描述 (Markdown, 从小说提取)
                        </label>
                        <span className="text-xs text-text-tertiary">
                          {editState.description.length} 字符
                        </span>
                      </div>
                      <textarea
                        value={editState.description}
                        onChange={e => updateEdit(c.id, 'description', e.target.value)}
                        rows={14}
                        placeholder={`角色的完整描述 (Markdown 格式)\n\n# 基本信息\n- 年龄: 18岁\n- 身份: 后宫女官\n\n# 外貌与服装 (尽量引用原文)\n- 瓜子脸, 身形纤细\n- 藕荷色交领襦裙\n\n# 性格与行为\n- 谨慎机敏, 不轻易表态`}
                        className="w-full text-sm bg-bg-primary border border-border rounded-lg p-3 font-mono resize-y"
                      />
                    </div>

                    {/* 补充描述 textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-text-tertiary flex items-center gap-1">
                          <Sparkles size={12} /> 补充描述 (可选, 关系/情绪/名言)
                        </label>
                        <span className="text-xs text-text-tertiary">
                          {editState.extraDescription.length} 字符
                        </span>
                      </div>
                      <textarea
                        value={editState.extraDescription}
                        onChange={e => updateEdit(c.id, 'extraDescription', e.target.value)}
                        rows={6}
                        placeholder={`与其他角色的关系 / 情绪范围 / 名言 / 标志性动作 等`}
                        className="w-full text-sm bg-bg-primary border border-border rounded-lg p-3 font-mono resize-y"
                      />
                    </div>

                    {/* 状态消息 */}
                    {editState.error && (
                      <div className="text-sm text-red-400">{editState.error}</div>
                    )}
                    {editState.success && (
                      <div className="text-sm text-green-400">{editState.success}</div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2 justify-end pt-1">
                      <Link
                        to={`/characters/${c.id}`}
                        className="btn-ghost text-sm flex items-center gap-1"
                      >
                        <Edit2 size={14} /> 打开详细页
                      </Link>
                      <button
                        onClick={() => handleCancel(c.id)}
                        className="btn-ghost text-sm flex items-center gap-1"
                      >
                        <X size={14} /> 重置
                      </button>
                      <button
                        onClick={() => handleSave(c.id)}
                        disabled={editState.saving}
                        className="btn-primary text-sm flex items-center gap-1"
                      >
                        {editState.saving ? (
                          <><Loader size={14} className="animate-spin" />保存中...</>
                        ) : (
                          <><Save size={14} />保存修改</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
