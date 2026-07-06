"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.characterModel = exports.CharacterModel = void 0;
const db_1 = require("./db");
class CharacterModel {
    async create(character) {
        // v2.5.36: 修复双层 JSON BUG — caller 可能已 stringify, 也可能传 object
        //   - 如果是 string: 已经是合法 JSON, 直接存
        //   - 如果是 object: 调 JSON.stringify 一次
        // 之前的代码无脑 stringify, 如果 caller 传 string 会变成双层 JSON (触发 fix-double-json 端点)
        const desc = character.description;
        const extraDesc = character.extraDescription;
        const descStr = desc === undefined || desc === null
            ? null
            : typeof desc === 'string' ? desc : JSON.stringify(desc);
        const extraDescStr = extraDesc === undefined || extraDesc === null
            ? null
            : typeof extraDesc === 'string' ? extraDesc : JSON.stringify(extraDesc);
        await (0, db_1.execute)(`INSERT INTO characters (id, novel_id, name, aliases, appearance, personality,
       role_type, relationships, reference_image, description, extra_description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [character.id, character.novelId, character.name, JSON.stringify(character.aliases),
            character.appearance || '', character.personality || '', character.roleType,
            JSON.stringify(character.relationships), character.referenceImage || '',
            descStr, extraDescStr, character.createdAt]);
    }
    async findById(id) {
        const row = await (0, db_1.queryOne)('SELECT * FROM characters WHERE id = ?', [id]);
        if (!row)
            return undefined;
        return this.mapRowToCharacter(row);
    }
    async findByNovelId(novelId) {
        const rows = await (0, db_1.queryAll)('SELECT * FROM characters WHERE novel_id = ?', [novelId]);
        return rows.map(row => this.mapRowToCharacter(row));
    }
    async bulkCreate(characters) {
        for (const character of characters) {
            await this.create(character);
        }
    }
    async update(id, data) {
        const sets = [];
        const params = [];
        if (data.name !== undefined) {
            sets.push('name = ?');
            params.push(data.name);
        }
        if (data.appearance !== undefined) {
            sets.push('appearance = ?');
            params.push(data.appearance);
        }
        if (data.personality !== undefined) {
            sets.push('personality = ?');
            params.push(data.personality);
        }
        if (data.roleType !== undefined) {
            sets.push('role_type = ?');
            params.push(data.roleType);
        }
        if (sets.length === 0)
            return;
        params.push(id);
        await (0, db_1.execute)(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    /**
     * v2.5.11: 全字段更新 (含 description/extra_description JSON)
     * 用户在 Web 端编辑后保存使用
     * 同时: confirmed 保留, image_gen_status 保留 (避免破坏已生成图)
     */
    async updateFull(id, data) {
        const sets = [];
        const params = [];
        if (data.name !== undefined) {
            sets.push('name = ?');
            params.push(data.name);
        }
        if (data.aliases !== undefined) {
            sets.push('aliases = ?');
            params.push(JSON.stringify(data.aliases));
        }
        if (data.appearance !== undefined) {
            sets.push('appearance = ?');
            params.push(data.appearance);
        }
        if (data.personality !== undefined) {
            sets.push('personality = ?');
            params.push(data.personality);
        }
        if (data.roleType !== undefined) {
            sets.push('role_type = ?');
            params.push(data.roleType);
        }
        // v2.5.34: description / extraDescription 改为字符串直接存, 不再 JSON.stringify
        if (data.description !== undefined) {
            sets.push('description = ?');
            params.push(typeof data.description === 'string' ? data.description : String(data.description || ''));
        }
        if (data.extraDescription !== undefined) {
            sets.push('extra_description = ?');
            params.push(typeof data.extraDescription === 'string' ? data.extraDescription : String(data.extraDescription || ''));
        }
        if (sets.length === 0)
            return;
        params.push(id);
        await (0, db_1.execute)(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    mapRowToCharacter(row) {
        return {
            id: row.id,
            novelId: row.novel_id,
            name: row.name,
            aliases: typeof row.aliases === 'string' ? JSON.parse(row.aliases || '[]') : (row.aliases || []),
            appearance: row.appearance,
            personality: row.personality,
            roleType: row.role_type,
            relationships: typeof row.relationships === 'string' ? JSON.parse(row.relationships || '[]') : (row.relationships || []),
            referenceImage: row.reference_image,
            // v2.5.27: 暴露 description/image_variants 给漫画 DNA 注入用
            description: typeof row.description === 'string' ? row.description : (row.description ? JSON.stringify(row.description) : undefined),
            extraDescription: typeof row.extra_description === 'string' ? row.extra_description : (row.extra_description ? JSON.stringify(row.extra_description) : undefined),
            imageVariants: typeof row.image_variants === 'string'
                ? (row.image_variants ? JSON.parse(row.image_variants) : [])
                : (row.image_variants || []),
            imageGenStatus: row.image_gen_status,
            imageGeneratedAt: row.image_generated_at,
            styleId: row.style_id,
            confirmed: row.confirmed === 1 || row.confirmed === true,
            createdAt: row.created_at,
        };
    }
}
exports.CharacterModel = CharacterModel;
exports.characterModel = new CharacterModel();
