/** 技能商店的 SKILL.md 元信息读取：以技能文件为唯一描述来源，不建立手工 JSON 索引。 */
import { SkillStoreError, validSkillId } from "./skill-archive.js";

/** 读取 YAML 普通或引号标量；参数为单行值，返回字符串，不解析标签或执行任何代码。 */
function scalar(value) {
        const text = value.trim();
        if (text.startsWith('"')) {
                try {
                        const result = JSON.parse(text);
                        if (typeof result === "string") return result;
                } catch { /* 不支持的引号语法由下方明确报错。 */ }
                throw new SkillStoreError("metadata", "SKILL.md 双引号字段必须使用有效字符串转义");
        }
        if (text.startsWith("'")) {
                if (!text.endsWith("'") || text.length < 2) throw new SkillStoreError("metadata", "SKILL.md 单引号字段未闭合");
                return text.slice(1, -1).replaceAll("''", "'");
        }
        const comment = text.indexOf(" #");
        return comment < 0 ? text : text.slice(0, comment).trimEnd();
}

/**
 * 读取 name、description、license 及可选 metadata.version/category。
 * @param markdown UTF-8 的 SKILL.md 文本；id 预期目录名。
 * @returns 元信息，支持普通、单/双引号及 >、| 多行描述，拒绝缺失或重复必需字段。
 */
export function readSkillMetadata(markdown, id) {
        if (!validSkillId(id) || typeof markdown !== "string") throw new SkillStoreError("metadata", "技能目录名不合法");
        const lines = markdown.split("\r\n").join("\n").split("\n");
        if (lines[0]?.charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1);
        const end = lines.indexOf("---", 1);
        if (lines[0] !== "---" || end < 1) throw new SkillStoreError("metadata", "SKILL.md 缺少 YAML frontmatter");
        const fields = {};
        const metadata = {};
        let inMetadata = false;
        for (let i = 1; i < end; i++) {
                const line = lines[i];
                if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
                const nested = line.startsWith(" ") || line.startsWith("\t");
                if (!nested) inMetadata = line.startsWith("metadata:");
                if (line.trim() === "metadata:") continue;
                if (nested && !inMetadata) continue;
                const match = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(nested ? line.trimStart() : line);
                if (match === null) continue;
                const target = nested ? metadata : fields;
                const [, key, raw] = match;
                if (Object.hasOwn(target, key)) throw new SkillStoreError("metadata", `SKILL.md 元信息字段重复：${key}`);
                let value;
                if ([">", ">-", ">+", "|", "|-", "|+"].includes(raw)) {
                        const block = [];
                        while (i + 1 < end && (lines[i + 1].trim() === "" || lines[i + 1].startsWith(" "))) block.push(lines[++i]);
                        const indent = Math.min(...block.filter((item) => item.trim() !== "").map((item) => item.length - item.trimStart().length));
                        const stripped = block.map((item) => item.slice(Number.isFinite(indent) ? indent : 0));
                        value = raw.startsWith(">") ? stripped.join(" ").trim() : stripped.join("\n").trim();
                } else {
                        value = scalar(raw);
                }
                target[key] = value;
        }
        if (fields.name !== id || typeof fields.description !== "string" || fields.description.trim() === "" || fields.description.length > 4000) {
                throw new SkillStoreError("metadata", "SKILL.md 的 name 必须匹配目录名，并包含非空 description（最多 4000 字符）");
        }
        if ((fields.license?.length ?? 0) > 512 || (metadata.version?.length ?? fields.version?.length ?? 0) > 80
                || (metadata.category?.length ?? 0) > 80) throw new SkillStoreError("metadata", "SKILL.md 可选元信息字段过长");
        return {
                name: fields.name, description: fields.description,
                license: fields.license || null,
                version: metadata.version || fields.version || null,
                category: metadata.category || "other",
        };
}
