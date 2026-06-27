// v2.5.34: 角色库重构 - 简化编辑界面
// 之前 7 大分组 37 字段, 现在 2 个 textarea (主描述 + 补充描述)
// 优势:
//   - 用户视角: 一个编辑框看完全部内容
//   - LLM 视角: 自由文本输出, 描述丰度由角色在小说中的出场量决定
//   - 不再臆测配角 (旧版会给"5句话的配角"生成 200 字臆测档案)

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCharacterApi, updateCharacterFullApi } from '../lib/api';
import {
  ArrowLeft, CheckCircle, Image as ImageIcon, Loader, AlertCircle, Sparkles,
  Edit2, Save, X, User, BookOpen,
} from 'lucide-react';
import { extractDescriptionText } from '../lib/characterUtils';
import { ImageWithLoading } from '../components/ui';

interface CharacterDetail {
  id: string; novelId: string;
  name: string; aliases: string[];
  roleType: string;
  referenceImage: string; imageVariants: any[];
  confirmed: boolean; imageGenStatus: string;
  gender?: string;
  description?: any;      // 兼容: 旧版是 JSON 对象, 新版是字符串
  extraDescription?: any; // 兼容: 旧版是 JSON 对象, 新版是字符串
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
  const [nameDraft, setNameDraft] = useState<string>('');
  const [aliasesDraft, setAliasesDraft] = useState<string>('');
  const [roleTypeDraft, setRoleTypeDraft] = useState<string>('supporting');
  const [descriptionDraft, setDescriptionDraft] = useState<string>('');
  const [extraDescriptionDraft, setExtraDescriptionDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string>('');

  useEffect(() => { if (id) load(); }, [id]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    getCharacterApi(id)
      .then(r => {
        const c = r.data?.data || r.data;
        setCharacter(c);
        setDescriptionDraft(extractDescriptionText(c?.description));
        setExtraDescriptionDraft(extractDescriptionText(c?.extraDescription));
        setNameDraft(c?.name || '');
        setAliasesDraft((c?.aliases || []).join(', '));
        setRoleTypeDraft(c?.roleType || 'supporting');
      })
      .catch(() => setCharacter(null))
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveBanner('');
    try {
      // v2.5.34: description / extraDescription 是字符串, 直接存
      await updateCharacterFullApi(id, {
        name: nameDraft.trim() || character?.name,
        aliases: aliasesDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        roleType: roleTypeDraft,
        description: descriptionDraft,
        extraDescription: extraDescriptionDraft,
      });
      setCharacter(prev => prev ? {
        ...prev,
        name: nameDraft.trim() || prev.name,
        aliases: aliasesDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        roleType: roleTypeDraft,
        description: descriptionDraft,
        extraDescription: extraDescriptionDraft,
      } : prev);
      setSaveBanner('✅ 保存成功');
      setTimeout(() => setSaveBanner(''), 2500);
      setEditing(false);
    } catch (e: any) {
      setSaveBanner('❌ 保存失败: ' + (e?.response?.data?.error?.message || e?.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setConfirming(true);
    try {
      // 调用 confirm API (后端路由: /characters/:characterId/confirm)
      const apiClient = (await import('../lib/api')).apiClient;
      await apiClient.post(`/characters/${id}/confirm`, { description: {}, extraDescription: {} });
      setCharacter(prev => prev ? { ...prev, confirmed: true } : prev);
      setSaveBanner('✅ 已确认');
      setTimeout(() => setSaveBanner(''), 2500);
    } catch (e: any) {
      setSaveBanner('❌ 确认失败: ' + (e?.response?.data?.error?.message || e?.message || '未知错误'));
    } finally {
      setConfirming(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!id) return;
    setGeneratingImages(true);
    setGeneratingResult('');
    try {
      const apiClient = (await import('../lib/api')).apiClient;
      const r = await apiClient.post(`/characters/${id}/generate-images`);
      const data = r.data?.data || r.data;
      const succeeded = data?.totalSucceeded || 0;
      setGeneratingResult(`✅ 已生成 ${succeeded} 张三视图变体图`);
      setTimeout(() => {
        setGeneratingResult('');
        load();
      }, 1500);
    } catch (e: any) {
      setGeneratingResult('❌ 生成失败: ' + (e?.response?.data?.error?.message || e?.message || '未知错误'));
    } finally {
      setGeneratingImages(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-text-tertiary"><Loader className="inline animate-spin mr-2" size={16} />加载中...</div>;
  }
  if (!character) {
    return <div className="p-6 text-center text-red-400"><AlertCircle className="inline mr-2" size={16} />角色不存在</div>;
  }

  const descText = extractDescriptionText(character.description);
  const extraText = extractDescriptionText(character.extraDescription);
  const sheetImg = (character.imageVariants || []).find((v: any) => v.angle === 'sheet');

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* 顶部: 返回 + 名称 + 状态 */}
      <div className="flex items-center gap-3 mb-4">
        <Link to={`/novels/${character.novelId}/characters`} className="text-text-tertiary hover:text-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <User size={20} className="text-pink-400" />
        <h1 className="text-xl font-bold flex-1">
          {editing ? (
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              className="bg-bg-secondary border border-border rounded px-2 py-1 text-lg w-full" />
          ) : (
            character.name
          )}
        </h1>
        {character.confirmed ? (
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
            <CheckCircle size={12} />已确认
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">待确认</span>
        )}
        {character.imageGenStatus === 'completed' && (
          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
            <ImageIcon size={12} />已生图
          </span>
        )}
      </div>

      {saveBanner && (
        <div className="glass p-3 mb-3 text-sm text-center">{saveBanner}</div>
      )}

      {/* 基本信息 (只读 / 编辑) */}
      <div className="glass p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-text-tertiary mb-1">🏷 角色类型</div>
            {editing ? (
              <select value={roleTypeDraft} onChange={e => setRoleTypeDraft(e.target.value)}
                className="w-full bg-bg-secondary border border-border rounded px-2 py-1">
                <option value="protagonist">主角 (protagonist)</option>
                <option value="antagonist">反派 (antagonist)</option>
                <option value="supporting">配角 (supporting)</option>
                <option value="minor">次要 (minor)</option>
              </select>
            ) : (
              <div className="text-text-primary">{character.roleType || '-'}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-text-tertiary mb-1">📛 别名</div>
            {editing ? (
              <input value={aliasesDraft} onChange={e => setAliasesDraft(e.target.value)}
                placeholder="别名1, 别名2"
                className="w-full bg-bg-secondary border border-border rounded px-2 py-1" />
            ) : (
              <div className="text-text-primary">{(character.aliases || []).join(', ') || '-'}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-text-tertiary mb-1">⚧ 性别</div>
            <div className="text-text-primary">{character.gender || '-'}</div>
          </div>
        </div>
      </div>

      {/* 角色描述 (主) - 1 个大 textarea */}
      <div className="glass p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-text-primary flex items-center gap-1.5">
            <BookOpen size={16} className="text-pink-400" />
            角色描述 (从小说提取)
          </h2>
          <div className="text-xs text-text-tertiary">
            {descText.length} 字符
          </div>
        </div>
        {editing ? (
          <textarea
            value={descriptionDraft}
            onChange={e => setDescriptionDraft(e.target.value)}
            rows={18}
            placeholder={`角色的完整描述 (Markdown 格式)\n\n示例:\n# 基本信息\n- 年龄: 18岁\n- 身份: 后宫女官\n\n# 外貌与服装 (尽量引用原文)\n- 瓜子脸, 身形纤细\n- 藕荷色交领襦裙\n\n# 性格与行为\n- 谨慎机敏, 不轻易表态`}
            className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono resize-y"
          />
        ) : descText ? (
          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{descText}</div>
        ) : (
          <div className="text-sm text-text-tertiary italic">暂无描述. 点击右上角"编辑"按钮添加, 或在角色库列表页重新分析小说.</div>
        )}
      </div>

      {/* 补充描述 (可选) - 1 个 textarea */}
      <div className="glass p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-text-primary flex items-center gap-1.5">
            <Sparkles size={16} className="text-purple-400" />
            补充描述 (可选, 关系/情绪/名言)
          </h2>
          <div className="text-xs text-text-tertiary">
            {extraText.length} 字符
          </div>
        </div>
        {editing ? (
          <textarea
            value={extraDescriptionDraft}
            onChange={e => setExtraDescriptionDraft(e.target.value)}
            rows={8}
            placeholder={`角色与其他角色的关系 / 情绪范围 / 名言 / 标志性动作 等\n\n示例:\n# 与其他角色的关系\n- 苏蓉蓉: 主仆, 自幼相识\n- 独孤琰: 君臣, 表面恭敬\n\n# 情绪范围\n- 平日: 谨慎内敛\n- 危急: 偶尔决断`}
            className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono resize-y"
          />
        ) : extraText ? (
          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{extraText}</div>
        ) : (
          <div className="text-sm text-text-tertiary italic">无补充描述</div>
        )}
      </div>

      {/* 三视图预览 */}
      {sheetImg?.url && (
        <div className="glass p-4 mb-4">
          <h2 className="font-semibold mb-2 text-text-primary flex items-center gap-1.5">
            <ImageIcon size={16} className="text-blue-400" />
            三视图预览
          </h2>
          <ImageWithLoading
            src={sheetImg.url}
            alt="character sheet"
            aspectRatio="3/4"
            containerClassName="rounded border border-border overflow-hidden"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="flex gap-2 flex-wrap items-center justify-end sticky bottom-0 bg-bg-primary/80 backdrop-blur p-2 -mx-2">
        {editing ? (
          <>
            <button onClick={() => {
              setEditing(false);
              // 恢复原值
              setNameDraft(character.name);
              setAliasesDraft((character.aliases || []).join(', '));
              setRoleTypeDraft(character.roleType || 'supporting');
              setDescriptionDraft(descText);
              setExtraDescriptionDraft(extraText);
            }} className="btn-ghost text-sm flex items-center gap-1">
              <X size={14} /> 取消
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
              {saving ? <><Loader size={14} className="animate-spin" />保存中...</> : <><Save size={14} />保存</>}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm flex items-center gap-1">
              <Edit2 size={14} /> 编辑
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || character.confirmed}
              className="btn-primary text-sm flex items-center gap-1"
            >
              {confirming ? <><Loader size={14} className="animate-spin" />确认中...</>
                : character.confirmed ? <><CheckCircle size={14} />已确认</>
                : <><CheckCircle size={14} />确认描述</>}
            </button>
            <button
              onClick={handleGenerateImages}
              disabled={generatingImages || !character.confirmed || character.imageGenStatus === 'generating'}
              className="btn-primary text-sm flex items-center gap-1"
              title={!character.confirmed ? '请先确认描述' : ''}
            >
              {generatingImages ? <><Loader size={14} className="animate-spin" />生成中...</>
                : character.imageGenStatus === 'completed' ? <><Sparkles size={14} />重新生图</>
                : <><Sparkles size={14} />生成三视图</>}
            </button>
          </>
        )}
      </div>

      {generatingResult && (
        <div className="glass p-3 mt-3 text-sm text-center">{generatingResult}</div>
      )}
    </div>
  );
}
