"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENE_TEMPLATES = exports.PROMPT_TEMPLATES = void 0;
exports.selectBestTemplate = selectBestTemplate;
exports.applyTemplate = applyTemplate;
exports.PROMPT_TEMPLATES = [
    {
        id: 'sai-photographic',
        name: 'XieShiSheYing',
        scene: ['character', 'product', 'scene'],
        tags: ['photographic', 'photo', 'realistic', 'cinematic'],
        prompt: 'cinematic photo {prompt} . 35mm photograph, film, bokeh, professional, 4k, highly detailed',
        negative: 'drawing, painting, crayon, sketch, graphite, impressionist, noisy, blurry, soft, deformed, ugly',
    },
    {
        id: 'sai-cinematic',
        name: 'DianYingGan',
        scene: ['character', 'scene', 'concept'],
        tags: ['cinematic', 'epic', 'moody'],
        prompt: 'cinematic film still {prompt} . shallow depth of field, vignette, highly detailed, high budget, bokeh, cinemascope, moody, epic, gorgeous, film grain, grainy',
        negative: 'anime, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured',
    },
    {
        id: 'sai-line-art',
        name: 'XianGao',
        scene: ['logo', 'character'],
        tags: ['line', 'logo', 'minimalist', 'clean'],
        prompt: 'line art drawing {prompt} . professional, sleek, modern, minimalist, graphic, line art, vector graphics',
        negative: 'anime, photorealistic, 35mm film, deformed, glitch, blurry, noisy',
    },
    {
        id: 'ads-corporate',
        name: 'QiYePinPai',
        scene: ['logo'],
        tags: ['corporate', 'branding', 'professional', 'minimalist'],
        prompt: 'corporate branding style {prompt} . professional, clean, modern, sleek, minimalist, business-oriented, highly detailed',
        negative: 'noisy, blurry, grungy, sloppy, cluttered, disorganized',
    },
    {
        id: 'ads-luxury',
        name: 'SheHuaPinPai',
        scene: ['logo', 'product'],
        tags: ['luxury', 'high-end', 'elegant'],
        prompt: 'luxury product style {prompt} . elegant, sophisticated, high-end, luxurious, professional, highly detailed',
        negative: 'cheap, noisy, blurry, unattractive, amateurish',
    },
    {
        id: 'misc-minimalist',
        name: 'JiJian',
        scene: ['logo', 'concept'],
        tags: ['minimalist', 'simple', 'clean'],
        prompt: 'minimalist style {prompt} . simple, clean, uncluttered, modern, elegant',
        negative: 'ornate, complicated, highly detailed, cluttered, disordered, messy, noisy',
    },
    {
        id: 'photo-hdr',
        name: 'HDR FengJing',
        scene: ['scene'],
        tags: ['hdr', 'landscape', 'nature'],
        prompt: 'HDR photo of {prompt} . High dynamic range, vivid, rich details, clear shadows and highlights, realistic, intense, enhanced contrast, highly detailed',
        negative: 'flat, low contrast, oversaturated, underexposed, overexposed, blurred, noisy',
    },
    {
        id: 'futuristic-cyberpunk-cityscape',
        name: 'SaiBoPengKeChengShi',
        scene: ['scene', 'concept'],
        tags: ['city', 'cyberpunk', 'neon'],
        prompt: 'cyberpunk cityscape {prompt} . neon lights, dark alleys, skyscrapers, futuristic, vibrant colors, high contrast, highly detailed',
        negative: 'natural, rural, deformed, low contrast, black and white, sketch, watercolor',
    },
    {
        id: 'ads-advertising',
        name: 'GuangGaoHaiBao',
        scene: ['product', 'logo'],
        tags: ['ad', 'product', 'commercial'],
        prompt: 'advertising poster style {prompt} . Professional, modern, product-focused, commercial, eye-catching, highly detailed',
        negative: 'noisy, blurry, amateurish, sloppy, unattractive',
    },
    {
        id: 'ads-food-photography',
        name: 'MeiShiSheYing',
        scene: ['product'],
        tags: ['food', 'product', 'commercial'],
        prompt: 'food photography style {prompt} . appetizing, professional, culinary, high-resolution, commercial, highly detailed',
        negative: 'unappetizing, sloppy, unprofessional, noisy, blurry',
    },
    {
        id: 'sai-3d-model',
        name: '3D XuanRan',
        scene: ['product', 'concept'],
        tags: ['3d', 'product', 'render', 'octane'],
        prompt: 'professional 3d model {prompt} . octane render, highly detailed, volumetric, dramatic lighting',
        negative: 'ugly, deformed, noisy, low poly, blurry, painting',
    },
    {
        id: 'sai-digital-art',
        name: 'ShuZiYiShu',
        scene: ['concept'],
        tags: ['digital', 'concept', 'illustration'],
        prompt: 'concept art {prompt} . digital artwork, illustrative, painterly, matte painting, highly detailed',
        negative: 'photo, photorealistic, realism, ugly',
    },
    {
        id: 'sai-fantasy-art',
        name: 'QiHuanYiShu',
        scene: ['concept', 'character'],
        tags: ['fantasy', 'epic', 'magical'],
        prompt: 'ethereal fantasy concept art of {prompt} . magnificent, celestial, ethereal, painterly, epic, majestic, magical, fantasy art, cover art, dreamy',
        negative: 'photographic, realistic, realism, 35mm film, dslr, cropped, frame, text, deformed, glitch, ugly',
    },
    {
        id: 'sai-neonpunk',
        name: 'NiHongPengKe',
        scene: ['concept'],
        tags: ['neon', 'cyberpunk', 'vaporwave'],
        prompt: 'neonpunk style {prompt} . cyberpunk, vaporwave, neon, vibes, vibrant, stunningly beautiful, crisp, detailed, sleek, ultramodern, magenta highlights, dark purple shadows, high contrast, cinematic, ultra detailed, intricate, professional',
        negative: 'painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured',
    },
    {
        id: 'sai-enhance',
        name: 'JiChuZengQiang',
        scene: ['character', 'logo', 'scene', 'product', 'concept', 'other'],
        tags: ['basic', 'enhance'],
        prompt: 'breathtaking {prompt} . award-winning, professional, highly detailed',
        negative: 'ugly, deformed, noisy, blurry, distorted, grainy',
    },
];
exports.SCENE_TEMPLATES = {
    character: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('character')),
    logo: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('logo')),
    scene: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('scene')),
    product: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('product')),
    concept: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('concept')),
    other: exports.PROMPT_TEMPLATES.filter(t => t.scene.includes('other')),
};
function selectBestTemplate(sceneType, styleKeywords) {
    const candidates = exports.SCENE_TEMPLATES[sceneType] || exports.SCENE_TEMPLATES.other;
    if (candidates.length === 0) {
        return exports.PROMPT_TEMPLATES.find(t => t.id === 'sai-enhance');
    }
    let best = candidates[0];
    let bestScore = -1;
    for (const tpl of candidates) {
        let score = 0;
        for (const kw of styleKeywords) {
            const k = kw.toLowerCase().trim();
            if (!k)
                continue;
            if (tpl.name.toLowerCase().includes(k))
                score += 3;
            for (const tag of tpl.tags) {
                const t = tag.toLowerCase();
                if (t === k || t.includes(k) || k.includes(t))
                    score += 1;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = tpl;
        }
    }
    return best;
}
function applyTemplate(tpl, userPrompt, userNegative = '') {
    return {
        positive: tpl.prompt.replace(/\{prompt\}/g, userPrompt).trim(),
        negative: [tpl.negative, userNegative].filter(Boolean).join(', '),
    };
}
