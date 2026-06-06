/**
 * 风格圣经 (Style Bible) 系统 — v2.5.13 重构
 *
 * 核心原则: "style-as-suffix" 不起作用, 必须把风格触发词**嵌入场景描写**里。
 *  - 剧本/角色/镜头/图片 prompt 在末尾追加 `<style_name>` 会被模型忽略
 *  - 正确做法: 在场景描写中使用 painterly / anime / cyber / photographic 等具体语言
 *
 * 一份"风格圣经"在所有生成流中作为不可变锚点:
 *  1. 剧本内容生成 (脚本/对话/场景)
 *  2. 角色描述生成
 *  3. 角色三视图生成
 *  4. 剧本场景图片生成
 *  5. 视频生成 (未来)
 */

export type StylePresetId = 'realistic' | 'ancient' | 'cyber' | 'anime' | '3d';

export interface StyleBible {
  version: string;
  styleId: StylePresetId;
  styleName: string;
  styleNameEn: string;
  generatedAt: number;
  generatedBy: 'preset' | 'llm' | 'manual';
  visual: {
    genre_zh: string;
    genre_en: string;
    /** v2.5.13 — 具体到"使用何种绘画/摄影语言描述", 而非简单 "电影写实" */
    renderer_zh: string;
    renderer_en: string;
    quality_zh: string;
    quality_en: string;
    lighting_zh: string;
    lighting_en: string;
    colorStyle_zh: string;
    colorStyle_en: string;
    background_zh: string;
    background_en: string;
    ethnicity: string;
    palette: {
      saturation: 'low' | 'medium' | 'high';
      temperature: 'warm' | 'cool' | 'neutral';
      hexPrimary: string[];
      hexAccent: string[];
    };
    composition: {
      camera_default: string;
      framing: string;
      aspectRatio: string;
    };
    /** v2.5.13 — 风格专属"动作描写"语言, 注入剧本和分镜 prompt */
    motionLanguage_zh: string;
    motionLanguage_en: string;
  };
  fidelityAnchors: {
    zh: string[];
    en: string[];
  };
  contentToAvoid: {
    zh: string[];
    en: string[];
  };
  negativePrompt: string[];
  /** v2.5.13 — 关键短语锚点, 用来"强迫 LLM 在描述中至少使用这些词" */
  styleTriggerWords: {
    zh: string[];
    en: string[];
  };
  voiceAndTone: {
    writingStyle: string;
    narrativeVoice: string;
    emotionalTone: string;
    vocabulary: string;
    dialogueStyle: string;
    sentencePattern: string;
    /** v2.5.13 — 给剧本生成时用, 具体的对白示例 */
    dialogueExample: string;
  };
  rendering: {
    imageEngine: string;
    videoEngine: string;
    referenceStrategy: string;
  };
}

const PRESET_BIBLES: Record<StylePresetId, Omit<StyleBible, 'generatedAt' | 'generatedBy'>> = {
  realistic: {
    version: '2.5.13',
    styleId: 'realistic',
    styleName: '电影写实风格',
    styleNameEn: 'Cinematic Realistic',
    visual: {
      genre_zh: '超写实电影质感, 仿胶片摄影, 商业电影剧照级',
      genre_en: 'ultra realistic, photorealistic, cinematic photography, film still, commercial movie quality',
      renderer_zh: '使用"摄影镜头"语言: 85mm 人像镜头, f/1.4 大光圈浅景深, 三点布光, 胶片颗粒, 皮肤毛孔级细节',
      renderer_en: 'Use photographic language: 85mm portrait lens, f/1.4 shallow depth of field, three-point lighting, film grain, pore-level skin detail',
      quality_zh: '8K高细节, 皮肤纹理真实, 锐利焦点, 商业摄影品质, 电影级调色, HDR, 胶片质感',
      quality_en: '8k uhd, high detail, sharp focus, skin texture realistic, high dynamic range, global illumination, cinematic color grading, film grain',
      lighting_zh: '柔和的摄影棚灯光, 三点布光(主光+补光+轮廓光), 自然光, 黄金时刻, 阴天的柔光',
      lighting_en: 'studio soft light, three-point lighting setup, soft frontal key light, low intensity fill light, subtle rim light edge separation, golden hour',
      colorStyle_zh: '低饱和度, 柔和灰调, 干净影棚色调, 自然色彩分级, 暖色皮肤色调, 避免糖果色',
      colorStyle_en: 'low saturation, soft gray tone, clean studio palette, natural color grading, warm skin tones, avoid candy colors',
      background_zh: '纯浅灰色无缝影棚背景, 或真实自然环境(街道/办公室/咖啡馆), 干净背景, 自然虚化',
      background_en: 'pure light gray seamless studio background, or real natural environment (street/office/cafe), clean backdrop, natural bokeh',
      ethnicity: 'east asian',
      palette: { saturation: 'low', temperature: 'neutral', hexPrimary: ['#E8E8E8', '#C8C8C8', '#A0A0A0'], hexAccent: ['#D4A574', '#8B6F47', '#5C4A3A'] },
      composition: { camera_default: '85mm portrait lens, shallow depth of field, eye-level', framing: 'rule of thirds, subject-centered, negative space for atmosphere', aspectRatio: '3:2 or 16:9 cinematic' },
      motionLanguage_zh: '人物动作符合重力与惯性, 步态自然, 衣物随真实物理摆动, 头发随气流, 不出现违反物理的浮空/瞬移',
      motionLanguage_en: 'character movements obey gravity and inertia, natural gait, clothing sways with real physics, hair follows air flow, no anti-gravity or teleportation',
    },
    fidelityAnchors: {
      zh: ['同一人物面容与体型贯穿所有镜头', '服装色彩款式保持一致(已确认角色描述为准)', '三点布光方向固定(主光来自左前方)', '色温统一(自然日光 5500K 或棚灯 5000K)', '统一的色彩分级与后期风格'],
      en: ['same face and body type across all shots', 'consistent clothing color and style (use confirmed character description)', 'fixed three-point lighting direction (key light from upper-left)', 'unified color temperature (daylight 5500K or studio 5000K)', 'consistent color grading and post-processing'],
    },
    contentToAvoid: {
      zh: ['古风/水墨/工笔元素', '赛博朋克/霓虹/未来科技', '动漫/卡通/Q版', '水彩/油画/插画风格', '现代电子产品作为主体(手机/电脑可作道具)'],
      en: ['ancient chinese painting, ink wash, gongbi elements', 'cyberpunk, neon, futuristic technology', 'anime, cartoon, chibi style', 'watercolor, oil painting, illustration', 'modern electronics as main subject (phones/computers can be props)'],
    },
    negativePrompt: ['anime, cartoon, chibi, illustration, painting, sketch', 'cyberpunk, neon, futuristic, sci-fi', 'ancient painting, ink wash, watercolor, traditional art', 'low quality, blurry, low resolution, jpeg artifacts', 'deformed face, bad anatomy, extra limbs, extra fingers', 'oversaturated, harsh shadows, blown highlights', 'watermark, text, logo, signature, frame, border', 'multiple people in single character shot', 'background scenery, busy background', '3d render, cgi, plastic skin'],
    styleTriggerWords: {
      zh: ['超写实', '电影质感', '商业摄影', '胶片', '浅景深', '三点布光', '黄金时刻', '皮肤纹理', '毛孔级', '胶片颗粒'],
      en: ['photorealistic', 'cinematic', 'film still', '8k', '85mm', 'f/1.4', 'bokeh', 'film grain', 'natural lighting', 'commercial photography'],
    },
    voiceAndTone: {
      writingStyle: '现代白话文, 电影剧本式描写, 动作与对白并重, 不使用诗词化语言',
      narrativeVoice: '第三人称限知视角, 紧贴主角感官, 镜头感强',
      emotionalTone: '克制内敛, 以动作暗示情绪, 留白多',
      vocabulary: '现代汉语, 必要时引用古文/诗句点缀, 避免华丽辞藻',
      dialogueStyle: '口语化, 性格化, 潜台词丰富, 简短有力',
      sentencePattern: '长短句结合, 紧张场景用短句, 抒情用长句',
      dialogueExample: '林小月: (低声) "我从来没有要过那本功法。"\n    她把茶盏放下, 茶水溅在案上。\n    (镜头 0-2 秒) 她的手停在半空, 2-3 秒手指微微颤抖, 然后收回去。\n    旁白: 皇城的夜风带着松香, 可殿内没有风。',
    },
    rendering: { imageEngine: 'Agnes Image 2.0 Flash / Midjourney v6 --style raw / Flux 1.1 Pro', videoEngine: 'Kling 1.6 / Runway Gen-3 / Stable Video Diffusion', referenceStrategy: '第一张三视图作为角色参考, --cref / IP-Adapter 复用' },
  },
  ancient: {
    version: '2.5.13',
    styleId: 'ancient',
    styleName: '古风水墨风格',
    styleNameEn: 'Chinese Traditional Ink Painting',
    visual: {
      genre_zh: '古风水墨风格, 国风美学, 工笔与写意结合, 文人画意境',
      genre_en: 'chinese traditional ink painting style, guofeng aesthetic, ink wash painting, gongbi and xieyi combined, literati painting',
      renderer_zh: '使用"毛笔/宣纸"语言: 湿墨晕染, 干笔皴擦, 留白意境, 矿物颜料点缀(朱砂/石青/赭石/花青), 不用"光圈/焦段"等摄影词汇',
      renderer_en: 'Use brush-and-paper language: wet ink washes, dry-brush texture, empty space (liubai) for atmosphere, mineral pigment accents (cinnabar, azurite, ochre, flower blue), NO photographic terms like f-stop or focal length',
      quality_zh: '高品质工笔+写意, 细腻线条, 传统质感, 绢帛渲染, 留白意境, 卷轴构图',
      quality_en: 'high quality gongbi and xieyi, fine brushwork, silk texture, gongbi style, empty space for atmosphere, vertical scroll composition',
      lighting_zh: '柔和自然光, 灯笼暖光, 烛光效果, 月光清辉, 不用"三点布光/黄金时刻"等摄影光位',
      lighting_en: 'soft natural light, warm lantern glow, candlelight effect, moonlight, NO photographic three-point lighting terms',
      colorStyle_zh: '水墨色调, 低饱和度古风配色, 绢帛质感, 矿物颜料, 朱砂点缀, 不用"霓虹/高饱和"',
      colorStyle_en: 'ink wash color palette, low saturation ancient chinese tones, silk brocade feel, mineral pigment colors, cinnabar accents, NO neon or high-saturation',
      background_zh: '古典园林, 宣纸纹理, 山水云雾, 亭台楼阁, 留白构图, 不要实景摄影背景',
      background_en: 'classical chinese garden, rice paper (xuan paper) texture, landscape mist, pavilions and towers, empty space composition, NOT photographic backgrounds',
      ethnicity: 'east asian',
      palette: { saturation: 'low', temperature: 'warm', hexPrimary: ['#F5E6D3', '#E8D4B8', '#D4A574'], hexAccent: ['#8B0000', '#2F4F4F', '#DAA520', '#4A0E0E'] },
      composition: { camera_default: 'vertical scroll, deep focus, layer-by-layer depth', framing: '中式留白构图, 主体居中或三分, 背景大面积留白, 远山/飞鸟/垂柳/亭台作配景', aspectRatio: '3:2 or vertical 4:5' },
      motionLanguage_zh: '动作缓慢如画卷展开, 衣袂飘举如风吹云, 步态轻盈如踏水, 兵器交锋如墨痕, 不用"高速摄影/慢动作/爆炸冲击"等电影特效词汇',
      motionLanguage_en: 'movements unfold slowly like a painting scroll, sleeves flutter like wind-driven clouds, footsteps light as on water, weapons clash like brushstrokes, NO high-speed photography or blockbuster VFX terms',
    },
    fidelityAnchors: {
      zh: ['汉服/唐装/明制等传统服饰款式保持时代一致', '发髻发饰遵循古代规制(如百合髻/飞天髻/堕马髻/灵蛇髻)', '传统建筑, 家具, 器皿均按朝代还原', '水墨留白风格贯穿所有画面', '低饱和度矿物色系(朱砂/石青/赭石/花青)', '人物动作遵循古代礼仪规范(揖礼/抱拳/万福)'],
      en: ['hanfu/tangzhuang/mingzhi clothing styles consistent with era', 'hairstyle and hair accessories follow ancient regulations (baihe ji/feitian ji/duoma ji/lingshe ji)', 'traditional architecture, furniture, vessels restored by dynasty', 'ink wash empty space style throughout all images', 'low saturation mineral pigment palette (cinnabar/azurite/ochre/flower blue)', 'character actions follow ancient etiquette norms (yi li/bao quan/wan fu)'],
    },
    contentToAvoid: {
      zh: ['现代物品(手机/汽车/玻璃幕墙/西装/高跟鞋)', '西式建筑与家具(哥特/罗马柱/欧式沙发)', '霓虹灯/电灯/电视/LED屏等现代光源', '蒸汽朋克/科幻元素/激光/飞行器', '写实3D渲染/塑料感皮肤/PBR材质', '动漫/卡通/Q版/表情包', '胶片摄影/8K/浅景深/三点布光(用毛笔/宣纸语言)'],
      en: ['modern objects (phones, cars, glass curtain walls, western suits, high heels)', 'western architecture and furniture (gothic, roman columns, european sofa)', 'neon lights, electric lights, TVs, LED screens', 'steampunk, sci-fi, lasers, flying vehicles', 'photorealistic 3d render, plastic skin, PBR material', 'anime, cartoon, chibi, sticker', 'photographic terms (film grain, 8K, shallow DOF, three-point lighting) — use brush-and-paper language instead'],
    },
    negativePrompt: ['modern, contemporary, anachronistic elements', 'western clothing, western architecture, suits, ties', 'neon, electric, sci-fi, futuristic, LED, fluorescent', 'anime, cartoon, chibi, 3d cgi, plastic, PBR', 'photographic, 8k uhd, film grain, bokeh, f/1.4, three-point lighting', 'low quality, blurry, watermark, text', 'oversaturated, neon colors, modern photography', 'cyborg, robot, android, spaceship, hologram'],
    styleTriggerWords: {
      zh: ['水墨', '工笔', '写意', '留白', '晕染', '皴擦', '朱砂', '石青', '宣纸', '绢帛', '汉服', '发髻', '烛光', '月色', '卷轴'],
      en: ['ink wash', 'gongbi', 'xieyi', 'liubai empty space', 'mineral pigment', 'xuan paper', 'silk brocade', 'hanfu', 'cinnabar', 'azurite', 'calligraphy', 'vertical scroll', 'candlelight'],
    },
    voiceAndTone: {
      writingStyle: '文言文与白话文结合, 诗词化对白, 意境渲染为主, 大量使用四字成语与对仗',
      narrativeVoice: '第三人称全知视角或限知主角视角, 镜头如画卷徐徐展开',
      emotionalTone: '含蓄内敛, 以景写情, 借物抒怀, 哀而不伤',
      vocabulary: '古汉语词汇, 诗词典故, 成语运用, 称谓与敬语按朝代使用(陛下/臣/本座/小生/姑娘)',
      dialogueStyle: '半文半白, 符合人物身份(帝王/将相/书生/侠客各有语风), 留白与潜台词',
      sentencePattern: '四字句与长短句结合, 对仗排比点缀, 善用叠词与通感',
      dialogueExample: '林小月: (敛衽一礼) "小女林氏, 见过大人。"\n    长风卷起裙裾, 竹叶簌簌如诉。\n    (镜头 0-2 秒) 她的目光如秋水, 落在案上那柄断剑之上, 2-4 秒缓缓抬首, 眉宇间尽是隐忍。\n    画外音: 那一年的长安, 杏花微雨, 故人未归。',
    },
    rendering: { imageEngine: 'Agnes Image 2.0 Flash / SDXL + 国风LoRA / Midjourney v6 --niji 6', videoEngine: '可灵1.6国风模式 / 即梦AI国风模型', referenceStrategy: '传统纹样LoRA + 第一张三视图作角色参考' },
  },
  cyber: {
    version: '2.5.13',
    styleId: 'cyber',
    styleName: '赛博朋克科幻风格',
    styleNameEn: 'Cyberpunk Sci-Fi',
    visual: {
      genre_zh: '赛博朋克科幻风格, 未来都市美学, 霓虹美学, 银翼杀手/攻壳特攻级',
      genre_en: 'cyberpunk sci-fi style, futuristic urban aesthetic, neon aesthetic, blade runner / ghost in the shell quality',
      renderer_zh: '使用"霓虹/全息/义体"语言: 青蓝紫霓虹边缘光, 全息广告牌, 雨夜反射, 义体改造可见, 35mm 广角, 体积光',
      renderer_en: 'Use neon/hologram/cybernetic language: teal-magenta rim light, holographic billboards, rain-slicked streets, visible cybernetic implants, 35mm wide angle, volumetric lighting',
      quality_zh: '高细节, 霓虹渲染, 金属质感, 全息投影, 玻璃反射, 体积光',
      quality_en: 'high detail, neon rendering, metallic texture, hologram projection, glass reflection, volumetric light, anamorphic lens flare',
      lighting_zh: '霓虹灯光(青/蓝/紫/粉), 蓝色和粉色补光, 雨夜反射, UV黑光, 体积光, 强边缘光',
      lighting_en: 'neon lighting, teal-magenta rim light, rain reflection, UV blacklight, volumetric light, strong rim lighting',
      colorStyle_zh: '冷色调主导, 霓虹色彩(青/蓝/紫/粉/品红), 高对比度, 黑紫底色, 不用暖色调',
      colorStyle_en: 'cool tone, neon colors (cyan, blue, purple, pink, magenta), high contrast, black-purple base, no warm tones',
      background_zh: '赛博城市, 霓虹招牌(中日韩英混合文字), 摩天楼, 全息广告牌, 雨夜街道, 烟雾蒸汽',
      background_en: 'cyber city, neon signs (CJK + English mixed), skyscrapers, holographic billboards, rainy night streets, smoke and steam',
      ethnicity: 'mixed asian / caucasian',
      palette: { saturation: 'high', temperature: 'cool', hexPrimary: ['#0A0E27', '#1A1A2E', '#16213E'], hexAccent: ['#00F5FF', '#FF006E', '#8338EC', '#3A86FF'] },
      composition: { camera_default: '35mm wide angle, deep focus, dutch angle', framing: 'Dutch angle, low angle, leading lines from neon signs, anamorphic lens flare', aspectRatio: '21:9 cinematic or 16:9' },
      motionLanguage_zh: '动作充满机械感与速度感, 义体部分带电光特效, 雨滴/霓虹反射与动作同步, 用"数据流/光纤/芯片"等科幻词汇',
      motionLanguage_en: 'movements full of mechanical and speed feel, cybernetic parts with electric glow effects, raindrops/neon reflections synchronized with action, sci-fi vocabulary like "data stream / fiber optic / chip"',
    },
    fidelityAnchors: {
      zh: ['霓虹色系(青/蓝/紫/粉)贯穿所有画面', '未来都市建筑风格一致(摩天楼/全息广告)', '金属/玻璃/全息等高反射材质统一', '义体改造/机械植入元素保持角色特征', '雨夜/雾气/烟雾氛围统一'],
      en: ['neon color palette (cyan/blue/purple/pink) throughout all images', 'consistent futuristic urban architecture (skyscrapers, holographic ads)', 'unified metallic/glass/holographic reflective materials', 'prosthetic modification/mechanical implant elements consistent per character', 'unified rainy/foggy/smoky atmosphere'],
    },
    contentToAvoid: {
      zh: ['古风/水墨/工笔', '田园/乡村/古代建筑', '棉麻/丝绸/汉服', '田园诗/诗词化对白', '木质/石质/陶器等传统材质', '暖色调/夕阳/烛光(赛博是冷霓虹)'],
      en: ['ancient chinese painting, ink wash, gongbi', 'pastoral, rural, ancient architecture', 'cotton/linen/silk/hanfu', 'pastoral poetry, poetic dialogue', 'wood/stone/pottery traditional materials', 'warm tones, sunset, candlelight (cyber is cool neon)'],
    },
    negativePrompt: ['ancient, traditional, pastoral, rural', 'hanfu, silk, cotton clothing', 'ink wash, watercolor, oil painting, anime', 'warm tone, golden hour, sunset, candlelight', 'low quality, blurry, watermark, text', 'daylight, bright sunny, natural color palette', 'wood, stone, pottery, traditional materials', 'fantasy, medieval, magic'],
    styleTriggerWords: {
      zh: ['霓虹', '赛博朋克', '全息', '义体', '机械植入', '数据流', '光纤', '玻璃幕墙', '雨夜', '摩天楼', '电子脉冲'],
      en: ['cyberpunk', 'neon', 'hologram', 'cybernetic', 'prosthetic', 'rain-slicked', 'teal-magenta rim light', 'volumetric light', 'anamorphic lens flare', 'fiber optic', 'data stream'],
    },
    voiceAndTone: {
      writingStyle: '硬科幻/赛博朋克式硬汉对白, 技术术语与黑话并用, 不用诗词化语言',
      narrativeVoice: '第一人称或第三人称限知, 孤独的局外人视角, 黑色幽默',
      emotionalTone: '冷酷疏离, 反乌托邦, 偶尔的悲悯与觉醒',
      vocabulary: '网络用语, 技术黑话, 英文术语混合, 义体/芯片/公司/数据术语',
      dialogueStyle: '短句硬话, 意象化的技术描写, 频繁使用代号与缩写',
      sentencePattern: '短促有力, 电报式句子, 留白多, 像监控日志',
      dialogueExample: '林小月: (头戴神经接口) "Signal lost. 义体过热。"\n    她的左手芯片闪烁蓝光, 雨水顺着金属关节滴落。\n    (镜头 0-2 秒) 瞳孔缩放如瞄准镜, 2-4 秒拔枪, 0.5 秒内开火。\n    旁白: 2099 年, 雾城 47 层, 信号塔下又死了一个跑单的外包黑客。',
    },
    rendering: { imageEngine: 'Agnes Image 2.0 Flash / SDXL + 赛博LoRA / Midjourney v6', videoEngine: '可灵1.6 / Runway Gen-3 Alpha Turbo', referenceStrategy: '霓虹色彩 + 第一张三视图作角色参考' },
  },
  anime: {
    version: '2.5.13',
    styleId: 'anime',
    styleName: '日系动漫风格',
    styleNameEn: 'Japanese Anime Style',
    visual: {
      genre_zh: '日系动漫风格, 赛璐璐渲染, 新海诚/京都动画美学, 高饱和度清爽调色',
      genre_en: 'japanese anime style, cel-shaded rendering, shinkai / kyoani aesthetic, vibrant flat color palette',
      renderer_zh: '使用"赛璐璐/线条"语言: 干净线条, 平涂上色, 樱花粉/天空蓝调色, 大眼尖下巴, 不用"皮肤毛孔/光圈/3D渲染"等写实词汇',
      renderer_en: 'Use cel-shading/lineart language: clean lineart, flat color, sakura pink / sky blue palette, large eyes, pointed chin, NO realistic terms like "skin pores, f-stop, 3d render"',
      quality_zh: '高清动漫渲染, 干净线条, 赛璐璐风格, 精致五官, 头发有发光感, 不要写实皮肤质感',
      quality_en: 'high definition anime rendering, clean lineart, cel animation style, refined features, hair has glow effect, NO realistic skin texture',
      lighting_zh: '动漫光效, 明暗分明, 光晕柔光, 背景渲染, 关键光, 不用三点布光',
      lighting_en: 'anime lighting, clear light and shadow, halo soft light, detailed background, key light, NO three-point lighting',
      colorStyle_zh: '明亮色彩, 清新日系调色, 樱花粉/天空蓝/薄荷绿, 高饱和, 不用低饱和灰调',
      colorStyle_en: 'bright vivid colors, fresh japanese color palette, sakura pink, sky blue, mint green, high saturation, NO low saturation gray',
      background_zh: '校园/樱花/海岛/夏日祭/电车/便利店, 动漫常见场景, 不用"写字楼/咖啡馆"',
      background_en: 'school, sakura, island, summer festival, train, convenience store, classic anime settings, NO office buildings or cafes',
      ethnicity: 'east asian',
      palette: { saturation: 'medium', temperature: 'warm', hexPrimary: ['#FFB7C5', '#87CEEB', '#FFFACD'], hexAccent: ['#FF6B6B', '#4ECDC4', '#FFE66D'] },
      composition: { camera_default: 'anime 50mm equivalent, character focused', framing: 'key visual composition, dynamic angle, emotional close-up, speed lines', aspectRatio: '3:2 or 16:9' },
      motionLanguage_zh: '动作带速度线与残影, 情绪化大表情, 颜文字式反应, 头发动态夸张(飘/炸/呆毛), 不用"重力/惯性"等物理词汇',
      motionLanguage_en: 'movements with speed lines and afterimages, exaggerated emotional expressions, emoji-like reactions, hair dynamics exaggerated (flowing/spiking/ahoge), NO physics terms like gravity or inertia',
    },
    fidelityAnchors: {
      zh: ['动漫大眼(占脸1/3), 尖下巴, 高发际线, 风格统一', '赛璐璐平涂上色风格', '服装款式按动漫设定还原(JK制服/魔法少女/和风/运动服)', '发色夸张(银/粉/蓝/紫)但保持角色特征', '情绪化大表情与情绪符号(汗滴/黑线/爱心眼/星星眼)'],
      en: ['unified anime large eyes (1/3 of face), pointed chin, high hairline', 'cel-shading flat color style', 'costume design according to anime setting (JK uniform, magical girl, japanese style, sportswear)', 'exaggerated hair colors (silver/pink/blue/purple) but character-consistent', 'emotional exaggerated expressions and emotion symbols (sweat drop, dark line, heart eyes, star eyes)'],
    },
    contentToAvoid: {
      zh: ['写实摄影风格', '3D CG渲染', '古风水墨/工笔', '赛博朋克/霓虹', '油画/水彩/插画', '皮肤毛孔/雀斑/皱纹(动漫皮肤是光滑的)'],
      en: ['photorealistic photography', '3d cg render', 'ancient chinese painting', 'cyberpunk, neon', 'oil painting, watercolor, illustration', 'skin pores, freckles, wrinkles (anime skin is smooth)'],
    },
    negativePrompt: ['photorealistic, 3d render, realistic photography, real person', 'western cartoon, comic book, marvel style', 'ancient, cyberpunk, neon, ink wash', 'low quality, blurry, watermark, text', 'ugly, deformed face, bad anatomy', 'harsh shadows, dark gritty, film grain, bokeh', 'subsurface scattering, octane render, unreal engine', 'skin pores, freckles, wrinkles'],
    styleTriggerWords: {
      zh: ['动漫', '赛璐璐', '线条', '平涂', '大眼', '尖下巴', '樱花粉', '天空蓝', 'JK制服', '魔法少女', '和风', '速度线', '颜文字'],
      en: ['anime', 'cel-shaded', 'lineart', 'flat color', 'large eyes', 'sakura pink', 'sky blue', 'JK uniform', 'magical girl', 'speed lines', 'key visual', 'Makoto Shinkai', 'Kyoto Animation'],
    },
    voiceAndTone: {
      writingStyle: '轻小说风格, 动漫化对白, 第二人称内心独白, 大量语气词与颜文字',
      narrativeVoice: '第一人称或第三人称限知, 紧贴主角, 内心戏丰富',
      emotionalTone: '青春, 热血, 治愈, 催泪, 偶尔中二',
      vocabulary: '日语借词(先輩/仲間/必杀/奥义), 动漫术语, 网络流行语, 颜文字',
      dialogueStyle: '情绪化, 颜文字符号, 夸张语气, 短句, 频繁的语气词',
      sentencePattern: '短句节奏感强, 感叹句与疑问句穿插, 善用叠词',
      dialogueExample: '林小月: (眼睛亮起来) "诶? 今天要去夏日祭吗? 太好了吧~"\n    她的双马尾随风轻扬, 裙摆如樱花飘落。\n    (镜头 0-2 秒) 她踮起脚尖, 双手合十, 2-4 秒原地转了一圈。\n    旁白: 这一年夏天, 我们都没有说再见。',
    },
    rendering: { imageEngine: 'Agnes Image 2.0 Flash / SDXL + Anime LoRA / NovelAI / Animagine XL', videoEngine: '可灵1.6动漫模式 / Sora / Pika', referenceStrategy: '动漫LoRA + 第一张三视图作角色参考' },
  },
  '3d': {
    version: '2.5.13',
    styleId: '3d',
    styleName: '3D渲染CG风格',
    styleNameEn: '3D CG Render Style',
    visual: {
      genre_zh: '3D渲染CG风格, PBR材质, 皮克斯/迪士尼质感, 风格化造型',
      genre_en: '3d cg render style, PBR material, pixar / disney quality, stylized character modeling',
      renderer_zh: '使用"CG渲染"语言: HDRI环境光, 次表面散射(SSS)皮肤, PBR材质, 光线追踪, 不要"胶片/浅景深"等纯摄影词汇',
      renderer_en: 'Use CG-render language: HDRI environment light, subsurface scattering (SSS) skin, PBR material, ray tracing, NO pure photographic terms like film grain or shallow DOF',
      quality_zh: '4K CG渲染, PBR材质, 全局光照, 次表面散射, 光线追踪, 高模细节',
      quality_en: '4k cg render, PBR material, global illumination, subsurface scattering, ray tracing, high-poly detail',
      lighting_zh: 'HDRI环境光, 三点照明, 柔和阴影, 镜面反射, 风格化布光(非自然光)',
      lighting_en: 'HDRI environment light, three-point lighting, soft shadows, specular reflection, stylized lighting (not natural light)',
      colorStyle_zh: '写实色彩 + 风格化色彩分级, 鲜艳但不过饱和, 玩具感色调',
      colorStyle_en: 'realistic color + stylized color grading, vibrant but not oversaturated, toy-like palette',
      background_zh: '3D影棚环境, 渐变色背景, HDR环境贴图, 道具精致, 不要实景摄影',
      background_en: '3d studio environment, gradient color background, HDR environment map, detailed props, NO real photography',
      ethnicity: 'mixed',
      palette: { saturation: 'medium', temperature: 'neutral', hexPrimary: ['#F0F0F0', '#D0D0D0', '#A0A0A0'], hexAccent: ['#FF6B6B', '#4ECDC4', '#FFD93D'] },
      composition: { camera_default: '35mm CG camera, f/2.8 cinematic bokeh', framing: 'Pixar-style staging, character-centric, dynamic camera', aspectRatio: '16:9 widescreen or 2.39:1 anamorphic' },
      motionLanguage_zh: '动作流畅带卡通夸张(弹跳/拉伸/挤压), 卡通物理感(重力夸张), 玩具感与拟人化, 不用"写实慢动作"',
      motionLanguage_en: 'movements fluid with cartoon exaggeration (squash and stretch), cartoon physics (exaggerated gravity), toy-like and anthropomorphic, NO realistic slow-motion',
    },
    fidelityAnchors: {
      zh: ['3D CG渲染质感(次表面散射/SSS皮肤), 皮克斯/迪士尼风格角色设计', 'HDRI统一环境光照', 'PBR材质(金属/塑料/布料/皮革/毛皮)', '风格化色彩分级', '统一的卡通物理夸张幅度'],
      en: ['3d cg render quality (subsurface scattering/SSS skin), Pixar/Disney style character design', 'unified HDRI environment lighting', 'PBR materials (metal/plastic/cloth/leather/fur)', 'stylized color grading', 'consistent cartoon physics exaggeration'],
    },
    contentToAvoid: {
      zh: ['2D动漫/手绘风格', '古风水墨', '真人摄影', '水彩/油画', '低多边形/像素风', '胶片颗粒/微距镜头/相机raw(用CG渲染语言)'],
      en: ['2d anime, hand-drawn, illustration', 'ancient chinese painting', 'real photography', 'watercolor, oil painting', 'low poly, pixel art, retro game', 'film grain, macro lens, camera raw — use CG-render language'],
    },
    negativePrompt: ['2d anime, hand-drawn, illustration', 'real photography, live action', 'ancient, ink wash, watercolor', 'low poly, pixel art, retro game', 'low quality, blurry, watermark, text', 'flat lighting, no depth', 'skin pores, freckles, wrinkles'],
    styleTriggerWords: {
      zh: ['3D渲染', 'CG', '皮克斯', '迪士尼', 'PBR', '次表面散射', 'HDRI', '风格化', '玩具感', '高模', '卡通物理'],
      en: ['3d cg render', 'Pixar', 'Disney', 'PBR material', 'subsurface scattering', 'HDRI', 'stylized', 'toy-like', 'high-poly', 'cartoon physics'],
    },
    voiceAndTone: {
      writingStyle: '动画电影剧本式, 夸张但有逻辑, 对白与动作并重, 适合所有年龄',
      narrativeVoice: '第三人称全知, 戏剧化叙事, 善用内心独白与画外音',
      emotionalTone: '夸张但不失控, 英雄主义, 伙伴情谊, 善恶分明',
      vocabulary: '现代白话, 动作描写词丰富, 拟声词多',
      dialogueStyle: '短句硬话, 动画式夸张, 善用反问与重复',
      sentencePattern: '节奏感强, 动作与心理交替, 善用排比',
      dialogueExample: '林小月: (一拍桌子) "我行的! 这次一定行!"\n    她整个人从椅子上弹起来, 双马尾跟着甩了一个大弧。\n    (镜头 0-2 秒) 她的眼睛亮得像两盏灯, 2-4 秒冲出门去, 留下目瞪口呆的小队。\n    旁白: 她就是这种人, 想到就做, 错了再改, 改完再冲。',
    },
    rendering: { imageEngine: 'Agnes Image 2.0 Flash / Midjourney v6 / Flux 1.1 Pro / SDXL', videoEngine: '可灵1.6 3D模式 / Runway Gen-3 / Stable Video Diffusion', referenceStrategy: 'CG风格参考 + 第一张三视图作角色参考' },
  },
};

export function buildStyleBible(styleId: StylePresetId): StyleBible {
  const preset = PRESET_BIBLES[styleId] || PRESET_BIBLES.realistic;
  return { ...preset, generatedAt: Date.now(), generatedBy: 'preset' };
}

export function buildStyleAnchorPrefix(bible: StyleBible, lang: 'zh' | 'en' | 'both' = 'both'): string {
  const lines: string[] = [];
  lines.push('=== STYLE ANCHOR (DO NOT PARAPHRASE - COPY EXACTLY) ===');
  if (lang === 'zh' || lang === 'both') {
    lines.push(`# 风格圣经 v${bible.version}: ${bible.styleName}`);
    lines.push(`视觉流派: ${bible.visual.genre_zh}`);
    lines.push(`渲染语言: ${bible.visual.renderer_zh}`);
    lines.push(`画质: ${bible.visual.quality_zh}`);
    lines.push(`光线: ${bible.visual.lighting_zh}`);
    lines.push(`色彩: ${bible.visual.colorStyle_zh}`);
    lines.push(`背景: ${bible.visual.background_zh}`);
    lines.push(`动作语言: ${bible.visual.motionLanguage_zh}`);
    lines.push('');
    lines.push('【一致性锚点 - 必须保留】');
    bible.fidelityAnchors.zh.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
    lines.push('【必须避免】');
    bible.contentToAvoid.zh.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
    lines.push('【必用风格触发词 — 描写时必须至少嵌入 5 个】');
    lines.push(bible.styleTriggerWords.zh.join('、'));
  }
  if (lang === 'en' || lang === 'both') {
    if (lang === 'both') lines.push('');
    lines.push(`# Style Bible v${bible.version}: ${bible.styleNameEn}`);
    lines.push(`Visual Genre: ${bible.visual.genre_en}`);
    lines.push(`Renderer: ${bible.visual.renderer_en}`);
    lines.push(`Render Quality: ${bible.visual.quality_en}`);
    lines.push(`Lighting: ${bible.visual.lighting_en}`);
    lines.push(`Color Style: ${bible.visual.colorStyle_en}`);
    lines.push(`Background: ${bible.visual.background_en}`);
    lines.push(`Ethnicity: ${bible.visual.ethnicity}`);
    lines.push(`Composition: ${bible.visual.composition.camera_default}, ${bible.visual.composition.framing}, aspect ratio ${bible.visual.composition.aspectRatio}`);
    lines.push(`Motion Language: ${bible.visual.motionLanguage_en}`);
    lines.push('');
    lines.push('[FIDELITY ANCHORS - MUST PRESERVE]');
    bible.fidelityAnchors.en.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
    lines.push('[CONTENT TO AVOID]');
    bible.contentToAvoid.en.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
    lines.push('[STYLE TRIGGER WORDS — embed at least 5 in every description]');
    lines.push(bible.styleTriggerWords.en.join(', '));
  }
  lines.push('=== END STYLE ANCHOR ===');
  return lines.join('\n');
}

export function buildStyleNegativePrompt(bible: StyleBible): string {
  return bible.negativePrompt.join(', ');
}

/**
 * v2.5.13 — 把"风格触发的对白示范 + 文风指南"一并注入, 让 LLM 看一眼就知道
 * 这种风格的对白长什么样。
 */
export function buildVoiceAndToneBlock(bible: StyleBible): string {
  const v = bible.voiceAndTone;
  return [
    '【本剧风格指南 - 不可违反】',
    `- 文风: ${v.writingStyle}`,
    `- 叙事视角: ${v.narrativeVoice}`,
    `- 情绪基调: ${v.emotionalTone}`,
    `- 词汇特点: ${v.vocabulary}`,
    `- 对白风格: ${v.dialogueStyle}`,
    `- 句式特点: ${v.sentencePattern}`,
    '',
    '【对白示范 — 严格模仿这种"质感", 不要写成另一种风格】',
    v.dialogueExample,
    '',
    '【风格触发词 — 描写时必须至少使用 5 个】',
    bible.styleTriggerWords.zh.join('、'),
    '',
    '所有剧本内容必须严格遵守以上风格指南,确保整部剧集风格统一。',
  ].join('\n');
}

export function buildStyleBibleJsonBlock(bible: StyleBible): string {
  return JSON.stringify({
    style_bible_version: bible.version,
    style_id: bible.styleId,
    style_name: bible.styleName,
    style_name_en: bible.styleNameEn,
    visual: {
      genre: bible.visual.genre_en,
      renderer: bible.visual.renderer_en,
      quality: bible.visual.quality_en,
      lighting: bible.visual.lighting_en,
      color: bible.visual.colorStyle_en,
      background: bible.visual.background_en,
      palette: bible.visual.palette,
      composition: bible.visual.composition,
      motion_language: bible.visual.motionLanguage_en,
    },
    fidelity_anchors: bible.fidelityAnchors.en,
    content_to_avoid: bible.contentToAvoid.en,
    style_trigger_words: bible.styleTriggerWords.en,
    negative_prompt: bible.negativePrompt,
    voice_and_tone: bible.voiceAndTone,
  }, null, 2);
}

export function parseStyleBible(json: string | null | undefined): StyleBible | null {
  if (!json) return null;
  try { return JSON.parse(json) as StyleBible; } catch { return null; }
}

export function listStylePresets(): Array<{ id: StylePresetId; name: string; nameEn: string }> {
  return Object.values(PRESET_BIBLES).map(p => ({ id: p.styleId, name: p.styleName, nameEn: p.styleNameEn }));
}
