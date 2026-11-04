/** 技能商店页：直接显示 SKILL.md 描述，提供搜索、安装和带确认/备份的更新。 */
import { createElement as h, useEffect, useRef, useState } from "react";

/** 商店组件；参数为文案、API、占位格式化及安装回调，返回技能列表 React 元素。 */
export function SkillStoreSection({ t, api, format, onInstalled }) {
        const [entries, setEntries] = useState([]);
        const [query, setQuery] = useState("");
        const [status, setStatus] = useState("loading");
        const [busy, setBusy] = useState(null);
        const [notice, setNotice] = useState(null);
        const [warnings, setWarnings] = useState([]);
        const active = useRef(true);
        const generation = useRef(0);
        const requests = useRef(new Set());

        /** 加载目录；参数为是否强制刷新，返回空 Promise，过期响应不更新状态。 */
        async function load(refresh) {
                const token = ++generation.current;
                const controller = new AbortController();
                requests.current.add(controller);
                setStatus("loading");
                try {
                        const payload = await api("/store", {
                                ...(refresh ? { method: "POST", body: JSON.stringify({ refresh: true }) } : {}),
                                signal: controller.signal,
                        });
                        if (!active.current || token !== generation.current) return;
                        setEntries(payload.entries ?? []);
                        setWarnings(payload.warnings ?? []);
                        setStatus("ok");
                } catch (error) {
                        if (!active.current || token !== generation.current || controller.signal.aborted) return;
                        setStatus("error");
                        setNotice({ kind: "error", text: format(t("storeLoadError"), { message: error.message }) });
                } finally { requests.current.delete(controller); }
        }

        useEffect(() => {
                active.current = true;
                void load(false);
                return () => {
                        active.current = false;
                        generation.current += 1;
                        for (const request of requests.current) request.abort();
                };
        }, []);

        /** 安装或更新；参数为目录条目，返回空 Promise，同名替换必须由用户确认。 */
        async function install(entry) {
                if (busy !== null) return;
                if (entry.installed && !window.confirm(format(t("storeReplaceConfirm"), { name: entry.id }))) return;
                const controller = new AbortController();
                requests.current.add(controller);
                setBusy(entry.id);
                setNotice(null);
                try {
                        const result = await api("/store/install", {
                                method: "POST", signal: controller.signal,
                                body: JSON.stringify({ id: entry.id, replace: entry.installed, treeSha: entry.treeSha }),
                        });
                        if (!active.current) return;
                        const text = format(t("storeInstalled"), { name: entry.id });
                        setNotice({ kind: "ok", text: result.backup ? `${text} ${format(t("storeBackup"), { path: result.backup })}` : text });
                        onInstalled?.();
                        await load(false);
                } catch (error) {
                        if (active.current && !controller.signal.aborted) setNotice({ kind: "error", text: format(t("actionFailed"), { message: error.message }) });
                } finally {
                        requests.current.delete(controller);
                        if (active.current) setBusy(null);
                }
        }

        const search = query.trim().toLowerCase();
        const shown = entries.filter((entry) => `${entry.id} ${entry.description}`.toLowerCase().includes(search));
        return h("div", { className: "dsk-store" },
                h("p", { className: "dsk-subtitle" }, t("storeDescription")),
                h("div", { className: "dsk-store-toolbar" },
                        h("input", { className: "dsk-input", type: "search", value: query, placeholder: t("storeSearch"), "aria-label": t("storeSearch"), onChange: (event) => setQuery(event.target.value) }),
                        h("button", { className: "dsk-btn", disabled: busy !== null || status === "loading", onClick: () => { setNotice(null); void load(true); } }, t("refresh"))),
                notice === null ? null : h("p", { className: `dsk-notice ${notice.kind === "error" ? "dsk-notice-err" : "dsk-notice-ok"}`, role: "status" }, notice.text),
                warnings.length === 0 ? null : h("p", { className: "dsk-subtitle", role: "status" }, format(t("storeWarnings"), { names: warnings.map((item) => item.id).join(", ") })),
                status === "loading" ? h("p", { className: "dsk-subtitle", role: "status" }, t("storeLoading")) : null,
                status !== "loading" && shown.length === 0 ? h("p", { className: "dsk-subtitle" }, t(search === "" ? "storeEmpty" : "storeNoMatch")) : null,
                h("div", { className: "dsk-list" }, shown.map((entry) => h("article", { key: entry.id, className: "dsk-row dsk-store-row" },
                        h("div", { className: "dsk-info" },
                                h("div", { className: "dsk-name" },
                                        h("span", null, entry.id),
                                        entry.installed ? h("span", { className: "dsk-badge dsk-badge-on" }, t("storeInstalledBadge")) : null,
                                        entry.modified ? h("span", { className: "dsk-badge dsk-badge-off" }, t("storeModified")) : null,
                                        entry.installed && !entry.managed ? h("span", { className: "dsk-badge dsk-badge-off" }, t("storeLocal")) : null),
                                h("p", { className: "dsk-desc dsk-store-description" }, entry.description),
                                h("p", { className: "dsk-meta" }, `${t("storeVersion")}：${entry.version}`),
                                h("p", { className: "dsk-meta" }, `${t("storeLicense")}：${entry.license ?? t("storeLicenseUnknown")}`)),
                        h("div", { className: "dsk-actions" },
                                h("button", {
                                        className: "dsk-btn dsk-btn-primary",
                                        disabled: busy !== null || status !== "ok" || entry.managed && !entry.updateAvailable && !entry.modified,
                                        onClick: () => void install(entry),
                                }, busy === entry.id ? t("storeInstalling") : t(entry.installed ? "storeUpdate" : "storeInstall")))))));
}
