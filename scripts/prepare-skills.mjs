/**
 * 将 skills/ 下的原始 ZIP 安全解包为同名子目录，不生成或维护 JSON 索引。
 * 参数：可选技能 id 列表；无参数时处理所有 ZIP，已有目录不覆盖。
 * 返回：日志与退出码；保留原始 ZIP，不执行包内代码，失败清理本次临时目录。
 */
import { lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSkillArchive, validSkillId } from "../packages/dsh-plugin-repo/lib/skill-archive.js";
import { readSkillMetadata } from "../packages/dsh-plugin-repo/lib/skill-metadata.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "skills");
const selected = process.argv.slice(2);
if (selected.some((id) => !validSkillId(id))) throw new Error("参数必须是小写字母数字和中划线组成的技能 id");
let failures = 0;
for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".zip")) continue;
        const id = entry.name.slice(0, -4);
        if (selected.length > 0 && !selected.includes(id)) continue;
        let temporary;
        try {
                const target = join(skillsDir, id);
                let exists = false;
                try { await lstat(target); exists = true; }
                catch (error) { if (error.code !== "ENOENT") throw error; }
                if (exists) { console.log(`${id}：目录已存在，未覆盖`); continue; }
                const input = join(skillsDir, entry.name);
                const info = await lstat(input);
                if (info.size > 20 * 1024 * 1024) throw new Error("ZIP 超过 20MB 上限");
                const { files, skipped } = await decodeSkillArchive(await readFile(input), id);
                readSkillMetadata(files.find((file) => file.path === "SKILL.md").data.toString("utf8"), id);
                temporary = await mkdtemp(join(skillsDir, ".skill-unpack-"));
                const staged = join(temporary, id);
                await mkdir(staged, { mode: 0o755 });
                for (const file of files) {
                        const path = join(staged, ...file.path.split("/"));
                        await mkdir(dirname(path), { recursive: true });
                        const handle = await open(path, "wx", file.mode);
                        try {
                                await handle.writeFile(file.data);
                                await handle.chmod(file.mode);
                        } finally { await handle.close(); }
                }
                await rename(staged, target);
                console.log(`${id}：已解包 ${files.length} 个文件，忽略 ${skipped} 个附加条目，原 ZIP 保留`);
        } catch (error) {
                failures += 1;
                console.error(`${id}：${error.message}`);
        } finally {
                if (temporary !== undefined) await rm(temporary, { recursive: true, force: true });
        }
}
if (failures > 0) process.exitCode = 1;
