window.__ModuleLoader__.load({
	id: "dsh-connect-workbuddy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/status-paths.ts
		/**
		* Node-free constants and types shared by the Host and browser halves.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 「3 条同源只读路由（usage / models:refresh / accounts:refresh）+ 一份
		*     与浏览器共享的 node-free 类型定义」的 host↔client 桥梁形态来自该项目
		*     （其 `status-paths.ts` 亦如此，并注明沿用
		*     corrinehu/dsh-workbuddy-connect 的 status-route 模式）。
		* 改动：路由路径改用本插件 id；类型字段按 WorkBuddy 上游实际给出的能力
		*   （积分倍率、多模态、推理档位）调整，不保留 trae 的 1M 变体字段。
		*
		* @module dsh-connect-workbuddy/status-paths
		*/
		/** Plugin-owned usage endpoint consumed by its browser half. */
		const WORKBUDDY_USAGE_PATH = "/plugins/dsh-connect-workbuddy/usage";
		/**
		* Per-account credit balances for one region, read ONLY while the composer
		* panel is open.
		*
		* Separate from {@link WORKBUDDY_USAGE_PATH} because its cost is different in
		* kind: the usage document is one upstream read for the selected account, while
		* this is one read PER account in the region. Folding it into the usage route
		* would make every 5-minute refresh pay for a table nobody is looking at, so it
		* is fetched on demand instead — the same principle the pool applies to its
		* per-account figures.
		*/
		const WORKBUDDY_ACCOUNT_CREDITS_PATH = "/plugins/dsh-connect-workbuddy/account-credits";
		/**
		* The project's public repository.
		*
		* Lives here rather than beside one component because TWO sections link to it
		* now — the model section and the account pool — and a second copy of a URL is
		* a second thing to forget when it moves. Node-free and side-effect free, so it
		* costs nothing on the Host side either.
		*/
		const WORKBUDDY_GITHUB_URL = "https://github.com/dingminhua/dsh-connect-workbuddy";
		/** Plugin-owned live model refresh endpoint. */
		const WORKBUDDY_MODELS_REFRESH_PATH = "/plugins/dsh-connect-workbuddy/models/refresh";
		/** Plugin-owned local account rescan endpoint. */
		const WORKBUDDY_ACCOUNTS_REFRESH_PATH = "/plugins/dsh-connect-workbuddy/accounts/refresh";
		/**
		* Plugin-owned model probe endpoint.
		*
		* Sends one minimal chat request per named model so the card can answer "is
		* this model usable right now, and if it is limited, when can it be used
		* again?". Lives on the Host because the credential must never reach the
		* browser half.
		*/
		const WORKBUDDY_PROBE_PATH = "/plugins/dsh-connect-workbuddy/probe";
		/**
		* Plugin-owned account-pool endpoint: one batch action per call.
		*
		* `?action=checkin` claims the daily reward for every account of a region;
		* `?action=test` probes every account against the region's target model. Both
		* are POST and loopback-only because both cost something real — check-in writes
		* to the user's account, a probe spends credits.
		*
		* Deliberately ONE endpoint rather than two: the two actions share every
		* guard (method, origin, region, pool-enabled) and differ only in the work, so
		* splitting them would duplicate the guards and invite them to drift apart.
		*/
		const WORKBUDDY_POOL_PATH = "/plugins/dsh-connect-workbuddy/pool";
		/**
		* Plugin-owned OAuth sign-in endpoint: one session step per call.
		*
		* `?action=start` asks the upstream for a login state and returns the URL to
		* open; `?action=poll` (+ `loginId` in the body) reports whether the user
		* finished, and on success persists the account into the vault. POST +
		* loopback-only like the card's other mutations: the poll carries the login
		* binding, and the Host-side session state must not be settable by another
		* origin.
		*/
		const WORKBUDDY_OAUTH_PATH = "/plugins/dsh-connect-workbuddy/oauth";
		/** Query parameter selecting which pool batch action a request means. */
		const WORKBUDDY_POOL_ACTION_PARAM = "action";
		/** How long the card waits between polls while the user is scanning. */
		const OAUTH_POLL_INTERVAL_MS = 2e3;
		/**
		* Plugin-owned account transfer endpoint: the batch export / import of
		* credentials between machines and between tools of the SAME format family.
		*
		* `?action=export` POSTs account ids, answers a JSON ARRAY of credential
		* records; `?action=preview` POSTs file text, answers a token-free listing;
		* `?action=import` POSTs file text plus selected indexes, merges into the
		* vault. POST + loopback-only like every other mutation: the file content is
		* arbitrary user data and export carries token material.
		*/
		const WORKBUDDY_TRANSFER_PATH = "/plugins/dsh-connect-workbuddy/transfer";
		/** Address one region's pool endpoint with an action. */
		function withWorkBuddyRegionAndAction(path, region, action) {
			return `${withWorkBuddyRegion(path, region)}&${WORKBUDDY_POOL_ACTION_PARAM}=${action}`;
		}
		/**
		* Address one region's endpoint for ANY route that dispatches on `action`.
		*
		* The OAuth and transfer routes reject a request with no action (400), so
		* their callers must build the URL here rather than with
		* {@link withWorkBuddyRegion} — a request missing the parameter fails the same
		* way whether the omission was a mistake or not.
		*/
		function withWorkBuddyRouteAction(path, region, action) {
			return `${withWorkBuddyRegion(path, region)}&${WORKBUDDY_POOL_ACTION_PARAM}=${action}`;
		}
		/** Query parameter naming the region a card request addresses. */
		const WORKBUDDY_REGION_PARAM = "region";
		/** Every region, in card tab order. */
		const WORKBUDDY_REGIONS = ["cn", "global"];
		/**
		* Address one region's status route. The two regions are separate provider
		* stacks; every card request carries the region whose tab the user is on.
		*/
		function withWorkBuddyRegion(path, region) {
			return `${path}?${WORKBUDDY_REGION_PARAM}=${region}`;
		}
		/**
		* Narrow a settings value to the `regions` map. Accepts EITHER the whole
		* settings section (the Host's resolved `Config`) OR the `regions` map itself,
		* and unwraps the former. This tolerance is deliberate: passing the whole
		* section where the map was expected was a real shipped bug in the sibling
		* project — the lookup then read `section['cn']` (absent), so the card's
		* checkbox reported `true` forever and clicking it appeared to do nothing even
		* though the write succeeded.
		*
		* The resolved section delivers `regions` as a `{get(): T}` LIVE reference, and
		* a live reference is `typeof === 'object'` and not an array — so it passes a
		* naive object check and gets returned as if it were the map. Every lookup on
		* it is then `undefined`: the enabled flag reads back as "on" forever (the very
		* symptom described above), and a merge that spreads this map silently drops
		* the region it was not editing. Unwrap before narrowing.
		*/
		function regionsMapOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			if (typeof unwrapped !== "object" || unwrapped === null || Array.isArray(unwrapped)) return {};
			const record = unwrapped;
			const nested = record["regions"];
			if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) return nested;
			return record;
		}
		/** One region's stored slot as a plain object; any other shape reads as empty. */
		function regionSlotOf(value, region) {
			const slot = regionsMapOf(value)[region];
			return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
		}
		/**
		* Whether one region's provider is switched on. Opt-out semantics: only an
		* explicit `false` disables it, so a config written before this switch existed
		* (and the pre-region-split flat fields, which never carry `enabled`) keep both
		* providers running exactly as before. The Host reads the same rule through
		* `regionStateOf`, so card and Host can never disagree about a region's state.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionEnabledOf(value, region) {
			return regionSlotOf(value, region)["enabled"] !== false;
		}
		/** Build the next `regions` settings value for a signed-in tab's save. */
		function nextRegionSlots(regions, region, slot) {
			return {
				...typeof regions === "object" && regions !== null && !Array.isArray(regions) ? regions : {},
				[region]: slot
			};
		}
		/**
		* Build the next `regions` settings value for a provider on/off toggle. ONLY
		* the target region's `enabled` flag changes: every other field of that slot
		* (its directory, selection, image opt-ins, context budgets) and every other
		* region's slot are carried over verbatim, so switching a provider off never
		* discards the user's model picks and switching it back on restores them.
		*
		* This is deliberately separate from {@link nextRegionSlots}: that helper
		* writes a whole slot from a signed-in tab's draft, while this one must work
		* for a region that is signed OUT — which is precisely the region a user wants
		* to switch off (no international install, no international account).
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		/**
		* Build the next `regions` settings value for a MODEL-LIST save.
		*
		* The model save replaces a region slot wholesale, so the merge has to start
		* from the EXISTING slot rather than from a fresh object: the pool's
		* preferences live in that same slot, and a save that omitted them would delete
		* settings the user configured elsewhere in the card. Every writer that owns
		* only part of a slot goes through a helper like this one.
		*/
		function nextRegionModels(value, region, models) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf(value, region),
				...models
			});
		}
		/**
		* Build the next `regions` settings value for a POOL-PREFERENCES save.
		*
		* Same reasoning as {@link nextRegionModels}: the pool is one field of a slot
		* that also holds the model list, so the merge starts from the existing slot.
		*/
		function nextRegionPool(value, region, pool) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf(value, region),
				pool
			});
		}
		function nextRegionEnabled(value, region, enabled) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf(value, region),
				enabled
			});
		}
		/**
		* Whether one region's sidebar credit line is shown. Opt-out: only an explicit
		* `false` hides it, so a config written before this switch existed keeps the
		* line visible exactly as a fresh install does.
		*
		* Per-REGION by construction (it reads one region's slot), which is the point:
		* WB CN and WB AI are separate accounts on separate gateways, so "show credits"
		* is not one decision. `value` may be the whole settings section or the
		* `regions` map itself.
		*/
		function regionCreditsShownOf(value, region) {
			return regionSlotOf(value, region)["showCreditsInMainUi"] !== false;
		}
		/** The seat a region's readout uses, defaulting to the composer row. */
		function regionCreditPositionOf(value, region) {
			return regionSlotOf(value, region)["creditPosition"] === "stats" ? "stats" : "composer";
		}
		/**
		* Build the next `regions` settings value for one region's credit seat.
		*
		* Same merge rule as {@link nextRegionCreditsShown}: only the target region's
		* field changes, so every other field of that slot and every other region's slot
		* survive the write.
		*/
		function nextRegionCreditPosition(value, region, position) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf(value, region),
				creditPosition: position
			});
		}
		/**
		* Build the next `regions` settings value for the sidebar-credit on/off toggle.
		*
		* Same merge rule as {@link nextRegionEnabled}: ONLY the target region's flag
		* changes, so every other field of that slot (directory, selection, pool
		* preferences) and every other region's slot survive the write.
		*/
		function nextRegionCreditsShown(value, region, shown) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf(value, region),
				showCreditsInMainUi: shown
			});
		}
		/**
		* Project one card row into its persisted `lastCatalog` shape: the native
		* context window becomes the stored `contextWindow`, and the card-only
		* presentation fields (`nativeContextWindow`, `multimodal`) are removed BY
		* KEY. They must never be set to `undefined`: explicit `undefined` values
		* survive `structuredClone` and are rejected by the settings write path's
		* strict JSON codec (`client api: settings/mutate rejected "ops"`), which
		* fails the whole save.
		*/
		function toPersistedWorkBuddyModel(model) {
			const { nativeContextWindow, multimodal: _cardOnly, ...rest } = model;
			return {
				...rest,
				contextWindow: nativeContextWindow
			};
		}
		/**
		* Deep copy of a settings value with every `{get(): T}` live reference replaced
		* by the value it resolves to.
		*
		* `regions` and `accounts` are declared `asVolatile(...)`, and schemastery
		* resolves a volatile field to a live reference. That resolution happens in
		* schemastery itself, driven by the schema's `meta.volatile`, so it is
		* independent of the DSH line — the resolved section looks like this to the
		* browser half on BOTH 0.1.5 and 0.1.7.
		*
		* A live reference is still `typeof === 'object'`, so `{ ...reference }` does
		* NOT read the field: it produces `{ get: <function> }`. Any caller that
		* spreads the resolved field to preserve its siblings — the card's
		* "write one region, keep the other" merge — would otherwise DROP every
		* sibling and leak a function into the document. Both halves therefore unwrap
		* before touching a resolved field.
		*
		* Lives here, not in the Host entry, because the browser half needs it too and
		* this module is the node-free bridge between the two.
		*
		* Non-reference values are recursed into so a nested volatile field is caught
		* too — arrays and objects are rebuilt rather than mutated, so the caller's
		* value is never touched.
		*/
		function unwrapVolatileDeep(value) {
			if (value === null || typeof value !== "object") return value;
			if (typeof value.get === "function") return unwrapVolatileDeep(value.get());
			if (Array.isArray(value)) return value.map((entry) => unwrapVolatileDeep(entry));
			const source = value;
			const out = {};
			for (const key of Object.keys(source)) out[key] = unwrapVolatileDeep(source[key]);
			return out;
		}
		/**
		* The plugin's DECLARED settings namespace — the fallback name, not the value
		* the host necessarily serves.
		*
		* On 0.1.7 the settings service keys every form by the plugin's Loader entry id
		* (`describe()` returns `ns: entry.options.id`), and the harness resolves a
		* provider's namespace by EXACT match. The entry id is chosen by the profile
		* patch, so a plugin cannot know it in advance — the live Desktop host mounts
		* this one as `include:dsh-connect-workbuddy`.
		*
		* Lives here, not in the Host entry, because the browser half needs the same
		* fallback and must not import Node-only host code.
		*/
		const WORKBUDDY_SETTINGS_NS = "workbuddy";
		/**
		* Every namespace spelling the browser half follows when looking for the
		* settings form the Host actually serves, in preference order.
		*
		* `describe()` keys a form by its Loader entry id, and the profile patch picks
		* that id — so the plugin must ASK rather than assume. The observed spellings
		* are the bare package name, the `include:`-wrapped id the live Desktop host
		* uses, and the declared name as the last resort. `configForms.whileServed`
		* follows all of them and re-runs when the mirror arrives, which is what keeps
		* the binding correct on a host whose mirror populates after `apply` (the
		* 4.3.0 readout defect, issue #46).
		*/
		const WORKBUDDY_SETTINGS_NAMESPACE_CANDIDATES = [
			"dsh-connect-workbuddy",
			"include:dsh-connect-workbuddy",
			WORKBUDDY_SETTINGS_NS
		];
		/**
		* The `<package name>` keys under which the card registers itself in the
		* Plugins panel.
		*
		* `plugins.bundle.config` and `plugins.row.config` are KEYED slots: the page
		* renders them with `entryKey: pkg.name`, and it decides whether to render the
		* section at all from `ledger.bundles.has(pkg.name)` — a `Set` of exactly the
		* `key` values registered on that slot, compared against the plugin-manager
		* inventory's own package name. Both halves of that comparison are EXACT and
		* neither side is the settings namespace: the inventory name comes from the
		* profile's package list, while a deployment may mount the same code under a
		* different Loader entry id.
		*
		* That is the whole of issue #55. A deployment whose inventory name is
		* `dsh-connect-workbuddy` and whose card registered only under
		* `include:dsh-connect-workbuddy` gets NO card and NO error: the keyed lookup
		* finds nothing, the section is simply not rendered, and `apply()` finished
		* happily. Since the keys live in separate cells (one entry per `key` per
		* priority), registering under every spelling at once is a shadowing-free
		* duplicate rather than a conflict, and is strictly safer than betting on one.
		*
		* The bare package name is FIRST because it is the common case — a profile that
		* installs the package by name mounts it under that name.
		*/
		const WORKBUDDY_CARD_KEYS = ["dsh-connect-workbuddy", "include:dsh-connect-workbuddy"];
		//#endregion
		//#region src/client/account-selection.ts
		/**
		* Verified writes of the per-region account slot.
		*
		* 参考：DSH 自带插件卡片（`@deepseek-ai/dsh-client-ui-settings-plugins`
		*   的 `CardForm.store()`）— 「写入后回读用户层并与写入值比对」这一校验形态，
		*   是本模块 `writeAccountSlot()` 的出发点。
		* 改动：针对账号槽位重写而非照搬 —— 回读的是**解析后的 section**而非 user 层
		*   （Host 的 legacy 归属也读它，两者必须同源），并用精确比较区分 `''`（哨兵清除）
		*   与 `undefined`（键缺失），因为后者会让区域重新回退到旧版 `accountId`。
		*
		* Kept out of `WorkBuddyCard.tsx` — and free of any browser-only import — so
		* the write contract can be unit-tested directly. The card is a `.tsx`
		* component whose module graph pulls DSH's browser packages, which cannot load
		* in the Node test environment; the check below is exactly the part that must
		* not go untested.
		*
		* @module dsh-connect-workbuddy/client/account-selection
		*/
		/**
		* A settings write that did not take effect.
		*
		* Distinct from a rejected `set()`: this is thrown when the write reported
		* success and the value is nonetheless absent from the document.
		*/
		var WorkBuddySettingsWriteError = class extends Error {
			/** The settings field that did not land. */
			field;
			constructor(field, reason) {
				super(`workbuddy: settings field "${field}" was not persisted by the settings write${reason === void 0 ? "" : `: ${reason}`}`);
				this.name = "WorkBuddySettingsWriteError";
				this.field = field;
			}
		};
		/**
		* Whether a save failure is a FILE-CONTENTION refusal.
		*
		* On Windows, replacing a file that another process holds open fails with
		* `EPERM` / `EBUSY` / `EACCES` — an antivirus scanner, a sync client (OneDrive),
		* or an editor with the profile's patch file open. POSIX `rename` replaces
		* outright regardless of open handles, so this branch effectively never fires
		* on macOS/Linux: the diagnosis is Windows-shaped because the failure is.
		*
		* It exists so a save failure can say WHAT TO DO. Without it the card pasted the
		* raw error at the user — `EPERM: operation not permitted, rename
		* 'C:\…\cordis.patch.yml.79498ff8fb27.tmp' -> '…\cordis.patch.yml'` — which
		* names a temp path and no remedy. Measured live against the 3.0.0 host with the
		* file held open: both the `regions` and `accounts` writes came back HTTP 500
		* with exactly that text.
		*
		* Deliberately matched on the message rather than on `WorkBuddySettingsWriteError`
		* alone: a validation refusal is also that class but has nothing to do with file
		* contention, and telling such a user to close their editor would send them
		* chasing a cause that is not there.
		*/
		function isFileContentionWriteError(error) {
			const message = error instanceof Error ? error.message : String(error);
			return /\b(?:EPERM|EBUSY|EACCES)\b/u.test(message);
		}
		/**
		* Read one settings field's current object value from the scope snapshot.
		*
		* The snapshot holds the RESOLVED section, where a volatile field
		* (`regions` / `accounts`) is a `{get(): T}` LIVE reference rather than the
		* plain object it resembles. Unwrapping first is not cosmetic: a live reference
		* is still `typeof === 'object'`, so without this the caller spreads it into
		* `{ get: <function> }` — which DROPS every sibling key (the other region) and
		* leaks a reference function into the document.
		*
		* That was the "saving the international region loses the domestic one" report:
		* every write here preserves the region it is not touching by spreading this
		* value, so reading it wrong silently deleted the untouched region.
		*/
		function fieldSnapshotOf(scope, field) {
			const value = unwrapVolatileDeep(scope.getSnapshot().value?.[field]);
			return typeof value === "object" && value !== null ? value : {};
		}
		/**
		* Fallback write: POST the field to the plugin's own Host endpoint.
		*
		* The endpoint handler runs the settings mutate inside the Host process and
		* reports the raw refusal exception, so a failure here names its cause instead
		* of arriving as a swallowed `ok:false`. It merges the posted region key into
		* the field's live value, preserving the other region.
		*/
		async function saveViaHostEndpoint(field, region, value) {
			let response;
			try {
				response = await fetch("/plugins/dsh-connect-workbuddy/__save", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						field,
						value: { [region]: value }
					})
				});
			} catch (error) {
				throw new WorkBuddySettingsWriteError(field, `Host save endpoint unreachable: ${String(error)}`);
			}
			if (!response.ok) {
				const detail = await response.json().catch(() => ({ error: `HTTP ${String(response.status)}` }));
				const reason = `${String(detail.errorName ?? "")} ${String(detail.error ?? "")}`.trim();
				throw new WorkBuddySettingsWriteError(field, `Host save refused: ${reason === "" ? String(detail.error) : reason}`);
			}
			return (await response.json().catch(() => void 0))?.value;
		}
		/**
		* Write one volatile field, then confirm the value actually landed.
		*
		* ORDER MATTERS, and getting it wrong DELETES DATA. The two writers do not have
		* the same semantics:
		*
		* - The Host save endpoint merges the posted region into the field's
		*   AUTHORITATIVE value inside the Host process, preserving every other region.
		* - `scope.set(field, next)` hands the settings service the WHOLE field, merged
		*   on the CLIENT out of the browser mirror. The Host performs no server-side
		*   merge on this path, so whatever the client built REPLACES the field.
		*
		* The mirror is not a reliable merge base: a write made through the Host
		* endpoint does not update it (that lag is documented on `contextBudgets`
		* below), and on the affected 0.1.7 deployment the mirror for this namespace
		* stays stale outright. Building the merge from it therefore produced
		* `{ [region]: slot }` with every SIBLING region missing — and `scope.set`
		* stores that verbatim, deleting them. That was the report "I saved the
		* domestic region and the international one was gone": `accounts` survived
		* (written while the mirror happened to be fresh) while `regions` lost a slot.
		*
		* So the Host endpoint goes FIRST — it is the only writer that cannot delete a
		* sibling. `scope.set` is then attempted purely as a mirror refresh, and only
		* when it delivers is the write considered done without the endpoint.
		*
		* `landed` decides whether a value read back from the scope is the value that
		* was written; it is per-field because `''` (a cleared account slot) and an
		* absent key are different states, and a truncated model catalog must not pass
		* a shallow "is anything there?" check.
		*
		* @throws {WorkBuddySettingsWriteError} when neither path persists the value.
		*/
		async function writeField(scope, field, region, value, landed) {
			let hostError;
			try {
				const authoritative = await saveViaHostEndpoint(field, region, value);
				if (authoritative !== void 0) try {
					await scope.set(field, authoritative);
				} catch {}
				return;
			} catch (error) {
				hostError = error;
			}
			let scopeDelivered = false;
			try {
				scopeDelivered = await scope.set(field, {
					...fieldSnapshotOf(scope, field),
					[region]: value
				}) !== false;
			} catch {
				scopeDelivered = false;
			}
			if (scopeDelivered && landed(fieldSnapshotOf(scope, field)[region])) return;
			throw hostError instanceof Error ? hostError : new WorkBuddySettingsWriteError(field, "neither the Host save endpoint nor the settings scope persisted the value");
		}
		/**
		* Write one region's account slot, then confirm the value actually landed.
		*
		* `settingsScope.set()` resolving is NOT proof that anything was stored. The
		* Host's document is the active profile's patch file (`cordis.patch.yml`, the
		* `config-editor`'s `documentPath`; volatile fields land there too, through
		* the same `edit()`. `settings.yaml` is NOT it on the 0.1.7 line — that file
		* is imported once from earlier releases and renamed to
		* `settings.yaml.imported`), replaced by writing a temp file and
		* renaming it over the target; on Windows an antivirus scanner, a sync client
		* (OneDrive, Dropbox), or an open editor can hold the file briefly.
		* `@deepseek-ai/dsh-atomic-write` retries `EPERM` / `EBUSY` / `EACCES` a
		* bounded number of times and those retries exist only for `win32` — and once
		* they are exhausted the failure reaches the client as an unsuccessful
		* response, which the settings scope handles by reloading Host state and
		* merely RETURNING. The caller's `await` therefore succeeds while the document
		* is unchanged.
		*
		* Reading the field back is the only reliable check, and it is what the
		* official plugin cards do (`CardForm.store()` compares the user layer against
		* the value it wrote). Failing loudly matters most on Clear: a false success
		* would flip the card to "following the app's sign-in" while the old selection
		* keeps running — the exact confusion that state line exists to remove.
		*
		* @param scope - the bound settings scope for this plugin's namespace.
		* @param region - the region whose slot is written; the other is preserved.
		* @param value - the account id to save, or `''` to clear the region.
		* @throws {WorkBuddySettingsWriteError} when the value is readable back as
		*   something else — i.e. the write silently did not persist.
		*/
		async function writeAccountSlot(scope, region, value) {
			await writeField(scope, "accounts", region, value, (readBack) => readBack === value);
		}
		/**
		* Write one region's saved model state, then confirm it actually landed.
		*
		* The same silent-failure mode as {@link writeAccountSlot} applies to EVERY
		* settings write, not just the account slot. It matters here for a different
		* reason: a successful save discards the user's draft, so a write that did not
		* persist makes the card throw away unsaved edits while claiming they were
		* saved — unrecoverable, since the drafts are the only copy.
		*
		* Verification compares the round-tripped `lastCatalog` ids, which is the part
		* of the payload that is both user-visible and cheap to compare; the selection
		* fields ride along in the same object and cannot land separately.
		*
		* @param scope - the bound settings scope for this plugin's namespace.
		* @param region - the region whose model slot is written.
		* @param payload - the complete next state for that region's slot.
		* @throws {WorkBuddySettingsWriteError} when the catalog does not read back.
		*/
		async function writeRegionModels(scope, region, payload) {
			const next = nextRegionModels(scope.getSnapshot().value, region, payload)[region];
			const written = payload.lastCatalog.map((model) => model.id);
			await writeField(scope, "regions", region, next, (readBack) => {
				const stored = readBack?.lastCatalog?.map((model) => model.id);
				return stored !== void 0 && stored.length === written.length && stored.every((id, index) => id === written[index]);
			});
		}
		/**
		* Switch one region's provider off or on, with the same landed-check as every
		* other settings write.
		*
		* This exists because the toggle was the ONE write that still called
		* `scope.set()` directly. On the affected 0.1.7 deployments that scope settles
		* without storing anything, so flipping a provider off appeared to work and
		* then silently reverted — the exact silent-failure mode
		* {@link writeAccountSlot} and {@link writeRegionModels} were written to
		* prevent for their own fields. Routing it through {@link writeField} gives it
		* the same scope-first-then-Host-endpoint path, so the switch either lands or
		* reports why it did not.
		*
		* The write carries the region's whole slot through untouched — only `enabled`
		* changes — so the user's directory, model picks, image opt-ins and budgets
		* survive the round trip. The Host withdraws or restores the provider route on
		* the next `onChange`, which is what actually removes it from DSH's model
		* picker.
		*
		* @param scope - the bound settings scope for this plugin's namespace.
		* @param region - the region being switched.
		* @param enabled - the desired state.
		* @param slot - the region's COMPLETE next slot (the caller owns the snapshot
		*   read and the whole-slot merge, so this stays a pure write).
		* @throws {WorkBuddySettingsWriteError} when neither writer persists the value.
		*/
		async function writeRegionEnabled(scope, region, enabled, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["enabled"] === enabled;
			});
		}
		/**
		* Show or hide one region's sidebar credit line, with the same landed-check as
		* every other settings write.
		*
		* Routed through {@link writeField} for exactly the reason
		* {@link writeRegionEnabled} is: on the affected 0.1.7 deployments a direct
		* `scope.set()` settles without storing anything, so the switch would appear to
		* work and then silently revert — which for this control means the line
		* reappears on the next render with no explanation.
		*
		* The caller passes the region's COMPLETE next slot (the same whole-slot merge
		* rule as the other region writes), so hiding a line cannot drop the model
		* directory, selection, image opt-ins, budgets or pool preferences that live
		* alongside this flag in the same slot.
		*
		* @param scope - the bound settings scope for this plugin's namespace.
		* @param region - the region whose line is being shown or hidden.
		* @param shown - the desired state.
		* @param slot - the region's COMPLETE next slot (caller owns the merge).
		* @throws {WorkBuddySettingsWriteError} when neither writer persists the value.
		*/
		async function writeRegionCreditsShown(scope, region, shown, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["showCreditsInMainUi"] === shown;
			});
		}
		/**
		* Write one region's credit SEAT (issue #62), verifying it landed.
		*
		* Sibling of {@link writeRegionCreditsShown}: same whole-slot merge, same
		* landed check, same reason for both. The seat decides only WHERE the readout
		* renders, so a lost write would leave the user looking at the old position
		* while the control claimed the new one.
		*/
		async function writeRegionCreditPosition(scope, region, position, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["creditPosition"] === position;
			});
		}
		/**
		* Write one region's account-pool PREFERENCES, verifying they landed.
		*
		* Routed through {@link writeField} like every other settings write, so it gets
		* the same Host-endpoint-first path and the same landed check. The card treats
		* a resolved write as "the draft is now safe to discard", so a write that
		* silently did nothing would throw away the user's edits while reporting
		* success — unrecoverable, since the draft is the only copy.
		*
		* The COMPLETE region slot is passed in by the caller for the same reason
		* {@link writeRegionEnabled} does it: the pool lives INSIDE the region slot
		* alongside `lastCatalog`/`enabledModelIds`, so writing only the pool field
		* would drop the model list.
		*
		* Deliberately does NOT carry the pool's measured facts. Those are written by
		* the Host to its own file; keeping them out of settings is what stops a save
		* from rolling back a test result the timer had just recorded.
		*
		* @param scope - the bound settings scope for this plugin's namespace.
		* @param region - the region whose pool preferences are written.
		* @param preferences - the preference fields, as the user set them.
		* @param slot - the region's COMPLETE next slot (caller owns the merge).
		* @throws {WorkBuddySettingsWriteError} when neither writer persists the value.
		*/
		async function writePoolPreferences(scope, region, preferences) {
			const slot = {
				enabled: preferences.enabled,
				targetModelId: preferences.targetModelId,
				memberAccountIds: preferences.memberAccountIds
			};
			if (preferences.probeInputTokens !== void 0) slot["probeInputTokens"] = preferences.probeInputTokens;
			const next = nextRegionPool(scope.getSnapshot().value, region, slot)[region];
			await writeField(scope, "regions", region, next, (readBack) => {
				const pool = readBack?.pool;
				if (pool === void 0 || pool === null) return false;
				if (pool["enabled"] !== preferences.enabled || pool["targetModelId"] !== preferences.targetModelId) return false;
				const wantedTokens = preferences.probeInputTokens ?? 0;
				if ((pool["probeInputTokens"] ?? 0) !== wantedTokens) return false;
				const stored = pool["memberAccountIds"];
				if (!Array.isArray(stored) || stored.length !== preferences.memberAccountIds.length) return false;
				const wanted = new Set(preferences.memberAccountIds);
				if (!stored.every((id) => typeof id === "string" && wanted.has(id))) return false;
				return true;
			});
		}
		//#endregion
		//#region src/client/exclusion-text.ts
		/** The exclusion label for one account, or undefined when it is usable. */
		function exclusionText(t, excludedBy) {
			switch (excludedBy) {
				case "rate-limited": return t("row.poolExcludedRateLimited");
				case "model-busy": return t("row.poolExcludedModelBusy");
				case "out-of-credit": return t("row.poolExcludedOutOfCredit");
				case "credential-rejected": return t("row.poolExcludedRejected");
				case "not-found": return t("row.probeNotFound");
				case "unavailable": return t("row.probeUnavailable");
				case "failed": return t("row.probeFailed");
				case "unusable": return t("row.poolExcludedUnusable");
				default: return;
			}
		}
		//#endregion
		//#region src/client/credit-format.ts
		/**
		* How a credit balance is written on screen.
		*
		* `4.4.5` made the balance exact: it now comes from the upstream's `*Precise`
		* family, so the number carries a fraction (`2,196.61`) where it used to be a
		* whole integer. The card does not show that fraction — a narrow row reads
		* better, and the product's own breakdown (套餐基础 / 平台奖励 / 购买) is the
		* place to look for detail.
		*
		* Taking the FLOOR rather than rounding is the one decision here, and it is not
		* cosmetic:
		*
		* - a balance is a quantity you either have or do not. `0.61` rounded UP prints
		*   `1`, which tells the reader they can spend a credit they do not have;
		* - the official client shows `2,196.61`, so its integer part is `2,196` — the
		*   floor. Rounding would print `2,197` and make a card that had JUST been
		*   reconciled against the client look one credit off, which is the exact
		*   complaint (issue #58) this display rule is downstream of.
		*
		* Grouping is kept because a four-figure balance is otherwise hard to read at a
		* glance, and it is the only reason this is not `Math.floor(value).toString()`.
		*
		* @module dsh-connect-workbuddy/client/credit-format
		*/
		/**
		* Format a credit balance for display: whole credits, grouped, floored.
		*
		* `Math.floor` before `toLocaleString` (rather than a `maximumFractionDigits`
		* option) is deliberate: the option ROUNDS, so it would print `2,197` for
		* `2,196.61`.
		*/
		function formatCredits(value) {
			return Math.floor(value).toLocaleString("en-US");
		}
		//#endregion
		//#region src/client/BusyOverlay.tsx
		/**
		* The shared busy veil's spinner: an arc that breathes while it turns.
		*
		* Deliberately the host's own state-spinner shape (dsh's `_dsh-state-dot-spin`)
		* rather than a border-ring: a two-tone CSS ring at .7s read as a loading
		* indicator from another decade and was out of step with every spinner in the
		* shell. The motion lives in CSS (`dsm-workbuddy-veil-spin` /
		* `-dash`), so this element only describes the geometry; `currentColor` lets it
		* inherit whatever tier it sits in.
		*
		* `aria-hidden` because the veil's `role="status"` already announces the
		* message — a second announcement from a decorative arc is noise.
		*/
		function VeilSpinner() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dsm-workbuddy-veil-spinner",
				viewBox: "0 0 20 20",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-workbuddy-veil-spinner-track",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-workbuddy-veil-spinner-arc",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round"
				})]
			});
		}
		/**
		* The veil. Deliberately NOT a modal dialog: it carries no focusable control
		* and no dismissal — there is nothing for the user to decide, only a step to
		* wait through. `aria-busy` plus a polite live region state that to screen
		* readers, which is the whole accessibility contract a wait screen needs.
		*/
		function BusyOverlay({ message, hint, visible }) {
			if (!visible) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsm-workbuddy-veil",
				role: "status",
				"aria-busy": "true",
				"aria-live": "polite",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-workbuddy-veil-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VeilSpinner, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-workbuddy-veil-text",
							children: message
						}),
						hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-workbuddy-veil-hint",
							children: hint
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/ndjson.ts
		/**
		* Read a newline-delimited JSON body, one object at a time.
		*
		* NDJSON rather than SSE or a hand-rolled frame format because the pool's batch
		* is a list of INDEPENDENT results: one line per result needs no state machine,
		* survives a partially-delivered batch, and lets the reader act on account N
		* while account N+1 is still being tested.
		*
		* A malformed line is SKIPPED, not fatal. The stream carries live progress, so
		* discarding the rest of a batch because one frame did not parse would throw away
		* rows the user already watched arrive — and a truncated final line is a normal
		* way for a stream to end when something upstream misbehaves.
		*
		* @module dsh-connect-workbuddy/client/ndjson
		*/
		/** Hand each parsed object to `onLine`, in order, as it arrives. */
		async function readNdjson(body, onLine) {
			const reader = body?.getReader();
			if (reader === void 0) return;
			const decoder = new TextDecoder();
			const emit = (line) => {
				const trimmed = line.trim();
				if (trimmed === "") return;
				try {
					const parsed = JSON.parse(trimmed);
					if (typeof parsed === "object" && parsed !== null) onLine(parsed);
				} catch {}
			};
			let buffer = "";
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) emit(line);
				}
				buffer += decoder.decode();
				emit(buffer);
			} finally {
				reader.releaseLock();
			}
		}
		//#endregion
		//#region src/client/probe-reason.ts
		/**
		* Outcomes whose label + stated recovery time ARE the whole story.
		*
		* `rate-limited` and `out-of-credit` both carry a reset instant, which the row
		* prints right beside them; their bodies restate that instant and add a
		* `code`/`requestId` pair nobody reads.
		*
		* `model-busy` belongs here for the opposite reason: its label states the whole
		* finding INCLUDING the remedy ("this model is loaded right now · not your
		* account — wait about a minute or switch models"). The recorded body is the
		* upstream's `14003` envelope, and appending it in a 72-character cell would
		* bury the remedy under the JSON the label was written to translate.
		*
		* `credential-rejected` and `not-found` are deliberately NOT here: their labels
		* state a conclusion ("sign in again", "no such model"), and the upstream's own
		* words are what make that conclusion checkable rather than asserted.
		*/
		const SELF_EXPLANATORY = /* @__PURE__ */ new Set([
			"rate-limited",
			"model-busy",
			"out-of-credit"
		]);
		/**
		* Longest inline reason kept.
		*
		* A cap rather than a wrapper: one pathological body must not push the rest of
		* the table off screen. 72 characters holds a full transport error and a full
		* upstream sentence, while stopping well short of a raw JSON document.
		*/
		const REASON_LIMIT = 72;
		/** The inline reason for one measurement, or `undefined` when it adds nothing. */
		function inlineProbeReason(outcome, message) {
			if (message === void 0 || message === "") return void 0;
			if (SELF_EXPLANATORY.has(outcome)) return void 0;
			const text = (humanSentenceOf(message) ?? stripTransportPrefix(message)).trim();
			return text === "" ? void 0 : truncate(text);
		}
		function truncate(text) {
			return text.length <= REASON_LIMIT ? text : `${text.slice(0, 71)}…`;
		}
		/** `{"code":6004,"msg":"…","requestId":"…"}` → the `msg` sentence, if it has one. */
		function humanSentenceOf(message) {
			if (!message.startsWith("{")) return void 0;
			let parsed;
			try {
				parsed = JSON.parse(message);
			} catch {
				return;
			}
			if (typeof parsed !== "object" || parsed === null) return void 0;
			const msg = parsed["msg"];
			return typeof msg === "string" && msg !== "" ? msg : void 0;
		}
		/** `transport error: TimeoutError: …` → `TimeoutError: …`. */
		function stripTransportPrefix(message) {
			return message.replace(/^transport error:\s*/u, "");
		}
		//#endregion
		//#region src/client/probe-age.ts
		const MINUTE_MS$1 = 6e4;
		const HOUR_MS$1 = 60 * MINUTE_MS$1;
		const DAY_MS$1 = 24 * HOUR_MS$1;
		/**
		* How long ago a measurement was taken, coarsely: "刚刚", "N 分钟前",
		* "N 小时前", "N 天前".
		*
		* Coarse on purpose, for the same reason `remainingText` rounds: a figure that
		* changes every second reads as live telemetry rather than as "how stale is
		* this", which is the only question being asked here.
		*
		* A clock skew that puts the measurement in the FUTURE (a stored `atMs` ahead
		* of `nowMs`, from a machine whose clock moved backwards) is reported as
		* "刚刚" rather than as a negative age: the record is real, and the card must
		* not print "-3 分钟前".
		*/
		function probeAgeText(t, atMs, nowMs) {
			const age = nowMs - atMs;
			if (age < MINUTE_MS$1) return t("row.poolProbeJustNow");
			if (age < HOUR_MS$1) return t("row.poolProbeMinutesAgo", { count: Math.round(age / MINUTE_MS$1) });
			if (age < 2 * DAY_MS$1) return t("row.poolProbeHoursAgo", { count: Math.round(age / HOUR_MS$1) });
			return t("row.poolProbeDaysAgo", { count: Math.round(age / DAY_MS$1) });
		}
		//#endregion
		//#region src/probe.ts
		/**
		* The probe sizes the card offers, in tokens.
		*
		* A closed set, each step a meaningful position relative to the measured 20k~30k
		* threshold: below it (10k/20k) proves an account can serve SHORT requests and
		* is the cheap choice; at it (30k) is the size that finally covers the whole
		* measured window; above it (50k/100k) is for conversations that routinely run
		* long, where a smaller probe would report "usable" for an account that refuses
		* the very next message.
		*
		* Exported so the schema's description, the card's dropdown, and the coercion
		* below cannot drift apart into three different menus.
		*/
		const PROBE_INPUT_TOKEN_CHOICES = [
			1e4,
			2e4,
			3e4,
			5e4,
			1e5
		];
		/**
		* The `<timestamp> UTC±N` core of the upstream's reset sentence.
		*
		* Shared by both spellings below so the two can never drift into accepting
		* different timestamps: the offset handling and the calendar round-trip check in
		* {@link parseUpstreamResetAt} are what make a parsed value trustworthy, and two
		* copies of this shape would be two chances to loosen one of them.
		*/
		const RESET_STAMP = String.raw`(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*UTC\s*([+-])(\d{1,2})(?::?(\d{2}))?`;
		new RegExp(`将在?\\s*${RESET_STAMP}[\\s\\S]*?重置`, "u");
		new RegExp(`(?:reset|resets|refresh|refreshes)\\s+(?:at|on)\\s+${RESET_STAMP}`, "iu");
		//#endregion
		//#region src/client/remaining.ts
		const MINUTE_MS = 6e4;
		const HOUR_MS = 60 * MINUTE_MS;
		const DAY_MS = 24 * HOUR_MS;
		/**
		* How far out hours stop being the useful unit.
		*
		* Below this, hours; at or above it, days. The cut is at TWO days rather than
		* one so that 30 hours reads as "约 30 小时后" instead of rounding to "约 1 天后",
		* which would understate it by six hours.
		*/
		const DAYS_AT_MS = 2 * DAY_MS;
		/**
		* A short "约 N 分钟后 / 约 N 小时后 / 约 N 天后", or `''` once the moment passed.
		*
		* The empty string is the contract callers depend on: an elapsed cooldown means
		* the account is already back, so appending "in 0 minutes" would assert the
		* opposite of the state the card is showing. Callers append this only when it is
		* non-empty.
		*
		* Rounding is deliberately coarse — "约 1 小时后" for 69 minutes is what a reader
		* wants, and a precision that changes every minute would be noise rather than
		* information. The absolute instant sits right beside it for anyone who needs it.
		*/
		function remainingText(t, untilMs, nowMs) {
			const left = untilMs - nowMs;
			if (left <= 0) return "";
			if (left < MINUTE_MS) return t("row.remainingImminent");
			if (left < HOUR_MS) return t("row.remainingMinutes", { count: Math.round(left / MINUTE_MS) });
			if (left < DAYS_AT_MS) return t("row.remainingHours", { count: Math.round(left / HOUR_MS) });
			return t("row.remainingDays", { count: Math.round(left / DAY_MS) });
		}
		//#endregion
		//#region src/account-pool.ts
		/**
		* The checked ids that still resolve to a local sign-in, in the caller's order.
		*
		* This is THE definition of "effective members", and it exists because the same
		* predicate was written five separate times: the status document
		* (`web-status.ts`), the batch route's empty-pool guard, the Host dependency the
		* card reads, `poolMemberAccounts` and the browser helper. Five copies of one
		* rule is this project's single most productive bug shape ("fixed one end,
		* missed the other"), so the rule now has one home and every site delegates to
		* it.
		*
		* ORDER IS THE CALLER'S, and comes from `orderedIds`: the answer preserves the
		* order of THAT argument. Callers pass whichever list's order they want to show
		* — the saved list for the user's own order, the store's roster for the account
		* table's. Neither is silently reshuffled by the filter. (The first parameter was
		* once named `saved`, which read as "this must be the saved list" even though
		* `web-status.ts` legitimately passes the roster for store order; the name was
		* the trap, so it now describes the ROLE instead of the source.)
		*
		* Pure, so it is unit-testable without a store, and it never mutates its input.
		*/
		function effectiveMembersOf(orderedIds, listedIds) {
			return orderedIds.filter((id) => listedIds.has(id));
		}
		/**
		* A latest-wins guard for one region's asynchronous work.
		*
		* Exists because `applyRotation` awaits (it fetches credits per member), so two
		* overlapping calls can interleave: a slow call that read "rotation is ON" can
		* resume AFTER a newer call cleared the override for "rotation is OFF" and write
		* the stale account back — leaving the card showing the pool switched off while
		* a rotated account is still billed.
		*
		* `begin()` claims a new generation and returns a probe; the caller must check
		* it after EVERY await and bail when it reports stale. Extracted as a pure
		* factory rather than inlined so the rule is unit-testable: an inlined token is
		* only observable by reproducing a real interleaving, which is slow and easy to
		* get subtly wrong (a harness that never actually overlaps passes either way).
		*/
		function createLatestWins() {
			const generations = {};
			return { begin(key) {
				const generation = (generations[key] ?? 0) + 1;
				generations[key] = generation;
				return () => generations[key] !== generation;
			} };
		}
		//#endregion
		//#region src/client/pool-state.ts
		/**
		* Pure decision helpers for the account pool's card section.
		*
		* 参考：`src/account-pool.ts` 的做法——把「判定规则」从组件里抽出来，让规则本身
		*   可被单测直接钉住，而不是只能通过渲染整棵组件树间接观察。
		* 改动：新增本模块，收纳三组此前内联在 `AccountPool.tsx` 里的判定。抽出它们的
		*   直接原因是**独立验证发现 H-1/H-2 两个最高危修复没有任何自动化回归测试**：
		*   内联在组件里就只能靠真实渲染验证，而渲染测试既慢又容易被隔离问题骗过。
		*
		* 本模块不 import React、不碰网络，纯函数、全函数。
		*
		* @module dsh-connect-workbuddy/client/pool-state
		*/
		/**
		* The base a draft edit starts from.
		*
		* Resolved at EDIT time rather than captured when the callback was built. The
		* defect this fixes: the callback's dependency list named individual scalar
		* fields, so a field added later (`memberAccountIds`) was missing from it and
		* the callback kept a STALE base — checking one account then silently dropped
		* another that had been saved in between.
		*
		* `previous` is the draft already in state; it only applies to the region it
		* was made on, because the two pools are independent and one region's unsaved
		* edits must never seed the other's.
		*/
		function draftBaseFor(previous, previousRegion, region, saved) {
			return previous !== null && previousRegion === region ? previous : saved;
		}
		/**
		* Membership that resolves to a real local sign-in — what a batch runs on.
		*
		* The HOST computes this and sends it; this helper only chooses which answer to
		* trust. Counting the raw saved list is what let the UI claim "已选 1 / 共 1"
		* and enable both buttons while the batch ran on ZERO accounts and reported
		* success, so:
		*
		*   - while the draft is CLEAN, the Host's answer is authoritative (it reflects
		*     what would actually run, including sign-ins that have since disappeared);
		*   - while the draft is DIRTY, it must be derived from the edited list, since
		*     the Host's answer describes the SAVED state and would ignore the edit the
		*     user is looking at.
		*/
		function effectiveMemberIds(input) {
			if (!input.dirty) return [...input.savedEffective];
			return effectiveMembersOf(input.draftMembers, input.listedIds);
		}
		/**
		* Saved member ids with no matching sign-in.
		*
		* Surfaced rather than silently ignored: the ids remain in the user's saved
		* list (a login can come back), so the card has to explain why the pool behaves
		* as though they were absent.
		*/
		function ghostMemberIds(draftMembers, listedIds) {
			return draftMembers.filter((id) => !listedIds.has(id));
		}
		/** How many characters of an id are shown when no name was ever measured. */
		const GHOST_ID_PREFIX = 8;
		/**
		* Label saved member ids that resolve to no local sign-in (issue #60).
		*
		* The old warning was a bare count, which named no account and had no
		* corresponding row — the user could neither identify the member nor act on it,
		* even though the collected name was in hand at write time. This turns the same
		* set into something renderable and specific.
		*
		* `names` is the Host's last-measured map; a missing entry means no measurement
		* ever recorded a name, not that the account has none. Ids keep the order the
		* saved list has, so the rendered list does not reshuffle between polls.
		*/
		function ghostMembers(draftMembers, listedIds, names = {}) {
			return ghostMemberIds(draftMembers, listedIds).map((id) => {
				const measured = names[id];
				const named = typeof measured === "string" && measured !== "";
				return {
					id,
					label: named ? measured : `${id.slice(0, GHOST_ID_PREFIX)}…`,
					named
				};
			});
		}
		/**
		* The names to show in one sentence, capped so the warning stays readable.
		*
		* Beyond three the sentence would wrap into a paragraph, so it ends with an
		* ellipsis — the removable list rendered underneath carries the full set, which
		* is why truncating here cannot hide a member.
		*/
		function ghostNameList(ghosts, limit = 3) {
			const shown = ghosts.slice(0, limit).map((ghost) => ghost.label).join("、");
			return ghosts.length <= limit ? shown : `${shown}…`;
		}
		/**
		* How many accounts a batch will really touch, as the log announces it.
		*
		* Mirrors the HOST's own resolution exactly — `effective ?? saved` in the pool
		* route — because the number in the activity log must describe what the Host
		* runs, not what the card happens to display. Two wrong answers are possible and
		* both were live at different times:
		*
		*   - counting the raw SAVED list overstates it, so a ghost-only pool logged
		*     "checking in 1 account(s)" and was then refused with 409 having touched
		*     nothing;
		*   - counting the DRAFT-derived set announces unsaved edits the Host will not
		*     run (it reads the committed config).
		*
		* `savedEffective` is `undefined` only for a Host too old to send it, where the
		* saved list is the best available answer — the same fallback the route uses.
		*/
		function announcedBatchCount(input) {
			return (input.savedEffective ?? input.savedMembers).length;
		}
		/**
		* Localize a pool route failure from its structured cause.
		*
		* Lives here, not in `AccountPool.tsx`, because the card's module graph pulls
		* DSH's browser packages and there is no jsdom in this project — a rule left
		* inside the component cannot be tested at all. That is not hypothetical: the
		* independent verification deleted this function's `no-live-members` branch AND
		* both locale copies of its copy, and the whole 618-test suite still passed.
		* Extracting it is what lets `tests/pool-state.spec.ts` pin every branch.
		*
		* Returns undefined for an unknown cause so the caller can fall back to the
		* Host's own words — a new cause added upstream must still be visible rather
		* than swallowed into a generic message.
		*
		* `detail` is the Host's raw `error` text, used only where the sentence has a
		* slot for it (`pool-failed`). It is NOT the primary path: echoing English
		* developer prose into a Chinese UI was the defect this function exists to
		* prevent, and only the cases with no structured cause fall back to it.
		*/
		function poolErrorText(t, reason, detail) {
			switch (reason) {
				case "no-members": return t("row.poolErrNoMembers");
				case "no-live-members": return t("row.poolErrNoLiveMembers");
				case "no-free-model": return t("row.poolErrNoFreeModel");
				case "target-model-stale": return t("row.poolErrStaleModel");
				case "checkin-unsupported": return t("row.poolErrNoCheckin");
				case "pool-unavailable": return t("row.poolErrUnavailable");
				case "pool-failed": return t("row.poolErrFailed", { message: detail ?? "" });
				default: return;
			}
		}
		/**
		* The message to show for a failed pool request, from every signal available.
		*
		* The three-tier rule, in order, and why each tier exists:
		*
		*  1. the STRUCTURED cause, localized — the Host's `error` is an English
		*     developer sentence, and echoing it put untranslated prose in a Chinese UI;
		*  2. the Host's raw text, for a cause this build does not know — still more
		*     informative than a generic message, and it keeps a new upstream cause
		*     visible rather than swallowed;
		*  3. a message keyed on the STATUS — every pool exit that carries no reason
		*     (405/403/400 and the generic 500) otherwise reached the user as bare
		*     English like `HTTP 405`.
		*
		* Extracted from the card for the same reason as {@link poolErrorText}: a rule
		* inside the browser-only `.tsx` cannot be tested, and the status tier in
		* particular had no guard at all — reverting it to `` `HTTP ${status}` `` left
		* the entire suite green.
		*/
		function poolFailureText(t, input) {
			return poolErrorText(t, input.reason, input.error) ?? input.error ?? t("row.poolErrHttp", { status: String(input.status) });
		}
		/**
		* Pool MEMBERS that can serve right now.
		*
		* Judged over members only. Using the whole account table made the "no usable
		* account" warning unreachable: unchecked rows are listed for the user to opt
		* into and never carry `excludedBy`, so any unchecked sign-in kept the count
		* above zero — exactly when every member was limited and the explanation was
		* most needed.
		*/
		function usableMemberIds(accounts, effectiveMembers, draftMembers) {
			const wanted = /* @__PURE__ */ new Set([...effectiveMembers, ...draftMembers]);
			return accounts.filter((account) => wanted.has(account.accountId) && account.excludedBy === void 0).map((account) => account.accountId);
		}
		/**
		* Whether EVERY member is blocked by the same MODEL — issue #64's pool-level
		* verdict.
		*
		* The reporter's case: four members, all measured `model-busy`, and the card
		* only showed four rows each saying "模型繁忙". Summed up by the reader that
		* reads as "my pool is broken", and the natural next move — switch accounts —
		* is the one action that cannot help, because the limit follows the model. The
		* per-row labels are each true and the aggregate conclusion is false, which is
		* why this needs its own decision rather than another row label.
		*
		* The conditions, and where each is enforced — NOT just "some member is
		* model-busy":
		*
		*   - **at least one member.** Enforced by the length check: an empty pool has
		*     no model-wide story to tell, and the plain "no usable account" sentence is
		*     the honest one there (nothing is checked).
		*   - **no member usable, and every blocked member's reason IS `model-busy`.**
		*     Both fall out of the single `every` predicate, because a usable member has
		*     `excludedBy === undefined`. See the note at the return statement: they are
		*     genuinely one condition in code, and writing them as two produced an
		*     unreachable branch that no test could hold.
		*
		* A pool where one account is rate-limited and the rest are model-busy is NOT a
		* model verdict: the rate limit really is about that account, and saying "it is
		* the model, not your accounts" would be the same class of false comfort this
		* helper exists to remove.
		*
		* Returned as a boolean rather than a prebuilt sentence so the caller keeps
		* every user-visible string in the locale table.
		*/
		function allMembersBlockedByModel(accounts, effectiveMembers, draftMembers) {
			const wanted = /* @__PURE__ */ new Set([...effectiveMembers, ...draftMembers]);
			const members = accounts.filter((account) => wanted.has(account.accountId));
			if (members.length === 0) return false;
			return members.every((member) => member.excludedBy === "model-busy");
		}
		//#endregion
		//#region src/client/AccountPool.tsx
		/**
		* The account pool's card section.
		*
		* 参考：`WorkBuddyCard.tsx` 的既有写法 —— 草稿态 + dirty 标记 + 「保存/放弃」、
		*   60 秒轮询、`writeField` 验证写入，全部沿用；样式类名继续用
		*   `dsm-workbuddy-*` 前缀，好让这一块与卡片其余部分共用同一套外观语言。
		* 改动：把「账号池」这一整块独立成模块。原因是它有三条别的区块没有的规则，
		*   放在卡片里会被淹没：
		*
		*   1. **一种状态、两套写入。** 偏好（启用、目标模型、成员）走草稿 + 保存
		*      （保存成功才丢弃草稿）；**测试结果**是运行时事实，由 Host 在批量测试后
		*      自动落盘，绝不经这个保存按钮。把它们混在一起，一次「保存」就会用旧草稿
		*      覆盖刚测出的结果。
		*   2. **免费模型可能不存在。** 国内版静态目录不带倍率，所以「自动挑免费模型」
		*      在国内版首次刷新前会挑到空。此时**不回退到收费模型**，而是如实说明并
		*      停用测试按钮。
		*   3. **签到只在有它的区域出现。** 海外区域没有签到，按钮与那一列都不渲染；
		*      Host 侧同样拒绝该动作，免得留下一个界面看不见、接口却还能打的死角。
		*
		* @module dsh-connect-workbuddy/client/AccountPool
		*/
		/** How many activity lines are kept; the oldest are dropped. */
		const LOG_LIMIT = 60;
		/**
		* Activity logs, kept per region OUTSIDE the component.
		*
		* The card unmounts its whole body when collapsed (`WorkBuddyCard.tsx:832`
		* renders it only while `open`), and again whenever a poll briefly leaves the
		* region unsigned-in. Component state therefore lost the entire log on every
		* collapse. Holding it here keeps the history across remounts and across tab
		* switches.
		*/
		const logStore = /* @__PURE__ */ new Map();
		/**
		* Whether two id sets are equal, ignoring order.
		*
		* The membership compare must not depend on click order: re-selecting the same
		* accounts in a different sequence is not an edit, and treating it as one would
		* light up "unsaved changes" for a no-op.
		*/
		function sameIds(left, right) {
			if (left.length !== right.length) return false;
			const wanted = new Set(right);
			return left.every((id) => wanted.has(id));
		}
		/** Whether a probe outcome means the model answered. */
		function outcomeOk(outcome) {
			return outcome === "ok";
		}
		/** A short, localizable label for one probe outcome. */
		function outcomeText(t, outcome) {
			switch (outcome) {
				case "ok": return t("row.probeOk");
				case "rate-limited": return t("row.poolExcludedRateLimited");
				case "model-busy": return t("row.poolExcludedModelBusy");
				case "out-of-credit": return t("row.poolExcludedOutOfCredit");
				case "credential-rejected": return t("row.probeCredentialRejected");
				case "not-found": return t("row.probeNotFound");
				case "unavailable": return t("row.probeUnavailable");
				default: return t("row.probeFailed");
			}
		}
		function formatNumber$1(value) {
			return formatCredits(value);
		}
		/**
		* `MM/DD, HH:mm` on a 24-hour clock.
		*
		* `hourCycle: 'h23'` is REQUIRED, not decorative: without it `Intl` follows the
		* browser locale's preference, and en-US renders `09/30, 01:23 PM`. A wall-clock
		* glued to "AM/PM" reads as 12-hour no matter what the surrounding UI assumes,
		* and it is the one thing a Chinese user cannot scan past — the card otherwise
		* speaks 24-hour everywhere (see `formatClock`).
		*
		* `h23` rather than `hour12: false`, because the latter maps to `h24` in some
		* engines and would print midnight as `24:00`. `h23` pins 00–23 exactly, which
		* is also the cycle DSH's own timestamps use.
		*/
		function formatShort(value) {
			return new Intl.DateTimeFormat(void 0, {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			}).format(new Date(value));
		}
		function formatClock$1(value) {
			return new Intl.DateTimeFormat(void 0, {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hourCycle: "h23"
			}).format(new Date(value));
		}
		/** A dot colour for one account's state. */
		function stateColor(account) {
			if (account.excludedBy !== void 0) return account.excludedBy === "rate-limited" || account.excludedBy === "model-busy" || account.excludedBy === "unavailable" ? "var(--dsw-alias-state-warn-primary, #f59e0b)" : "var(--dsw-alias-state-error-primary, #ef4444)";
			if (account.probe === void 0) return "var(--dsw-alias-label-dimmed, #9aa0a6)";
			return outcomeOk(account.probe.outcome) ? "var(--dsw-alias-state-success-primary, #22a06b)" : "var(--dsw-alias-state-warn-primary, #f59e0b)";
		}
		/**
		* The pool section.
		*
		* Renders nothing when the Host reports no pool state at all: an older Host
		* built without this feature should show an unmodified card, not an empty
		* section implying the feature exists.
		*/
		function AccountPool(props) {
			const { t, region, pool, settingsScope, siblingBusy, onBusyChange, onSaved, onRefresh, onRescan, rescanning, onSelectAccount, selectingAccount, accountTools, headerExtra } = props;
			const [draft, setDraft] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(void 0);
			const [actionError, setActionError] = (0, react.useState)(void 0);
			const [log, setLog] = (0, react.useState)(() => logStore.get(region) ?? []);
			(0, react.useEffect)(() => {
				setLog(logStore.get(region) ?? []);
			}, [region]);
			const [draftRegion, setDraftRegion] = (0, react.useState)(void 0);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const saved = {
				enabled: pool?.enabled ?? false,
				targetModelId: pool?.targetModelId || pool?.staleTargetModelId || "",
				probeInputTokens: pool?.probeInputTokens ?? 0,
				memberAccountIds: pool?.memberAccountIds ?? []
			};
			const active = draftRegion === region && draft !== null ? draft : saved;
			/**
			* Whether the pool is RUNNING right now, which is the SAVED value.
			*
			* `active` is the user's draft and only becomes reality at Save. Using it for
			* the parts that DESCRIBE the running pool made the card state a mode that had
			* not taken effect yet: flipping the switch off (unsaved) revealed the manual
			* picker while the pool was still ranking every request, so the picker showed
			* the rotated account as "in use" and a selection made there was overridden by
			* the very pool the user was looking at — the "shows A, bills B" trap this
			* section keeps guarding against. The mirror case was milder but the same
			* class of wrong: turning the pool ON (unsaved) hid the picker while the manual
			* account was still the one being billed.
			*
			* Everything that reports pool state reads this; only the switch itself (its
			* controlled value) and `dirty` read the draft, because those two ARE about
			* the pending edit.
			*/
			const poolRunning = saved.enabled;
			const dirty = draftRegion === region && draft !== null && (draft.enabled !== saved.enabled || draft.targetModelId !== saved.targetModelId || draft.probeInputTokens !== saved.probeInputTokens || !sameIds(draft.memberAccountIds, saved.memberAccountIds));
			/**
			* Membership that actually resolves to a local sign-in — what a batch runs on.
			*
			* The HOST computes this and sends it, so the card cannot drift from the
			* batch's real behaviour. Counting the raw saved list is what let the UI
			* claim "已选 1 / 共 1" and enable both buttons while the batch ran on ZERO
			* accounts and reported success.
			*
			* Derived locally as a FALLBACK for the case where the user has edited the
			* draft (the Host's answer describes the SAVED state) or an older Host omits
			* the field.
			*/
			const listedIds = new Set((pool?.accounts ?? []).map((account) => account.accountId));
			const effectiveMembers = effectiveMemberIds({
				savedEffective: pool?.effectiveMemberAccountIds ?? [],
				draftMembers: active.memberAccountIds,
				listedIds,
				dirty
			});
			/**
			* Saved ids with no matching sign-in; surfaced rather than silently ignored.
			*
			* Named from the Host's last-measured map (issue #60): the id alone told the
			* user nothing, because nothing on screen shows ids. `pool.memberNames` can
			* only be absent for an older Host or an account never measured, and the
			* helper then falls back to an id prefix instead of a blank.
			*/
			const ghostMembers$1 = ghostMembers(active.memberAccountIds, listedIds, pool?.memberNames ?? {});
			/**
			* Pool MEMBERS that can serve right now.
			*
			* Judged over members only. Using the whole account table made the "no usable
			* account" warning unreachable: unchecked rows are listed for the user to opt
			* into and never carry `excludedBy`, so any unchecked sign-in kept the count
			* above zero — exactly when every member was limited and the explanation was
			* most needed.
			*/
			const usableMemberSet = new Set(usableMemberIds(pool?.accounts ?? [], effectiveMembers, active.memberAccountIds));
			const usable = (pool?.accounts ?? []).filter((account) => usableMemberSet.has(account.accountId));
			const canEditPool = settingsScope !== void 0;
			(0, react.useEffect)(() => {
				onBusyChange?.(saving);
				return () => {
					onBusyChange?.(false);
				};
			}, [onBusyChange, saving]);
			const appendLog = (0, react.useCallback)((text, tone) => {
				setLog((previous) => {
					const next = [{
						atMs: Date.now(),
						text,
						tone
					}, ...previous].slice(0, LOG_LIMIT);
					logStore.set(region, next);
					return next;
				});
			}, [region]);
			/**
			* The latest saved preferences, for callbacks that must not capture a stale
			* copy.
			*
			* `saved` is rebuilt on every render, so putting it in a `useCallback` dep
			* list would rebuild the callback every render (making the memo pointless),
			* while listing individual fields by hand is exactly what caused the
			* data-loss defect this ref fixes: a field added later
			* (`memberAccountIds`) was missing from the list, so the callback kept a
			* stale base and checking one account silently dropped another.
			*
			* A ref gives both properties at once — a STABLE callback identity and a
			* base read at call time. It is synced in a LAYOUT effect, which flushes
			* synchronously after commit and BEFORE the browser paints: a user event
			* cannot be processed before a frame is painted, so by the time any click
			* reaches `editDraft` the ref is current. (A plain `useEffect` would leave a
			* window between paint and its flush; a render-phase write would be unsafe
			* under concurrent rendering, where a discarded pass could leave the ref
			* holding values from a tree that never committed.)
			*
			* Seeded with the initial value so the very first interaction, before any
			* effect has run, still reads real preferences.
			*/
			const savedRef = (0, react.useRef)(saved);
			(0, react.useLayoutEffect)(() => {
				savedRef.current = saved;
			});
			/** Read by `editDraft` so it can refuse edits mid-save without rebuilding. */
			const savingRef = (0, react.useRef)(saving);
			(0, react.useLayoutEffect)(() => {
				savingRef.current = saving;
			});
			const editDraft = (0, react.useCallback)((edit) => {
				if (savingRef.current) return;
				setDraftRegion(region);
				setDraft((previous) => {
					return edit(draftBaseFor(previous, draftRegion, region, savedRef.current));
				});
			}, [draftRegion, region]);
			const discard = (0, react.useCallback)(() => {
				setDraft(null);
				setDraftRegion(void 0);
				setSaveError(void 0);
			}, []);
			/** Save the pool preferences through the plugin's VERIFIED write path. */
			const save = (0, react.useCallback)(async () => {
				if (settingsScope === void 0 || !dirty || draft === null) return;
				setSaving(true);
				setSaveError(void 0);
				let committed = false;
				try {
					await writePoolPreferences(settingsScope, region, draft);
					if (await onSaved?.() === false) {
						if (mounted.current) setSaveError(t("row.poolSavedStaleRefresh"));
						return;
					}
					committed = true;
				} catch (error) {
					if (mounted.current) {
						const reason = error instanceof Error ? error.message : t("row.requestFailed");
						setSaveError(isFileContentionWriteError(error) ? `${reason}${t("row.saveContentionHint")}` : reason);
					}
				} finally {
					if (committed) discard();
					if (mounted.current) setSaving(false);
				}
			}, [
				dirty,
				discard,
				draft,
				onSaved,
				region,
				settingsScope,
				t
			]);
			/**
			* Drop one ghost member from the draft.
			*
			* A DRAFT edit, not a write: membership is one of the preferences the Save
			* button commits, and a control that wrote straight through would leave the
			* panel claiming "unsaved changes" for an edit it had already persisted. The
			* ghost rows therefore behave exactly like unchecking a listed account, which
			* is the behaviour the old copy ("save again to drop them") described but
			* gave the user no way to perform — the ids had no rows to uncheck.
			*/
			const removeGhost = (0, react.useCallback)((accountId) => {
				editDraft((current) => ({
					...current,
					memberAccountIds: current.memberAccountIds.filter((id) => id !== accountId)
				}));
			}, [editDraft]);
			/** Check or uncheck one account in this pool. */
			const toggleMember = (0, react.useCallback)((accountId, next) => {
				editDraft((current) => {
					const set = new Set(current.memberAccountIds);
					if (next) set.add(accountId);
					else set.delete(accountId);
					return {
						...current,
						memberAccountIds: [...set]
					};
				});
			}, [editDraft]);
			/** Check every listed account, or none of them. */
			const selectAll = (0, react.useCallback)((next) => {
				editDraft((current) => ({
					...current,
					memberAccountIds: next ? (pool?.accounts ?? []).map((account) => account.accountId) : []
				}));
			}, [editDraft, pool]);
			/** Run one batch action against the Host. */
			const runAction = (0, react.useCallback)(async (action) => {
				setBusy(action);
				setActionError(void 0);
				const memberCount = announcedBatchCount({
					savedEffective: pool?.effectiveMemberAccountIds,
					savedMembers: pool?.memberAccountIds ?? []
				});
				appendLog(action === "checkin" ? t("row.poolLogCheckinStart", { count: memberCount }) : t("row.poolLogTestStart", {
					count: memberCount,
					model: pool?.targetModelId ?? ""
				}), "info");
				/**
				* One test row into the activity log.
				*
				* Shared by the STREAMED shape (a line per account) and the whole-batch
				* shape (an older Host's single document), so the two can never report the
				* same measurement differently — the failure mode this file's history is
				* mostly made of.
				*/
				const logTestRow = (row) => {
					const outcome = row?.result?.outcome;
					if (outcome === void 0) {
						appendLog(t("row.poolLogTestRowMalformed", { accountName: row?.accountName === "" || row?.accountName === void 0 ? t("row.accountUnnamed") : row.accountName }), "warn");
						return;
					}
					appendLog(t("row.poolLogTestRow", {
						accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName,
						outcome: outcomeText(t, outcome)
					}), outcomeOk(outcome) ? "ok" : "warn");
				};
				try {
					const response = await fetch(withWorkBuddyRegionAndAction(WORKBUDDY_POOL_PATH, region, action), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					let failed = false;
					if ((response.headers.get("content-type") ?? "").includes("ndjson")) {
						if (!response.ok) throw new Error(poolFailureText(t, { status: response.status }));
						let sawRow = false;
						await readNdjson(response.body, (line) => {
							const row = line["row"];
							if (row !== void 0) {
								sawRow = true;
								if (mounted.current) logTestRow(row);
								return;
							}
							const reason = line["reason"];
							if (typeof reason === "string") {
								failed = true;
								const message = poolFailureText(t, {
									status: 200,
									reason,
									error: typeof line["error"] === "string" ? line["error"] : void 0
								});
								if (mounted.current) {
									setActionError(message);
									appendLog(t("row.poolLogBatchFailed", { message }), "error");
								}
							}
						});
						if (!mounted.current) return;
						if (!failed && sawRow) appendLog(t("row.poolLogTestDone"), "ok");
					} else {
						const body = await response.json().catch(() => void 0);
						if (!response.ok) throw new Error(poolFailureText(t, {
							status: response.status,
							reason: body?.reason,
							error: body?.error
						}));
						if (!mounted.current) return;
						if (action === "checkin") {
							for (const row of body?.rows ?? []) if (row.status === "claimed") appendLog(t("row.poolLogCheckinClaimed", {
								accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName,
								credit: String(row.credit ?? 0)
							}), "ok");
							else if (row.status === "already") appendLog(t("row.poolLogCheckinAlready", { accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName }), "info");
							else appendLog(t("row.poolLogCheckinFailed", {
								accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName,
								message: row.message ?? t("row.requestFailed")
							}), "error");
							appendLog(t("row.poolLogCheckinDone"), "ok");
						} else {
							for (const row of body?.rows ?? []) logTestRow(row);
							appendLog(t("row.poolLogTestDone"), "ok");
						}
					}
					if (failed) return;
					onRefresh?.();
				} catch (error) {
					const message = error instanceof Error ? error.message : t("row.requestFailed");
					if (mounted.current) {
						setActionError(message);
						appendLog(t("row.poolLogBatchFailed", { message }), "error");
					}
				} finally {
					if (mounted.current) setBusy(void 0);
				}
			}, [
				appendLog,
				onRefresh,
				pool,
				region,
				t
			]);
			/** The account whose per-row action is in flight; gates every row's buttons. */
			const [rowBusyAccountId, setRowBusyAccountId] = (0, react.useState)(void 0);
			/**
			* Which per-row action is running, for the veil's scenario line.
			*
			* A removal and a test both set `rowBusyAccountId`, but they mean different
			* things to the person watching ("this account is going away" versus "this
			* account is being measured") — and the veil exists precisely to say which.
			*/
			const [rowBusyAction, setRowBusyAction] = (0, react.useState)(void 0);
			/**
			* Test ONE account from its row.
			*
			* Same Host rule as the batch (testOne reuses the batch's probe), the same
			* log vocabulary, and the same refresh-after — a row result must read exactly
			* like the batch result it replaces.
			*/
			const runRowTest = (0, react.useCallback)(async (accountId) => {
				setRowBusyAccountId(accountId);
				setRowBusyAction("test");
				setActionError(void 0);
				const url = withWorkBuddyRegionAndAction(WORKBUDDY_POOL_PATH, region, "test") + "&accountId=" + encodeURIComponent(accountId);
				try {
					const response = await fetch(url, {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(poolFailureText(t, {
						status: response.status,
						reason: body?.reason,
						error: body?.error
					}));
					if (!mounted.current) return;
					const row = body?.rows?.[0];
					if (row === void 0) {
						setActionError(t("row.poolLogTestRowMalformed", { accountName: t("row.accountUnnamed") }));
						return;
					}
					const outcome = row.result?.outcome;
					if (outcome === void 0) appendLog(t("row.poolLogTestRowMalformed", { accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName }), "warn");
					else appendLog(t("row.poolLogTestRow", {
						accountName: row.accountName === "" ? t("row.accountUnnamed") : row.accountName,
						outcome: outcomeText(t, outcome)
					}), outcomeOk(outcome) ? "ok" : "warn");
					onRefresh?.();
				} catch (error) {
					const message = error instanceof Error ? error.message : t("row.requestFailed");
					if (mounted.current) {
						setActionError(message);
						appendLog(t("row.poolLogBatchFailed", { message }), "error");
					}
				} finally {
					if (mounted.current) {
						setRowBusyAccountId(void 0);
						setRowBusyAction(void 0);
					}
				}
			}, [
				appendLog,
				onRefresh,
				region,
				t
			]);
			/**
			* Remove ONE account from its row, via the Host.
			*
			* The Host dismisses the account (and deletes its vault entry when it has
			* one), so the row stays gone across rescans. The desktop app is not signed
			* out. The message below still distinguishes the two cases, because "there
			* was no plugin-stored copy" is worth saying: it tells the user the account
			* comes from the app itself rather than from an OAuth sign-in or an import.
			*/
			const runRowRemove = (0, react.useCallback)(async (accountId, accountName) => {
				setRowBusyAccountId(accountId);
				setRowBusyAction("remove");
				setActionError(void 0);
				const url = withWorkBuddyRegionAndAction(WORKBUDDY_POOL_PATH, region, "remove") + "&accountId=" + encodeURIComponent(accountId);
				try {
					const response = await fetch(url, {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(poolFailureText(t, {
						status: response.status,
						reason: body?.reason,
						error: body?.error
					}));
					if (!mounted.current) return;
					appendLog(body?.removed === true ? t("row.poolRowRemoved", { accountName: accountName === "" ? t("row.accountUnnamed") : accountName }) : t("row.poolRowRemoveDesktopOnly", { accountName: accountName === "" ? t("row.accountUnnamed") : accountName }), body?.removed === true ? "ok" : "info");
					await onRefresh?.();
				} catch (error) {
					const message = error instanceof Error ? error.message : t("row.requestFailed");
					if (mounted.current) {
						setActionError(message);
						appendLog(t("row.poolLogBatchFailed", { message }), "error");
					}
				} finally {
					if (mounted.current) {
						setRowBusyAccountId(void 0);
						setRowBusyAction(void 0);
					}
				}
			}, [
				appendLog,
				onRefresh,
				region,
				t
			]);
			if (pool === void 0) return null;
			/**
			* Where the target model came from, and which model it is.
			*
			* Shown INSIDE the 「目标 test model」 setting row (as its description line)
			* rather than as a note under the buttons, which is where it used to be — one
			* of two places that stated the target model, the other being the header
			* subtitle. Both are gone from the header, so this is now the single place the
			* provenance is stated, right beside the control it describes.
			*
			* Returns null when there is nothing to say, so the caller can fall back to the
			* static explanation instead of rendering an empty "current:" prefix.
			*/
			const targetProvenance = pool.targetModelSource === "preferred" ? t("row.poolTargetCurrentPreferred", { model: pool.targetModelId ?? "" }) : pool.targetModelSource === "free" ? t("row.poolTargetCurrentFree", { model: pool.targetModelId ?? "" }) : pool.targetModelSource === "stale" ? t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) : pool.targetModelSource === "none" ? t("row.poolTargetNone") : null;
			/**
			* The account the next request will start from.
			*
			* Read from the Host's `current` flag rather than re-derived here: the Host
			* owns the selection, and a browser-side guess is how the card would start
			* disagreeing with the account actually billed.
			*/
			const currentAccount = pool.accounts.find((account) => account.current);
			const currentName = currentAccount === void 0 ? void 0 : currentAccount.accountName === "" ? t("row.accountUnnamed") : currentAccount.accountName;
			return (0, react.createElement)("section", { className: "dsm-workbuddy-pool" }, rowBusyAction === "remove" ? (0, react.createElement)(BusyOverlay, {
				visible: true,
				message: t("row.poolRowRemoving"),
				hint: t("row.veilHintList")
			}) : null, saving ? (0, react.createElement)(BusyOverlay, {
				visible: true,
				message: t("row.poolSaving"),
				hint: t("row.veilHintList")
			}) : null, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-head" }, (0, react.createElement)("h3", { className: "dsm-workbuddy-pool-title" }, t("row.poolTitle")), headerExtra === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-head-extra" }, headerExtra), currentName === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-current-badge" }, t("row.poolCurrentHeader", { account: currentName }))), !poolRunning && onSelectAccount !== void 0 && pool.accounts.length > 0 ? (0, react.createElement)("div", { className: "dsm-workbuddy-pool-set" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-copy" }, (0, react.createElement)("b", null, t("row.poolManualAccountLabel")), (0, react.createElement)("span", null, t("row.poolManualAccountHint"))), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-ctl" }, (0, react.createElement)("select", {
				className: "dsm-workbuddy-pool-select dsm-workbuddy-pool-account-select",
				value: currentAccount?.accountId ?? "",
				disabled: selectingAccount === true,
				onChange: (event) => {
					onSelectAccount(event.currentTarget.value);
				}
			}, pool.accounts.some((account) => account.current) ? null : (0, react.createElement)("option", {
				value: "",
				disabled: true
			}, t("row.poolManualAccountNone")), ...pool.accounts.map((account) => (0, react.createElement)("option", {
				key: account.accountId,
				value: account.accountId
			}, account.accountName === "" ? t("row.accountUnnamed") : account.accountName))))) : null, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-actions" }, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-actions-group" }, pool.checkinSupported ? (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-primary",
				disabled: busy !== void 0 || effectiveMembers.length === 0,
				onClick: () => {
					runAction("checkin");
				}
			}, busy === "checkin" ? t("row.poolCheckingIn") : t("row.poolCheckinAll")) : null, (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline",
				disabled: busy !== void 0 || effectiveMembers.length === 0 || pool.targetModelSource === "none" || pool.targetModelSource === "stale",
				title: pool.targetModelSource === "none" ? t("row.poolTargetNone") : pool.targetModelSource === "stale" ? t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) : void 0,
				onClick: () => {
					runAction("test");
				}
			}, busy === "test" ? t("row.poolTesting") : t("row.poolTestAll")), busy === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-hint" }, t("row.poolBusyHint"))), onRescan === void 0 ? null : (0, react.createElement)("div", { className: "dsm-workbuddy-pool-actions-group" }, (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline",
				disabled: rescanning === true,
				onClick: onRescan
			}, rescanning === true ? t("row.accountsScanning") : t("row.accountsRescan")))), !poolRunning ? (0, react.createElement)("p", { className: "dsm-workbuddy-pool-note" }, t("row.poolEnabledHint")) : null, poolRunning && usable.length === 0 ? allMembersBlockedByModel(pool?.accounts ?? [], effectiveMembers, active.memberAccountIds) ? (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-warn",
				role: "status"
			}, `${t("row.poolModelWideBusy")} ${t("row.poolModelWideBusyHint")}`) : (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-warn",
				role: "status"
			}, `${t("row.poolNoCandidate")} ${t("row.poolNoCandidateHint")}`) : null, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-members" }, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-members-head" }, (0, react.createElement)("div", null, (0, react.createElement)("h4", { className: "dsm-workbuddy-pool-members-title" }, t("row.poolMembersTitle")), (0, react.createElement)("p", { className: "dsm-workbuddy-pool-note" }, t("row.poolMembersHint"))), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-members-actions" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-hint" }, t("row.poolSelectedCount", {
				count: effectiveMembers.length,
				total: pool.accounts.length
			})), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline dsm-workbuddy-pool-small-btn",
				disabled: pool.accounts.length === 0 || !canEditPool,
				onClick: () => selectAll(true)
			}, t("row.poolSelectAll")), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline dsm-workbuddy-pool-small-btn",
				disabled: effectiveMembers.length === 0 || !canEditPool,
				onClick: () => selectAll(false)
			}, t("row.poolSelectNone")))), (0, react.createElement)("div", { className: `dsm-workbuddy-pool-table${pool.checkinSupported ? " dsm-workbuddy-pool-table-checkin" : ""}` }, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-row dsm-workbuddy-pool-row-head" }, (0, react.createElement)("span", null, t("row.poolColumnAccount")), (0, react.createElement)("span", null, t("row.poolColumnCredits")), (0, react.createElement)("span", null, t("row.poolColumnProbe")), pool.checkinSupported ? (0, react.createElement)("span", null, t("row.poolColumnCheckin")) : null, (0, react.createElement)("span", null)), ...pool.accounts.map((account) => renderAccountRow({
				t,
				account,
				checked: active.memberAccountIds.includes(account.accountId),
				canEdit: canEditPool,
				checkinSupported: pool.checkinSupported,
				onToggle: (next) => toggleMember(account.accountId, next),
				busy: rowBusyAccountId !== void 0,
				testDisabled: pool.targetModelSource === "none" || pool.targetModelSource === "stale",
				targetHint: pool.targetModelSource === "none" ? t("row.poolTargetNone") : pool.targetModelSource === "stale" ? t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) : void 0,
				onTest: () => {
					runRowTest(account.accountId);
				},
				onRemove: () => {
					runRowRemove(account.accountId, account.accountName);
				}
			}))), effectiveMembers.length === 0 ? (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-warn",
				role: "status"
			}, `${t("row.poolNoneSelected")} ${t("row.poolNoneSelectedHint")}`) : null, ghostMembers$1.length === 0 ? null : (0, react.createElement)("div", { className: "dsm-workbuddy-pool-ghosts" }, (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-warn",
				role: "status"
			}, t("row.poolGhostMembers", {
				count: ghostMembers$1.length,
				names: ghostNameList(ghostMembers$1)
			})), (0, react.createElement)("ul", { className: "dsm-workbuddy-pool-ghost-list" }, ghostMembers$1.map((ghost) => (0, react.createElement)("li", {
				key: ghost.id,
				className: "dsm-workbuddy-pool-ghost"
			}, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-ghost-name" }, ghost.label), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-workbuddy-pool-ghost-remove",
				title: t(ghost.named ? "row.poolGhostRemoveNamed" : "row.poolGhostRemoveUnnamed", { account: ghost.label }),
				"aria-label": t("row.poolGhostRemove", { account: ghost.label }),
				disabled: saving,
				onClick: () => {
					removeGhost(ghost.id);
				}
			}, "✕"))))), dirty && !sameIds(active.memberAccountIds, saved.memberAccountIds) ? (0, react.createElement)("p", { className: "dsm-workbuddy-pool-dirty" }, t("row.poolUnsavedMembers")) : null), pool.targetModelSource === "none" ? (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-warn",
				role: "status"
			}, `${t("row.poolTargetNone")} ${t("row.poolTargetNoneHint")}`) : null, pool.targetModelSource === "stale" ? (0, react.createElement)("div", { className: "dsm-workbuddy-pool-conflict" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-conflict-main" }, (0, react.createElement)("b", null, t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" })), (0, react.createElement)("span", null, t("row.poolTargetStaleHint"))), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline",
				disabled: !canEditPool,
				onClick: () => {
					editDraft((current) => ({
						...current,
						targetModelId: ""
					}));
				}
			}, t("row.poolTargetStaleClear"))) : null, actionError === void 0 ? null : (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-error",
				role: "alert"
			}, actionError), renderSettings({
				t,
				pool,
				active,
				dirty,
				saving,
				siblingBusy: siblingBusy === true,
				saveError,
				settingsScope,
				onEdit: editDraft,
				onSave: () => {
					save();
				},
				onDiscard: discard,
				appendLog,
				targetProvenance,
				...accountTools === void 0 ? {} : { accountTools }
			}), (0, react.createElement)("p", { className: "dsm-workbuddy-pool-note" }, t("row.poolRegionNote")), renderLog({
				t,
				log,
				busy: busy !== void 0,
				onClear: () => {
					logStore.set(region, []);
					setLog([]);
				}
			}));
		}
		/** One account's row. */
		function renderAccountRow(input) {
			const { t, account, checked, canEdit, checkinSupported, onToggle, busy, testDisabled, targetHint, onTest, onRemove } = input;
			const name = account.accountName === "" ? t("row.accountUnnamed") : account.accountName;
			const excluded = exclusionText(t, account.excludedBy);
			const probe = account.probe;
			const outcomeLine = probe === void 0 ? t("row.poolNeverTested") : probe.retryAtMs !== void 0 ? `${outcomeText(t, probe.outcome)} · ${t("row.poolRetryAt", { at: formatShort(probe.retryAtMs) })}` : probe.outcome === "rate-limited" || probe.outcome === "model-busy" || probe.outcome === "out-of-credit" ? `${outcomeText(t, probe.outcome)} · ${t("row.poolRetryUnknown")}` : outcomeText(t, probe.outcome);
			const remaining = probe?.retryAtMs === void 0 ? "" : remainingText(t, probe.retryAtMs, Date.now());
			const reason = probe === void 0 ? void 0 : inlineProbeReason(probe.outcome, probe.message);
			const age = probe === void 0 ? void 0 : probeAgeText(t, probe.atMs, Date.now());
			const probeLabel = probe === void 0 ? void 0 : probe.source === void 0 ? {
				text: t("row.poolProbeSourceUnknown"),
				className: "dsm-workbuddy-pool-prov-tag dsm-workbuddy-pool-prov-unknown"
			} : probe.source === "live-request" ? {
				text: t("row.poolProbeSourceLive"),
				className: "dsm-workbuddy-pool-prov-tag dsm-workbuddy-pool-prov-live"
			} : {
				text: t("row.poolProbeSourceTest"),
				className: "dsm-workbuddy-pool-prov-tag"
			};
			const probeLine = [
				outcomeLine,
				remaining,
				reason
			].filter((part) => part !== void 0 && part !== "").join(" · ");
			return (0, react.createElement)("div", {
				className: `dsm-workbuddy-pool-row${account.current ? " dsm-workbuddy-pool-row-current" : ""}`,
				key: account.accountId
			}, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-account" }, (0, react.createElement)("label", { className: "dsm-workbuddy-pool-check" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked,
				disabled: !canEdit,
				"aria-label": t("row.poolSelectAria", { accountName: name }),
				onChange: (event) => onToggle(event.currentTarget.checked)
			})), (0, react.createElement)("span", {
				className: "dsm-workbuddy-usage-dot",
				style: { background: stateColor(account) }
			}), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-account-name" }, (0, react.createElement)("b", null, name), account.current ? (0, react.createElement)("span", { className: "dsm-workbuddy-pool-current-tag" }, t("row.poolCurrentBadge")) : null, (0, react.createElement)("span", { className: checked ? "dsm-workbuddy-pool-member" : "dsm-workbuddy-pool-not-member" }, checked ? t("row.poolMember") : t("row.poolNotMember")), excluded === void 0 ? probe === void 0 ? null : (0, react.createElement)("span", null, t("row.poolTestedAt", { at: formatShort(probe.atMs) })) : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-excluded" }, excluded))), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-credits" }, account.credits === void 0 ? (0, react.createElement)("span", null, "—") : (0, react.createElement)("b", null, formatNumber$1(account.credits)), account.expiringSoon !== void 0 && account.expiringSoon > 0 ? (0, react.createElement)("span", { className: "dsm-workbuddy-pool-soon" }, t("row.poolCreditSoon", { count: formatNumber$1(account.expiringSoon) })) : account.nearestExpiryMs === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-soon-plain" }, t("row.poolCreditNearest", { at: formatShort(account.nearestExpiryMs) }))), (0, react.createElement)("span", {
				className: "dsm-workbuddy-pool-probe",
				...probe?.message === void 0 ? {} : { title: probe.message }
			}, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-probe-main" }, probeLine), probeLabel === void 0 && age === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-probe-prov" }, probeLabel === void 0 ? null : (0, react.createElement)("span", { className: probeLabel.className }, probeLabel.text), probeLabel === void 0 || age === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-prov-sep" }, "·"), age === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-prov-age" }, age), probe === void 0 ? null : (0, react.createElement)("span", { className: "dsm-workbuddy-pool-prov-model" }, probe.modelId === void 0 ? t("row.poolProbeModelUnknown") : t("row.poolProbeModel", { model: probe.modelId })))), checkinSupported ? (0, react.createElement)("span", { className: "dsm-workbuddy-pool-checkin" }, account.checkedInToday === void 0 ? (0, react.createElement)("span", {
				className: "dsm-workbuddy-pool-unknown",
				title: t("row.poolNeverTested")
			}, t("row.poolCheckinUnknown")) : account.checkedInToday ? (0, react.createElement)("span", { className: "dsm-workbuddy-pool-checked" }, t("row.poolCheckedIn")) : t("row.poolNotCheckedIn")) : null, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-row-actions" }, (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline dsm-workbuddy-pool-small-btn",
				disabled: busy || testDisabled,
				title: testDisabled ? targetHint : void 0,
				onClick: onTest
			}, t("row.poolRowTest")), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline dsm-workbuddy-pool-small-btn",
				disabled: busy,
				title: t("row.poolRowRemoveHint"),
				"aria-label": t("row.poolRowRemoveAria", { accountName: name }),
				onClick: onRemove
			}, t("row.poolRowRemove"))));
		}
		/** The preference editor plus its save/discard actions. */
		function renderSettings(input) {
			const { t, pool, active, dirty, saving, siblingBusy, saveError, settingsScope, onEdit, onSave, onDiscard, targetProvenance, accountTools } = input;
			const canEdit = settingsScope !== void 0;
			const toggle = (label, hint, checked, onChange, disabled = false) => (0, react.createElement)("div", { className: "dsm-workbuddy-pool-set" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-copy" }, (0, react.createElement)("b", null, label), (0, react.createElement)("span", null, hint)), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-ctl" }, (0, react.createElement)("label", { className: "sw" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked,
				disabled: disabled || !canEdit,
				onChange: (event) => onChange(event.currentTarget.checked)
			}), (0, react.createElement)("span", { className: "sw-track" }))));
			return (0, react.createElement)("div", { className: "dsm-workbuddy-pool-settings-wrap" }, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-head" }, (0, react.createElement)("h3", { className: "dsm-workbuddy-pool-title" }, t("row.poolSettingsTitle")), dirty ? (0, react.createElement)("span", { className: "dsm-workbuddy-pool-dirty" }, t("row.poolDirty")) : null), accountTools === void 0 ? null : (0, react.createElement)("div", { className: "dsm-workbuddy-pool-tools" }, accountTools), (0, react.createElement)("p", { className: "dsm-workbuddy-pool-note" }, t("row.poolSettingsHint")), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-settings" }, toggle(t("row.poolEnabled"), t("row.poolEnabledHint"), active.enabled, (next) => onEdit((current) => ({
				...current,
				enabled: next
			}))), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-set" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-copy" }, (0, react.createElement)("b", null, t("row.poolTargetLabel")), (0, react.createElement)("span", null, targetProvenance === null ? null : `${targetProvenance} `, t("row.poolTargetHint"))), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-ctl" }, (0, react.createElement)("select", {
				className: "dsm-workbuddy-pool-select",
				value: active.targetModelId,
				disabled: !canEdit,
				onChange: (event) => {
					const value = event.currentTarget.value;
					onEdit((current) => ({
						...current,
						targetModelId: value
					}));
				}
			}, (0, react.createElement)("option", { value: "" }, t("row.poolTargetAutoOption")), active.targetModelId !== "" && !(pool.catalog ?? []).some((m) => m.id === active.targetModelId) ? (0, react.createElement)("option", {
				value: active.targetModelId,
				disabled: true
			}, t("row.poolTargetStaleOption", { model: active.targetModelId })) : null, ...(pool.catalog ?? []).map((model) => (0, react.createElement)("option", {
				value: model.id,
				key: model.id
			}, model.creditMultiplier === void 0 ? model.name : `${model.name} (x${model.creditMultiplier.toFixed(2)})`))))), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-set" }, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-copy" }, (0, react.createElement)("b", null, t("row.poolProbeSizeLabel")), (0, react.createElement)("span", null, t("row.poolProbeSizeHint"))), (0, react.createElement)("span", { className: "dsm-workbuddy-pool-set-ctl" }, (0, react.createElement)("select", {
				className: "dsm-workbuddy-pool-select",
				value: String(active.probeInputTokens),
				disabled: !canEdit,
				onChange: (event) => {
					const parsed = Number.parseInt(event.currentTarget.value, 10);
					const next = Number.isFinite(parsed) ? parsed : 0;
					onEdit((current) => ({
						...current,
						probeInputTokens: next
					}));
				}
			}, (0, react.createElement)("option", { value: "0" }, t("row.poolProbeSizeDefault")), ...PROBE_INPUT_TOKEN_CHOICES.map((tokens) => (0, react.createElement)("option", {
				value: String(tokens),
				key: String(tokens)
			}, t("row.poolProbeSizeOption", { tokens: String(tokens / 1e3) }))))))), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-save-bar" }, (0, react.createElement)("a", {
				className: "dsm-workbuddy-usage-cheer",
				href: WORKBUDDY_GITHUB_URL,
				target: "_blank",
				rel: "noopener noreferrer"
			}, t("row.cheer"), (0, react.createElement)("span", {
				className: "dsm-workbuddy-usage-cheer-star",
				"aria-hidden": "true"
			}, "★")), (0, react.createElement)("div", { className: "dsm-workbuddy-pool-save-buttons" }, (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline",
				disabled: !dirty || saving || siblingBusy,
				onClick: onDiscard
			}, t("row.poolDiscard")), (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-primary",
				disabled: !dirty || saving || siblingBusy || !canEdit,
				onClick: onSave
			}, saving ? t("row.poolSaving") : t("row.poolSaved")))), saveError === void 0 ? null : (0, react.createElement)("p", {
				className: "dsm-workbuddy-pool-error",
				role: "alert"
			}, t("row.poolSaveFailed", { message: saveError })));
		}
		/** The activity log. */
		function renderLog(input) {
			const { t, log, busy, onClear } = input;
			return (0, react.createElement)("div", { className: "dsm-workbuddy-pool-log" }, (0, react.createElement)("div", { className: "dsm-workbuddy-pool-log-head" }, (0, react.createElement)("span", null, t("row.poolLogTitle")), log.length === 0 ? null : (0, react.createElement)("button", {
				type: "button",
				className: "dsm-btn dsm-btn-outline dsm-workbuddy-pool-log-clear",
				disabled: busy === true,
				onClick: onClear
			}, t("row.poolLogClear"))), log.length === 0 ? (0, react.createElement)("div", { className: "dsm-workbuddy-pool-log-empty" }, t("row.poolLogEmpty")) : (0, react.createElement)("div", { className: "dsm-workbuddy-pool-log-body" }, ...log.map((entry, index) => (0, react.createElement)("div", {
				className: "dsm-workbuddy-pool-log-row",
				key: `${entry.atMs}-${index}`
			}, (0, react.createElement)("span", { className: "dsm-workbuddy-pool-log-time" }, formatClock$1(entry.atMs)), (0, react.createElement)("span", { className: `dsm-workbuddy-pool-log-text dsm-workbuddy-pool-log-${entry.tone}` }, entry.text)))));
		}
		//#endregion
		//#region src/client/OAuthSignIn.tsx
		/**
		* The card's OAuth QR sign-in section: one resting bar row plus a dialog
		* opened by the sign-in button.
		*
		* 参考：workbuddy2api-panel 的「添加账号」弹窗交互形态 —— 静态入口一行，
		*   点开后弹窗内分步走：获取授权链接 → 自动打开浏览器 → 弹窗内显示链接
		*   与等待状态 → 完成/失败回填结果。本实现沿用该步骤划分；弹窗样式直接
		*   用本项目导出/导入弹框的类（dsm-workbuddy-transfer-dialog），不引入
		*   第二套视觉。
		* 改动：自动打开浏览器。弹窗拦截的规避方式是「用户手势内同步 window.open
		*   占位，拿到授权 URL 后再导航」——点击「获取授权链接」的那一刻浏览器
		*   仍认定这是用户激活的手势链，占位窗口不会被拦；若 Host 环境连占位都
		*   拦（返回 null），降级为弹窗内手动「打开登录页」链接，功能不损失。
		*
		* 轮询循环压成一个组件内 effect：按 `OAUTH_POLL_INTERVAL_MS` 节奏问 Host
		*   「完成了吗」，完成即停。所有状态就地管理，零跨组件往返；Host 重启
		*   导致 loginId 失效会得到 done+error，与超时同一条文案路径。
		*
		* @module dsh-connect-workbuddy/client/OAuthSignIn
		*/
		/** Seconds since the login started, for the waiting line. */
		function elapsedSeconds(sinceMs, nowMs) {
			return Math.max(0, Math.floor((nowMs - sinceMs) / 1e3));
		}
		/**
		* How long the `syncing` phase may hold the veil before it lets go (issue #51).
		*
		* Shorter than a poll interval would be pointless; a few seconds is far longer
		* than a healthy loopback re-read takes, and anything past that is
		* indistinguishable from "never".
		*
		* What sits below this decision is an asymmetry worth spelling out. The
		* `waiting` phase has its own local deadline (see the waiting-clock effect), so
		* a login whose `loginId` died still ends. The `syncing` phase reached the veil
		* and awaited the card's re-read with NEITHER a deadline NOR a `catch` — and the
		* veil's visibility is `phase.kind === 'syncing'` and nothing else. So a re-read
		* that never settled held the veil up forever, while the credential was already
		* in the vault: reopening the card (or force-quitting DSH) showed the account,
		* which is exactly the "half usable" report — sign-in succeeded, the screen
		* never said so.
		*/
		const SYNC_SETTLE_TIMEOUT_MS = 5e3;
		/**
		* Await `work` but give up after `timeoutMs`; resolves `false` on timeout.
		*
		* The timer is cleared in a `finally`, so the common case (the re-read settles
		* first) leaves no pending timer holding the event loop — the reason this is a
		* race with an explicit cleanup rather than `Promise.race` alone.
		*
		* The timeout arm never rejects: a re-read that FAILS is not a failed sign-in,
		* and the caller must not be able to confuse the two. Rejection and timeout
		* stand for the same thing here — "the list did not prove it refreshed" — so
		* they take the same path.
		*
		* EXPORTED because `AccountTransfer`'s veil awaits the same card re-read and had
		* the same unbounded wait; sharing one implementation is what stops the two
		* veils from drifting apart again.
		*/
		async function settlesWithin(work, timeoutMs) {
			let timer;
			try {
				return await Promise.race([Promise.resolve(work).then(() => true, () => false), new Promise((resolve) => {
					timer = setTimeout(() => resolve(false), timeoutMs);
				})]);
			} finally {
				if (timer !== void 0) clearTimeout(timer);
			}
		}
		/**
		* Copy the sign-in URL to the clipboard; true on success.
		*/
		async function copyUrl(url) {
			try {
				await navigator.clipboard.writeText(url);
				return true;
			} catch {
				return false;
			}
		}
		/**
		* The section. Rendered on BOTH sign-in states: a signed-out machine gains
		* its first account here; a signed-in one can add another without leaving
		* the card.
		*/
		function OAuthSignIn({ t, region, onAdded }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialogOpen, setDialogOpen] = (0, react.useState)(false);
			const [copied, setCopied] = (0, react.useState)(false);
			const [pollTick, setPollTick] = (0, react.useState)(0);
			const [nowMs, setNowMs] = (0, react.useState)(() => Date.now());
			/**
			* The account the Host just added, held for the sync effect.
			*
			* The poll that answers `done` names the account; the effect that ends the
			* `syncing` phase needs that name to write the success line, and it cannot
			* read it off the phase because the phase is what it is about to replace.
			* State rather than a ref: the effect is keyed on it, so a second sign-in
			* (adding a second account) re-arms the deadline properly instead of reusing
			* a stale closure value.
			*/
			const [addedAccountName, setAddedAccountName] = (0, react.useState)("");
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const waiting = phase.kind === "waiting";
			(0, react.useEffect)(() => {
				if (!waiting || phase.kind !== "waiting") return;
				const expiresAtMs = phase.expiresAtMs;
				const timer = setInterval(() => {
					if (!mounted.current) return;
					const now = Date.now();
					setNowMs(now);
					if (now > expiresAtMs) setPhase({
						kind: "finished",
						message: "error",
						error: t("row.oauthTimedOut")
					});
				}, 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [
				waiting,
				phase,
				t
			]);
			(0, react.useEffect)(() => {
				if (phase.kind !== "waiting") return;
				const { loginId } = phase;
				let cancelled = false;
				const timer = setTimeout(() => {
					(async () => {
						try {
							const response = await fetch(withWorkBuddyRouteAction(WORKBUDDY_OAUTH_PATH, region, "poll"), {
								method: "POST",
								headers: {
									"content-type": "application/json",
									accept: "application/json"
								},
								credentials: "same-origin",
								body: JSON.stringify({ loginId })
							});
							const body = await response.json();
							if (cancelled || !mounted.current) return;
							if (!response.ok || !body || typeof body !== "object") {
								setPhase({
									kind: "finished",
									message: "error",
									error: `HTTP ${response.status}`
								});
								return;
							}
							if (!body.done) {
								setPollTick((tick) => tick + 1);
								return;
							}
							if (typeof body.error === "string" && body.error !== "") setPhase({
								kind: "finished",
								message: "error",
								error: body.error
							});
							else {
								const accountName = body.accountName ?? "";
								setPhase({
									kind: "syncing",
									accountName
								});
								setAddedAccountName(accountName);
							}
						} catch {
							setPollTick((tick) => tick + 1);
						}
					})();
				}, OAUTH_POLL_INTERVAL_MS);
				return () => {
					cancelled = true;
					clearTimeout(timer);
				};
			}, [
				onAdded,
				phase,
				pollTick,
				region
			]);
			/**
			* End the `syncing` phase — on the re-read, or on the deadline, whichever
			* comes first (issue #51).
			*
			* ## Why this is a separate effect and not an `await` in the poll
			*
			* The first attempt at this fix put the race inside the poll's `done` branch:
			*
			*     setPhase({ kind: 'syncing', accountName })
			*     await settlesWithin(onAdded?.(), SYNC_SETTLE_TIMEOUT_MS)
			*     if (cancelled || !mounted.current) return
			*     setPhase({ kind: 'finished', … })
			*
			* and it did not work — measured, not assumed. `phase` is a dependency of the
			* poll effect, so `setPhase({kind:'syncing'})` re-runs that effect, and React
			* runs the PREVIOUS cleanup first. That cleanup sets the old closure's
			* `cancelled = true`. React commits the cleanup before the `await` it is
			* inside ever resumes, so the resume always sees `cancelled === true` and
			* returns: the veil stayed up exactly as it had before.
			*
			* This also explains why the defect was invisible in review. A FAST re-read
			* resolves inside the same microtask batch, before React commits the cleanup,
			* so it passes the guard and the success line appears. Only a re-read slow
			* enough to cross a React commit — i.e. the reported case — loses the race
			* against its own cleanup. The bug hid behind its own common path.
			*
			* Running the wait in an effect keyed on the phase sidesteps the whole
			* interaction: this effect's own cleanup runs when the phase LEAVES
			* `syncing`, which is after it has already done its job, so there is no
			* self-cancellation to lose.
			*
			* ## The two outcomes
			*
			* Both end in `finished`/`added` and the difference is deliberately not shown
			* to the user. The account IS added — the Host stored the credential before it
			* answered the poll — so the honest report is success either way; the deadline
			* only stops the screen from claiming otherwise indefinitely. (`refreshUsage`
			* already surfaces a failed re-read as `refreshError` on the card itself, so
			* a genuinely broken usage route is still reported, by the component that
			* owns that data.)
			*/
			(0, react.useEffect)(() => {
				if (phase.kind !== "syncing") return;
				let cancelled = false;
				const finish = () => {
					if (cancelled || !mounted.current) return;
					setPhase({
						kind: "finished",
						message: "added",
						accountName: addedAccountName
					});
				};
				settlesWithin(Promise.resolve(onAdded?.()), SYNC_SETTLE_TIMEOUT_MS).then(finish);
				const timer = setTimeout(finish, SYNC_SETTLE_TIMEOUT_MS);
				return () => {
					cancelled = true;
					clearTimeout(timer);
				};
			}, [
				addedAccountName,
				onAdded,
				phase
			]);
			/**
			* Open a placeholder window WITHOUT `noopener`, and deliberately so.
			*
			* `noopener` is the correct feature for a link whose destination never needs
			* a handle — and that is exactly why it is wrong here. Per the spec, a
			* `window.open` call carrying `noopener` opens the tab but returns `null`
			* (MDN: "the new window will not have access to the originating window via
			* `Window.opener` and returns `null`"). The placeholder exists ONLY to be
			* navigated once the Host answers, so the handle IS the point: passing
			* `noopener` made `placeholder` null, the navigation was skipped, and every
			* sign-in left an empty `about:blank` tab behind instead of the sign-in page.
			*
			* The security property is kept, just established on the handle instead of
			* through the feature: `opener = null` is applied to the placeholder before
			* anything is loaded into it, so the destination still cannot reach back
			* through `window.opener`. `noreferrer` is dropped for the same reason —
			* the spec makes it imply `noopener`, so it would reintroduce the null.
			* Nothing is lost: the placeholder is same-origin and empty until navigated,
			* and the referrer would only ever have been the settings page.
			*/
			function openPlaceholder() {
				const placeholder = window.open("", "_blank");
				if (placeholder !== null) placeholder.opener = null;
				return placeholder;
			}
			/**
			* Fetch the authorization URL AND open the browser in one gesture chain.
			* The placeholder window is opened synchronously — inside the click's user
			* activation, before any await — so popup blocking cannot intervene; the
			* URL is navigated once the Host answers. A blocked placeholder (null)
			* degrades to the manual link inside the dialog, losing nothing but the
			* convenience.
			*/
			const start = async (placeholder) => {
				setPhase({ kind: "opening" });
				setCopied(false);
				try {
					const response = await fetch(withWorkBuddyRouteAction(WORKBUDDY_OAUTH_PATH, region, "start"), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json();
					if (!mounted.current) {
						placeholder?.close();
						return;
					}
					if (!response.ok || typeof body.loginId !== "string" || typeof body.verificationUri !== "string") {
						placeholder?.close();
						setPhase({
							kind: "finished",
							message: "error",
							error: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					if (placeholder !== null) placeholder.location.href = body.verificationUri;
					setPhase({
						kind: "waiting",
						loginId: body.loginId,
						verificationUri: body.verificationUri,
						startedAtMs: Date.now(),
						expiresAtMs: Date.now() + (typeof body.expiresIn === "number" && body.expiresIn > 0 ? body.expiresIn : 600) * 1e3
					});
					setNowMs(Date.now());
				} catch (error) {
					placeholder?.close();
					if (mounted.current) setPhase({
						kind: "finished",
						message: "error",
						error: error instanceof Error ? error.message : String(error)
					});
				}
			};
			/** Open the dialog and begin the login in the same click: the placeholder
			* window must be created synchronously to count as a user gesture. */
			const beginSignIn = () => {
				setDialogOpen(true);
				start(openPlaceholder());
			};
			/** Re-open the sign-in page from the waiting dialog (no new session).
			*
			* Here `noopener,noreferrer` IS right: this is a one-way navigation to a
			* third-party page and nothing needs a handle on it — the contrast with
			* {@link openPlaceholder} is the whole distinction. */
			const reopen = () => {
				if (phase.kind !== "waiting") return;
				window.open(phase.verificationUri, "_blank", "noopener,noreferrer");
			};
			/**
			* The three strings that NAME the sign-in method, per region.
			*
			* CN signs in by scanning a QR code with the WorkBuddy app; the international
			* build signs in on a web page. Every other line in this section (waiting,
			* cancel, done, copy) is about the flow, not the method, so it stays shared —
			* splitting it too would let the two regions drift apart for no gain.
			*/
			const titleKey = region === "cn" ? "row.oauthTitle" : "row.oauthTitleGlobal";
			const startKey = region === "cn" ? "row.oauthStart" : "row.oauthStartGlobal";
			const finishText = phase.kind === "finished" ? phase.message === "added" ? t("row.oauthDone", { accountName: phase.accountName === "" || phase.accountName === void 0 ? t("row.accountUnnamed") : phase.accountName }) : phase.message === "cancelled" ? t("row.oauthCancelled") : t("row.oauthError", { message: phase.error ?? "" }) : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-workbuddy-bar",
				"aria-label": t(titleKey),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: phase.kind === "syncing",
						message: t("row.oauthSyncing"),
						hint: t("row.veilHintList")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-bar-label",
						children: t(titleKey)
					}),
					phase.kind === "finished" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `dsm-workbuddy-bar-status ${phase.message === "added" ? "dsm-workbuddy-bar-ok" : "dsm-workbuddy-bar-error"}`,
						children: finishText
					}) : phase.kind === "waiting" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-bar-status",
						children: t("row.oauthOpened")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-workbuddy-bar-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: phase.kind === "opening",
							onClick: beginSignIn,
							children: phase.kind === "opening" ? t("row.oauthStarting") : t(startKey)
						})
					}),
					dialogOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-workbuddy-transfer-dialog",
						role: "dialog",
						"aria-label": t(titleKey),
						children: phase.kind === "opening" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.oauthStarting") }) : phase.kind === "waiting" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.oauthOpenHint") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-oauth-url",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: phase.verificationUri,
									target: "_blank",
									rel: "noopener noreferrer",
									children: phase.verificationUri
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsm-workbuddy-hint",
								children: [
									t("row.oauthWaiting", { seconds: elapsedSeconds(phase.startedAtMs, nowMs) }),
									" ",
									t("row.oauthExpires", { minutes: Math.max(1, Math.round((phase.expiresAtMs - nowMs) / 6e4)) })
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-workbuddy-transfer-dialog-actions",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										onClick: () => {
											copyUrl(phase.verificationUri).then((ok) => {
												if (mounted.current) setCopied(ok);
											});
										},
										children: copied ? t("row.oauthCopied") : t("row.oauthCopy")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										onClick: reopen,
										children: t("row.oauthReopen")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										onClick: () => {
											setPhase({
												kind: "finished",
												message: "cancelled"
											});
										},
										children: t("row.oauthCancel")
									})
								]
							})
						] }) : phase.kind === "finished" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: `${phase.message === "added" ? "dsm-workbuddy-bar-ok" : phase.message === "error" ? "dsm-workbuddy-bar-error" : ""}`,
							children: finishText
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-workbuddy-transfer-dialog-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-btn dsm-btn-outline",
								onClick: () => {
									setDialogOpen(false);
								},
								children: t("row.oauthDialogClose")
							})
						})] }) : null
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/AccountTransfer.tsx
		/**
		* The card's account-transfer section: batch export / import of the region's
		* stored credentials, in the file format shared with sibling credential
		* managers for the same upstream.
		*
		* 参考：扫码登录小节（OAuthSignIn）的组件形态 —— 单个 section、就地管理
		*   全部状态（busy / 结果行 / 错误）、零跨组件往返。导出弹框的交互（多选
		*   账号 → 下载 JSON）与导入弹框（选文件 → 脱敏预览 → 勾选 → 导入）沿用
		*   通行实现的步骤划分；预览只含展示字段与 hasToken 布尔量，token 明文
		*   永不进入浏览器。
		*
		* 导出用 <a download> Blob：卡片运行在设置页 iframe 里，无宿主保存对话框
		*   可用；a[download] 同源下载是沙箱内最可靠的方式。
		*
		* @module dsh-connect-workbuddy/client/AccountTransfer
		*/
		/**
		* How long the veil may wait on the card's re-read before it comes down.
		*
		* Same ceiling and same reasoning as the sign-in path's
		* `SYNC_SETTLE_TIMEOUT_MS` (issue #51): the veil is the only feedback this
		* operation gives, so its exit condition must not be a promise that can stay
		* pending. The `refreshing` phase has no other way out — no deadline, no
		* failure branch — so an unsettled re-read left the operator staring at
		* 「正在导入…」 over an import that had already succeeded.
		*/
		const REFRESH_SETTLE_TIMEOUT_MS = 5e3;
		/** Build the default export file name: workbuddy-accounts-YYYY-MM-DD.json. */
		function exportFileName() {
			const pad = (value) => String(value).padStart(2, "0");
			const d = /* @__PURE__ */ new Date();
			return `workbuddy-accounts-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
		}
		/** Download a JSON array as a local file (no host save dialog inside the iframe). */
		function downloadJson(fileName, data) {
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		}
		/** The section. Rendered on both sign-in states — a signed-out machine can
		* still import a file exported elsewhere; export without accounts answers
		* the error line. */
		function AccountTransfer({ t, region, accounts, onChanged }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialog, setDialog] = (0, react.useState)(void 0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [preview, setPreview] = (0, react.useState)(void 0);
			const [importSelected, setImportSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const fileInput = (0, react.useRef)(null);
			/**
			* The text of the file the user just picked.
			*
			* Held here rather than re-read from the input at import time: the picker
			* is a bare system dialog that closes immediately (see the import button),
			* so between preview and confirm there is no dialog on screen holding the
			* File. Re-reading `fileInput.current.files` would also break the moment
			* anything clears the input — and it must be cleared after every pick, or
			* choosing the SAME file twice fires no change event.
			*/
			const importText = (0, react.useRef)("");
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const closeDialog = () => {
				setDialog(void 0);
				setSelected(/* @__PURE__ */ new Set());
				setPreview(void 0);
				setImportSelected(/* @__PURE__ */ new Set());
			};
			const runExport = async () => {
				if (selected.size === 0) return;
				setPhase({ kind: "exporting" });
				try {
					const response = await fetch(withWorkBuddyRouteAction(WORKBUDDY_TRANSFER_PATH, region, "export"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ accountIds: [...selected] })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					downloadJson(exportFileName(), body.accounts);
					closeDialog();
					setPhase({
						kind: "done",
						message: t("row.transferExported", {
							count: body.accounts.length,
							fileName: exportFileName()
						})
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const readImportFile = async (file) => {
				setPhase({ kind: "importing" });
				try {
					const text = await file.text();
					importText.current = text;
					const response = await fetch(withWorkBuddyRouteAction(WORKBUDDY_TRANSFER_PATH, region, "preview"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ text })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					setPreview(body);
					setImportSelected(new Set(body.accounts.filter((entry) => entry.hasToken).map((entry) => entry.index)));
					setPhase({ kind: "idle" });
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const runImport = async () => {
				if (preview === void 0 || importSelected.size === 0 || importText.current === "") return;
				setPhase({ kind: "importing" });
				try {
					const text = importText.current;
					const response = await fetch(withWorkBuddyRouteAction(WORKBUDDY_TRANSFER_PATH, region, "import"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({
							text,
							indexes: [...importSelected]
						})
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || typeof body.imported !== "number") {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					closeDialog();
					const message = t("row.transferImported", {
						imported: body.imported,
						skipped: body.skipped ?? 0
					});
					setPhase({
						kind: "refreshing",
						message
					});
					await settlesWithin(Promise.resolve(onChanged?.()), REFRESH_SETTLE_TIMEOUT_MS);
					if (!mounted.current) return;
					setPhase({
						kind: "done",
						message
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const busy = phase.kind === "exporting" || phase.kind === "importing" || phase.kind === "refreshing";
			/** The veil's scenario line: what is happening, in the user's terms. */
			const veilMessage = phase.kind === "exporting" ? t("row.transferExporting") : phase.kind === "importing" || phase.kind === "refreshing" ? t("row.transferImporting") : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-workbuddy-bar",
				"aria-label": t("row.transferTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: busy,
						message: veilMessage,
						...busy ? { hint: t("row.veilHintList") } : {}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-bar-label",
						children: t("row.transferTitle")
					}),
					phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-bar-status dsm-workbuddy-bar-ok",
						children: phase.message
					}) : phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-bar-status dsm-workbuddy-bar-error",
						children: t("row.transferError", { message: phase.message })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-workbuddy-bar-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy || accounts.length === 0,
							onClick: () => {
								setSelected(/* @__PURE__ */ new Set());
								setDialog("export");
							},
							children: t("row.transferExport")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy,
							onClick: () => {
								fileInput.current?.click();
							},
							children: t("row.transferImport")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileInput,
						type: "file",
						accept: "application/json,.json",
						className: "dsm-workbuddy-transfer-file",
						onChange: (event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file !== void 0) {
								setPreview(void 0);
								setImportSelected(/* @__PURE__ */ new Set());
								setDialog("import");
								readImportFile(file);
							}
						}
					}),
					dialog === "export" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-workbuddy-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferExport"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferExportPick", { total: accounts.length }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-hint",
								children: t("row.transferHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-workbuddy-transfer-list",
								children: accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: selected.has(account.id),
										onChange: (event) => {
											const next = new Set(selected);
											if (event.target.checked) next.add(account.id);
											else next.delete(account.id);
											setSelected(next);
										}
									}),
									" ",
									account.accountName === "" ? t("row.accountUnnamed") : account.accountName
								] }) }, account.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-workbuddy-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									disabled: selected.size === 0 || phase.kind === "exporting",
									onClick: () => {
										runExport();
									},
									children: phase.kind === "exporting" ? t("row.transferExporting") : t("row.transferExportConfirm", { count: selected.size })
								})]
							})
						]
					}) : null,
					dialog === "import" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-workbuddy-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferImport"),
						children: preview === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferPreviewing") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferPreviewTotal", { total: preview.total }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-workbuddy-transfer-list",
								children: preview.accounts.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										disabled: !entry.hasToken,
										checked: importSelected.has(entry.index),
										onChange: (event) => {
											const next = new Set(importSelected);
											if (event.target.checked) next.add(entry.index);
											else next.delete(entry.index);
											setImportSelected(next);
										}
									}),
									" ",
									entry.nickname !== "" ? entry.nickname : entry.email !== "" ? entry.email : entry.uid !== "" ? entry.uid : t("row.transferEntryUnknown"),
									entry.hasToken ? "" : ` — ${t("row.transferNoToken")}`
								] }) }, entry.index))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-workbuddy-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									disabled: importSelected.size === 0 || phase.kind === "importing",
									onClick: () => {
										runImport();
									},
									children: phase.kind === "importing" ? t("row.transferImporting") : t("row.transferImportConfirm", { count: importSelected.size })
								})]
							})
						] })
					}) : null
				]
			});
		}
		//#endregion
		//#region src/native-modality.ts
		/**
		* Reviewed vendor classifications, keyed by EXACT model id (never a prefix).
		* Ids absent from this record are `unknown` — see {@link nativeModalityOf}.
		*/
		const NATIVE_MODALITY_BY_MODEL_ID = {
			"deepseek-v4-pro": "text",
			"glm-5.1": "text",
			"glm-5.2": "text",
			"glm-5.3": "text",
			"hy3": "text",
			"hy4-preview": "text",
			"deepseek-v4.1-flash": "multimodal",
			"glm-5.3-flash": "multimodal",
			"glm-5v-turbo": "multimodal",
			"kimi-k2.6": "multimodal",
			"kimi-k2.7": "multimodal",
			"kimi-k3-1": "multimodal",
			"minimax-m3": "multimodal"
		};
		/** The `auto` entry is a router that picks a model, not a model itself. */
		const ROUTER_MODEL_ID = "auto";
		/**
		* Native modality of one model id. Exact match only: a new model never
		* inherits a classification from its family, its display name, or the
		* platform's image flag.
		*/
		function nativeModalityOf(modelId) {
			if (modelId === ROUTER_MODEL_ID) return "router";
			return NATIVE_MODALITY_BY_MODEL_ID[modelId] ?? "unknown";
		}
		/**
		* Whether a model refresh should PRE-CHECK this model's image box.
		*
		* Only a documented `multimodal` is pre-checked. `text` is documented as
		* unable to read images, and `unknown` is deliberately left unchecked rather
		* than guessed — the whole reason this table exists is that the platform flag
		* guessed wrong. A platform `supportsImages: false` still vetoes, so a
		* documented-multimodal id can never be pre-checked against the platform's
		* explicit "no".
		*
		* The user can always tick a box by hand; this decides a DEFAULT only, and the
		* effective runtime flag remains the saved `imageModelIds`.
		*/
		function imageDefaultFor(info) {
			if (info.supportsImages === false) return false;
			return NATIVE_MODALITY_BY_MODEL_ID[info.id] === "multimodal";
		}
		//#endregion
		//#region src/client/icon.ts
		/**
		* Plugin icon (LD brand logo, 64px) shared across the LaoDing plugin family.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 同一 data URI，其注释说明来自
		*     dingminhua/dsh-subagent-default-model（MIT），用于让插件家族的
		*     外观保持一致。本项目沿用同一图标以达到同样目的。
		* 改动：无。
		*
		* @module dsh-connect-workbuddy/client/icon
		*/
		const WORKBUDDY_PLUGIN_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAXGUlEQVR4nH1bC7BdVXn+1tr7nHPvzb3JvUloSAQp0JHWoAMttKOCFrWU8irQSbCTQYG21IahnTJUUTsM0FJhZCzCSIcKImOpDkhrhQ5YC7ROB3lUBU3EyCuBFBIIedzcx3ntvTr/a621TwIns3PO3mfvddf/+v7v/9c6DvYKoYBz1cZNYfJpVBcNBm7dcIhj3TBM15VzqAE6XAWEGggVADroOl0byDW+PtRr9E732rl9r2PxOMNsrCogVE7PA0Kge4Lcz5/TGI6v00UaK+h98u4QUA9quIDg4Pe2i2LTsknc++mzZu9cv37VHNaFAveSJICj/9aFUNzrXHXSTwdnznl/Y+X9MaEP1D0A/ToKaUdDASoAK0YVYcLad/G88S6C1aQcOkI2Nj9HylBFBRMYqPUeFp6EDXQfKcIUoud6LQQP59rwrsBEOdhy9KGDK/7j9mUPmBKcCf++Z4YbF6eKLw+6QFioKl/DoYILlXMsHE2KPCCzwlsqoNb3oUw4Kq+2a0k4G4MtXOX3J4HNyulzUkC0eqYI8ZAaQZQSAh9080Qx1m7jHStnL/3B3ctvXbcuFOwBH/p5OG12DA/29leV6wcHeI8hadE1rBldl/6ACs7WMEuz0PIcKawe0Gdzeyf36eTzcOHxVAEpTEQB0QtY0PRZPMYsX+t3tSqBxkteYeHh6qqu6yIsmVhaHHtE7/fu/8fJhzzF/OywunXQR+DJOO9pkLp2NJ64pIXhaOxb/IfmJM29PemSJ+NSzJP1s2dhwmucJ6uaoIYFzVjnkFDhLRTkb2XC03gQTKDrZNjSV1icXwzPv9y99Z5Hw6R/psQnqoniyLBQ1d65IoGiDqZuHwWwzyFzx8xl5RDBZR4uCZc9E8fS+8TdSfHZ2KxAel6VwEIYZiflxC9NKToeKcKrAcjV2d2DK3xYqOcXJ478ytf2fcL3htWGegAaSZGeBnKixWgVPXRiZpEomLq4Kcri2RCc7zN3NWuq5XlOJLwqjq9liqlHlEfzSveIdVk0Fjh5kVjdjKLneniCtcEg7N492FBWAWvrHpwLzgmYUfySi+VorcJFBE6I7jIAjFnC3DybePKE5ClxLLsPI0q3kNAsYJ4g1wjkzDuju4nQJrx6RxRe/7YHfFX3MOyHtaUHloaKcqa4rcQTDWxubHnZ0lESNoaGXad7+RmLc7GMxbS4s8Y82S3mdhMshR+Po4pk181jkx22afHc8hL3plNTjOGDjEfu7pxfWkpcyA02Ofo6xpylPsMCi3eNTROShVawM0H4+4bXaGqzcTKQzc8j6VGPkb9tFtU56bwlBdK9ZMQMKNgolMtVKepFcq6hBMAzQJAQ6srG9iwNJRfN0LtWd64z1qZjRPDieBYQkyNTqFpCsoYoKQFoFt8xhA5icZ2fXWOwY4GScsT95Tv7XoSnd0ehgLJBSPSdkdhYWbSeAk2eCSzuScDs/qQo9dpRZarVWWm5ZRuxn8YRRabYtiwhn5PVRXD9js8FzM2rowKII7MnOJSR2GSZJMVUckfzjIjKMe2p5fOsENGfPESR38AwB8AsZTUBUV025TwWVEAsubSl6gYA8rU6eUMmvE2ErjMrQEDZQGkewGI6TcqPAhlT1hHBBV0xZC/R3B09JFmdXDESrIz5GRPMlWQA6kNAoVbjf7FAyq1vsW8xrt+rImI4aEiwIuqAMjI9y/8Z5RSAS+f04P4uTcihozDLaO6kZup2gSWFIXjm3plb75sHxkugMKzAgWmQcYmsTvqrgPkuMOgHFAhY0gnolDJfOgTM0t/xMcYTJeZz9QZRgHiUd5AQIHe2fNqIY3o4xiEw3wc++A6HvzweWNbWtKmsrF853PFEwDd/LEqoVOiYQQLQ7QGXn+Zw3okOhc9i1tw8umpS7mBQ4PW9Ab/YVuHxTTV+8EyF7TsqTHQCxtsBlVWSUVBViGYHcnMDQvaUyAv03wmPDcP8ECiy2lwOKl4CFz2+AoYDx1b73rkOayaVfUXziRMu9oGTbg54cz9pNlV9FEJzi8CJv+zwwOWWoZvZfXSst3rteDPgXx4e4LZv9fDS9grLlzotkclDakmXJCCFTswAdC5eZQqphwErZgr40QInAh4XHMbsHGt6ugSmWuLZwyqwlclFhwqOrSJgZky+izydc7bj+1ZPy7P9AT2nz/MR+PuK/g6/50fg8QdDGffQFQ4b13fwyFcmccl5HczOUgVYoXTcAGEBSWBzdRY4hoLUBvGeQGFgrM84gMWglq/mwszXqcSlAahgdi57l8/Mr9gaxiqbnZwheZMU23Lw88zN0zWff5ZzCpeyAApqTNWkjBorljnceMUEbvnMEqK0qIc1A6UAnYQS5/6Md4jTNxlhGUkKRYYBHmHCiEewJxQjzmmenFdphiXsZ0aKstogvmwkEiqwYml6MmS6kQkQKcUlICsIY6hyDAEbzupgZgr448/OouyI5Y3t8YgGfq5OIaHfeiZDWXclFizWw1OmF0lRQ4A8UWevnPTEsTNFjoQ7fV0UDq3SoSyBVgmU/FmOVsuz9VmfrCUBMPIMut4f1Dj9tzv4wqcmORzIvW1qwgOcYIC5vB0gzAClQW1EGuJXkgql2MlyuTHFhg4OAlrm8vRxtHrMFUhRV4trv/hawK3fqbF/QSwoYwSUPuCwlcDJ7y3wgeMKFHAYDgN7gOmwLBwGgxobzhnH/z7Txz9/exErpz2HK1teUZ+tTSGXZYZCFGAc3eqBZsESmZs1L0e92HK5TikSKA2N2CMY8QATfuvOgLOvqrBlW0CnyOioeWVF1/v4rXd7/M2fjeGEtQWGFO+FpkzFFPKOv/7zKXz/sR5m99foUJ2rRRNhhwCfAqBOxQkbVObHKSv14UZb2KnFdBAl5CdxvMwDcnotrTsW/vW9wPnXVdi2M+DwQ4DVK4CZSWDFVDp+aRkwNR7wxE8GOOuyWdz3vT7K0jMGyN8ToKTzFTMel2yYwPxcAJe56voR/eO7tOscY0Ls2GSFkJW+Nue8QTn6agJD6gta5mhwf7mHhCdesOGGCpu3AmMthzv+qsTHf6fArj0SP5YGKXNQZpleArRcjU9ePYdHnxgwPrAStK1EXkBhvO7scRx+aIleL2SWTzFP1qdQYkCs6dx66COob/28mB61GjzACwhmc9Q2rxnt/9GfUGwY1g4XfbHG488GjLWAmzYWOOU4zwAoKG6KteYG8YSAdunQKQM+dcMc9uwLbHnRv9Baumf5dIGPnNTB4jx5gQjNgisNLuH0Gr07ygKpjpdKsFnWGiuMXtLwfaPDpoRk/dFqjcYht6Q7P3lzhQefqvn87y4usOEjkgpjYlHhyT2psjMLErOcHANe3DbAXfd1xfUZVzRH6qMf/VA7E15JkfECdX9TiB+11ughDcisQGr4+wEfDqzrtegRxAau+aca3/gvEejK8z0uOcNhsUfWtAJGviOhrWKLXRwujgImx4Fvf3cR3V7gLGBRyDnfBbxnbQurVlImqJlEmdtLSpS/I9dACpD0l+I+sTjLCNbLe3sekHlEJry5/tJxh/98usZtDwo1vfTsAp/+mMeA0hrnPssalgl0PtoEEUYn18fbDltfHmLzlgEcs0MtiZ0oY+UKjyPWlBj0lRVGy3s+J2VQreKZIGUWq7MFDMEBaW01yMyoC7iRwmikG0zaZo5BcTwE9s0FXPS7Hp+/2DO356rQquKsvy9NDWV2yuXlM4Eb0O8FbN4ieTnCheIAKWLNao9qKPm/gJdD6bfhQkHlMLE9QmouF7Mlq1geM/hpO2xU/oNciT2K2B0Wik1/cHYu4Jz3O9y80bNXCOAJfnCzRAeguUhxbF0e7eLwMyIUKeW1HRkoWS9QXzPTnmWQvoOkQMED5Q8UDnDUE0ytLVv6jtbTyae6IP8T2qczNhKbAymLWP4nwXp94IhVDv9wWcGWoBRHHD/Fr8NPn6/Q8lpFpqCKwEgCGLsjF+4umOs3nZJeS8Y8ilrSHV0kazPqq6J5BRQylsgR4z2rALXhmWWkt8CAZvES49/aYDTZXsDxRzksnaDcTqAnz5DLtkqPux8c4LuPDTjfE9rnq0ziFUpotJfH4WFdjthUSbOjMdjFSXCtWg0EyyC9DU+fWcNq6UaDMq7tExJn6fFt3J+vKmPkZog9p4wqhoc6Dwvf8vjOfw9w+RcXucNj7e+0kpPa4wZmHDg1sHK5FAVCBXRgndb8XB2boj4TmBkgW9+AsLIOr/X6m/TX1uxjiyz3AOvjNQODMcVqb1GKrtrQ83qRQoCEf+SpITbeQJsSrLcnbhOR2zVZnBU0pXc46ghRAI+phMzGf3NnjRYBLOEPK8DzOxMheqcqFF5DIF+dyRZIYkhEgpJiNmn7wGIokhlLXWzNlEeHKvyTm4f4o+sWsdgNWHuUx2RHlG2KYDfniSaGyIUMMb4Zz/k+F5pGpyKp263x6v9VaBOztNyv40RmqGsG3o30+SMQZvXBAQsdb/UaJVTRdaVHZ2sPY22HzS9WuPDaLnbuqnHWySUe+vIU/uCjbcxRIUPpylKfeQMjuLTHF+drHH9sC2tWlxxGRKJiFADY/nKFXTsqjLUpE2jsx3Qq6C8A6CQEuP2V1wCNNfpmamvG/wg6amzLOmESPh+D0P7FVwMuuHoRW7dXOP19JW79zDjaLWBqQsLGipXo9jpZa2tTuG742EQmtKZSpcU/+VEf3fmANhVDbHnJGpEa8zUnxVK+o8N4fFx/H2F/MSXl3VvrBzhqUUmIJHdNedyAcfvrARdc08WzL9U4+bgSt181jjEFP1tljiVsrOHFAzothz27a5xx6jhOfn8HVUVU12YkvUR6/c/DPXQKEi4VPkyIuDrMiqNA3pbz/tGV29j3N68QetLweWuKKEOjdjMpsMX8Sb6nt2VLgCd/VuHMK4Z44ZUK7z26wJ1Xj2N6ynGKHOvYjhR6XumrKpFkbBfAnjcrrD2mhc9dORXpb5wJhULh8dzPB9j0wwEmlxDZMM9JyC9VoGQmz7wgU0Bc089dfqRCPKApqqsutCRGrarTf8PhjT0Bu2cDdu8L2LOvxu69AbP7A3a8UeEXWyu86zCPr187jjWHNFtclvqoFUZkiRRKf6/fDdj1eoXf/PUObrtlBstnpIVH1aB5IydBB3zr6wvodym/Sy9AKG8qi1NPgOixk7XBfJ0ub2o2lJBVdY2YsK6MFiWfO9/jnSuBHz1HHuGFSmuKC5XH6uUOHz+jhdUrndQChSiBXtTEoLRHQFj1a47bibbDrxxR4twzx7Bh/QTKlvCHKLzyf+oSbX66j0f/vYtlU1K/MAFSdyceEIVXAxdxeVy5fwPtRxHd9vw0GqBqIn4zWhpw4akeF5769gmDeADFr1mOXq/urHkN8Nyzx3DGKR20yoBDVhQ4+siSFUVWr014fZCUTue9bsCXrtsfOQIxWxNamiAKiOwZojxPHmBr75a/Y2hpP988pMEHYsfT1u0TEaFTyvMCS9m9htTWpIwlMMWuw8JizV3do99Z4PNXTnHLK9UXQemz4/rBhmW84naYw99fuw/PbR5g5XTBniwIT9bWuHcS+8YraAAfGyIZBlgGyHd45fv4UsTZW+rGmB7KghoVQkqK/J1XeEiIlLRJWRQ+DzzSx8+2DHHqB9osfK9Xs9DkKZRdpAucApDcXsb2uOX6WTz0r4tYQcIPc0HT59QBSpmgsBCILa98BSfb0jKa7jMAOEhTJOmGU2C85BCoINEvyT9IwHbL49WdFW68bZ6Xu9afPcZ3m+KUPFiASQiQkkuP/ftr3PS3s3j4/i73Aql+sc4vC6+rQIL2Qs+NY6QQqG0zZEZYLC2mYowfokVN1n6dGg/NV8YPzF1iBORlFK36BLS956XuP/3sPjy7ZYDL/2QJjv3VEr2+FDK8yKrZIa0byvS//0gPt39pDttfqHiVF4NEm2PDU0tgvpZ7AdMXMUZpW1Kb+4GaqY8+twpgx96A+x4PuPjDsmB54GukX3DQl1yfXwDuf7SHm766gJdfGeIPf38c11wxxd91aO/BQV673qjw1BMDPPhvi3j6yT7GSoeZZbKIa2UyNb3yJqitBebub6tPnosj22010rsf3exEgDNRAld9o8aPX3B412rdB2xgl1Hf0CiEMseoA3r9gG3bK/xw0wAvbB1iqkMkyeOw1QW+9s0FDAeCFeIwAYNewK5dNV7ZWmHb80O8uaNmUrR0Uqo6WgITmptITlRAg1LnZMiIEODec8MwkDV4707+A4isCHJD2cNr3GDfHLi/Z3v4448Xsj38EiepEOLqTru8RaDdHeDtLrZldn6/LnHbhLlNpwQmAB3vMNFxGOPtNZrmaqvzpbYXzm/ARyWvl4YIdYbU/Rn4CFMqYGq5ly0yVqUdUMnZ6q4Bl94zM2E9xGztTxc045aavK1Of1wxxQWiqDULYJuj6G/QEje7byAl6IT1YAF0H7HsKpUmjVV4eakcra6rwlIP6DJYtkbA6Ri8P0CB1jYv5u2lvBoULsfnnJpG9vCyIEqWZHeJrjJn48adGrzzSyZgGxek2ySeZqFjz3FjNd/vo0JKw8QEVgVqt0iKH1sDlBTKy+r6TLBx6nwFuPGefpMTc79Z3RRkPXw+H21njVSPcQ9fanXbWLymb/1/29RgkKmNTRuLBVXrxx0m+lkENmVY7S/zEWtrb9BWiRxlgZGCJ+a9PLHlfEDBTP2hsTFRdpVJNWdPx21qWVPDWtP5ik+j4Zn176wFzoWN9fcyoDNhI+dXppkA0XoCTQLEPCAIdhxk5Tur+nWPsChKYzxH97h/37aqm+z2Sw7ZvGRa5x5c3IuUlBBbVBYWBlymuEx4Gyuv74X4pDTXYILWD8ja4zRKYVR49Fcdxg3invt8yUsVJCRPHshrBWNZ+R49UYLt5tYfRcR6Xy0c3Ta5dJ6/Zd/vCNjlxCcueCa2l1pgGQDGzpIVSEPMyq6w5q+wzOoNUIzu0uz0SFhkHlHTiq4InO4zr9ENSjHO841N2e5ui3PrBTZQPFlagC0Jb54Vd4pZqNiOttgPoI4AZn1ZYLPzLoQatS2CNmod3T3W7Asc+Puc5D1JKRbpRJnFYgZAI9iQub7EvY9gxc9yW1vW+HgME3KkwSkNDs0EVnXqWqARIG3X1y3XDq0xbPbTS4q7vVcCN7qwGWM73/HV3P0t7iwImoOhlMZpe0rc8q7tblaE9vxzJaTCJa3nC/iZp6QFTgNGi/0mC9TvOTukUNLUG8Y6hZte7e/2l52Iu8ar6qXalR6hrhq5P0+LI7/DaYBgrHnMve1HEhYu6RkWgq2bvKDJ3cVGOfhZLOdYkaq8xPIYX2zVV72uyPBEN01XnTDuy2WLL33w+rG7/PpT3NyvrQ4bx9tww8qT1ejHNHFPQEJ6Ke0E1LJd2FmhR90g04xpP+tfKCjmYKaWIU/ImhcpTpXi2q7UfLeH9fXVqSVsTNiMD+Rh4uraDT2mlpXu8BNaG1etcnN+3T2huPcvWg8dubS6dHJJUfD6bFVXrq5rrw3+tCaXOuGmBENzAzHpu0tvL63uNj8bykdeoCkt8QHL+SqAkRxz60wJcQ9BFh6p7CX8CYEQLtShKocTfmbpRLHs3d1LT7u+9dA99tNZ+yHxBTcNztz0mr9x74I/hnZXhD7F/PCAn6bJz+U0vrPr7K5VJUJZf5/v040NDcG02LGGJVmfOsuxdifg03U9vUZHrPz0fl7p5caGjNkiEmTFUXBooUDbjWGs5TE+Pdyy6vjqijO+MPYACb+efjwdiYsqIewMk+d8tbro1b1uXXehPrYahmn+hZmGgtefqsalNFvU1BpAhM8QXhUlCmgCmihAUnBUQixk6J2eSYqwvM9Iz5sfrApM7LDF7W651oILbef3Tky0Nk2vcfeed0dxp3Nu7h6EYr2sgOL/Aa5OuMdnE5sWAAAAAElFTkSuQmCC";
		//#endregion
		//#region src/client/styles.ts
		/**
		* Client styles for the WorkBuddy plugin card.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 整套 `dsm-*` 卡片样式系统（卡片外壳、按钮原语、`--dsw-alias-*`
		*     主题变量与十六进制回退值）逐字沿用自该项目，其又复制自
		*     dingminhua/dsh-subagent-default-model（MIT）的 SETTINGS_CSS。
		*     沿用目的是让两个插件共享同一套外部表现语言。
		* 改动：类名由 `dsm-trae-*` 改为 `dsm-workbuddy-*`；
		*   移除 trae 特有的 1M 变体样式，新增按套餐聚合的积分行样式；
		*   双 provider 化后新增国内版/国际版 tab 栏样式。
		*
		* @module dsh-connect-workbuddy/client/styles
		*/
		const WORKBUDDY_CARD_CSS = `
.dsm-plugin-card{border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}
.dsm-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-open{background:var(--dsw-alias-bg-layer-2,#25262b);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dsm-plugin-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-plugin-card-head{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.dsm-plugin-card-title{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:15px;font-weight:600;line-height:1.4}
.dsm-plugin-card-description{color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5}
/* Pure-CSS caret: the host primitives' chevron icon names differ per DSH line
   (0.1.5 Outline14 vs 0.1.7 OutlineRegular), so no static import can serve
   both. A border caret in the plugin's own CSS is version-proof. */
.dsm-plugin-card-chevron{color:var(--dsw-alias-label-tertiary,#999);flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.dsm-plugin-card-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.dsm-plugin-card-chevron-open{transform:rotate(180deg)}
.dsm-plugin-card-body{border-top:1px solid var(--dsw-alias-border-l2,#36373b);margin:0 16px;padding:0 0 8px}
.dsm-plugin-card-icon{width:32px;height:32px;flex:none;border-radius:7px}
.dsm-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}
.dsm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-btn:disabled{opacity:.4;cursor:default}
.dsm-btn-outline{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent;font-weight:500}
.dsm-btn-outline:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:rgba(255,255,255,.04)}
.dsm-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsm-btn-primary:hover:not(:disabled){opacity:.9}
.dsm-workbuddy-usage{display:flex;flex-direction:column;gap:16px;margin:0;padding:16px 0 4px}
.dsm-workbuddy-tabs{display:flex;gap:6px;padding:4px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-workbuddy-tab{appearance:none;font:inherit;cursor:pointer;flex:1;border:0;border-radius:7px;padding:7px 10px;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:500;line-height:18px;background:transparent;transition:color .15s,background .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsm-workbuddy-tab:hover:not(:disabled):not(.dsm-workbuddy-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-workbuddy-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-workbuddy-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,#232529);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,#3a3d45)}
.dsm-workbuddy-tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:baseline}
.dsm-workbuddy-tab-cell{display:flex;align-items:center;gap:2px;flex:1;min-width:0}
.dsm-workbuddy-tab-switch{display:inline-flex;align-items:center;flex:none;padding:0 8px 0 2px;cursor:pointer}
.dsm-workbuddy-tab-switch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-tab-switch input:disabled{opacity:.4;cursor:default}
/* One sidebar-credit switch, belonging to the ACTIVE tab's region. It rides in
   the account-pool heading row (dsm-workbuddy-pool-head-extra) so one
   checkbox no longer costs a full line of vertical space; the tab bar already
   says which region is in scope, so it still reads as this tab's property
   rather than as a shared pair of settings. No vertical margin: the heading row
   owns the spacing. */
.dsm-workbuddy-credits-switch{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* The standalone fallback site: used only when the account-pool section did not
   render (no Host pool state), so there is no heading row to share. This is the
   spacing the control carried before it moved beside that heading. */
.dsm-workbuddy-credits-switch-row{display:flex;align-items:center;margin:8px 0 2px}
/* The credit readout's seat picker (issue #62). Narrower than the pool's model
   select so the show/hide box and this control share one heading row, and it
   wraps onto its own line rather than squashing the pool title. */
/* Its OWN label class, deliberately not the switch's: a query for "the
   sidebar-credit switch" must not be able to pick this control up, and the two
   are different widgets (a checkbox and a two-way picker). */
/* The supplement to the host's fixed quota sentence (issue #63). The plugin no
   longer claims the host's shell.quota-notice chain seat, so this no longer
   paints into shell.overlay — that seat is the reason the previous build's
   inline span parked at the overlay's TOP-LEFT as a box the maintainer had
   never seen before. It is kept inline and box-free for the surface that
   renders it INSIDE a line of conversation: the moment it paints a box it stops
   being a parenthetical and becomes the dialog that was already rejected once.
   The body is one step quieter than the text it follows. */
.dsm-workbuddy-quota-notice{display:inline}
.dsm-workbuddy-quota-notice-body{color:var(--dsw-alias-label-tertiary,#8b8f98);font-size:12px}
.dsm-workbuddy-credit-position-switch{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-credit-position{max-width:150px;padding:2px 6px;font-size:12px}
.dsm-workbuddy-credits-switch-row .dsm-workbuddy-credit-position-switch{margin-left:12px}
.dsm-workbuddy-credits-switch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-credits-switch input:disabled{opacity:.4;cursor:default}
.dsm-workbuddy-tab-off{opacity:.55}
/* Re-detection keeps a copy in the signed-out branch (that branch is where
   "I just signed in over there" applies), so it needs its own placement: the
   pool block's rule cannot reach it. */
.dsm-workbuddy-usage-account-actions{display:flex;gap:8px;margin:10px 0 0}
.dsm-workbuddy-tab-off-notice{color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px;margin:0 0 4px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:8px}
.dsm-workbuddy-usage-hint{padding-left:19px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
.dsm-workbuddy-account-error{color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;line-height:18px;white-space:pre-line}
.dsm-workbuddy-usage-select-wrap{position:relative}
.dsm-workbuddy-usage-select{appearance:none;width:100%;font:inherit;padding:10px 34px 10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-3,#2a2c33);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.dsm-workbuddy-usage-select:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary,#5686fe);box-shadow:0 0 0 3px rgba(86,134,254,.22)}
.dsm-workbuddy-usage-select:disabled{opacity:.6;cursor:default}
.dsm-workbuddy-usage-select-wrap::after{content:"";position:absolute;top:50%;right:12px;width:7px;height:7px;transform:translateY(-65%) rotate(45deg);border-right:1.6px solid var(--dsw-alias-label-secondary,#c6c9d0);border-bottom:1.6px solid var(--dsw-alias-label-secondary,#c6c9d0);pointer-events:none}
.dsm-workbuddy-usage-text{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary,#b8b8b8)}
.dsm-workbuddy-searched{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-searched>summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#b8b8b8);user-select:none}
.dsm-workbuddy-searched-hint{margin:6px 0 4px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-searched-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.dsm-workbuddy-searched-list li{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-workbuddy-searched-list code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8);word-break:break-all}
.dsm-workbuddy-searched-reason{color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
.dsm-workbuddy-searched-reason-encrypted{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-searched-reason-wrong-region{color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-searched-more{margin-top:6px;padding:0;border:0;background:none;color:var(--dsw-alias-brand-primary,#5686fe);font:inherit;font-size:12px;line-height:18px;cursor:pointer;text-align:left}
.dsm-workbuddy-searched-more:hover{text-decoration:underline}
.dsm-workbuddy-usage-error{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-workbuddy-usage-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.dsm-workbuddy-models{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:14px}
.dsm-workbuddy-models-fold{display:flex;flex-direction:column;gap:10px}
/* A plain header now: the section does not fold, so it is neither clickable nor
   focusable, and the list-marker rules that hid the native <details> triangle are
   gone with it. */
.dsm-workbuddy-models-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsm-workbuddy-models-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.dsm-workbuddy-models-title{margin:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;font-weight:600;line-height:20px}
/* Unsaved-changes marker. It sits in the HEADER rather than beside the save
   buttons at the foot of the list, so a pending edit is visible without
   scrolling to the end of a long model list. */
.dsm-workbuddy-models-dirty{margin-left:8px;padding:1px 6px;border-radius:6px;background:var(--dsw-alias-state-warn-primary,#f59e0b);color:#1b1d22;font-size:11px;font-weight:600;line-height:16px;vertical-align:1px;white-space:nowrap}
.dsm-workbuddy-models-summary{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* The free-model quota warning (see the tabFreeQuotaWarn locale key). Bold on
   purpose, and it keeps the summary's own grey rather than the primary label
   colour: it has to stand out from the three lines around it WITHOUT reading as
   an error banner, because the fact it states is normal product behaviour
   rather than a failure. Weight is the only signal it needs. */
.dsm-workbuddy-free-quota-warn{font-weight:600}
.dsm-workbuddy-model-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden}
.dsm-workbuddy-model{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#232529);transition:opacity .16s}
.dsm-workbuddy-model-disabled{opacity:.55}
.dsm-workbuddy-model+.dsm-workbuddy-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-workbuddy-model-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-workbuddy-model-enabled{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;flex:1}
.dsm-workbuddy-model-enabled input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe);flex:none}
.dsm-workbuddy-model-image{display:inline-flex;align-items:center;gap:5px;flex:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-workbuddy-model-image input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-model-off{display:inline-flex;align-items:center;gap:5px;flex:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-workbuddy-model-off input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-model-copy{display:flex;align-items:baseline;gap:8px;min-width:0}
.dsm-workbuddy-model-name{display:inline-flex;align-items:baseline;gap:7px;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;font-weight:500;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-workbuddy-model-name-rate{color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:400;line-height:16px;flex:none}
.dsm-workbuddy-model-id{color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-workbuddy-model-desc{margin:0;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
.dsm-workbuddy-model-details{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-workbuddy-model-meta{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
.dsm-workbuddy-model-meta-tag{padding:1px 7px;border-radius:999px;font-size:11px;line-height:15px;background:rgba(174,179,187,.11);color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-context-budget{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none;margin:0;padding:0;border:0;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-workbuddy-context-budget label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dsm-workbuddy-context-budget input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-model-capability-note{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* Model probe (test button + result). The result line is its own row under the
   meta line, because a cooldown sentence ("rate limited - the upstream gave no
   time") does not fit next to the context/output chips, and truncating it would
   hide exactly the part the user needs. */
/* Three buttons now live here (refresh + the two sweeps), and the sweep labels are
   long in Chinese (一键测试所有模型). flex:none alone let the group run past the
   header on a narrow card, so the group may WRAP and each label refuses to break
   mid-word — the same failure the pool row's action buttons had. */
.dsm-workbuddy-models-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dsm-workbuddy-models-head-actions .dsm-btn{white-space:nowrap}
/* The sweep buttons keep the outline weight of the refresh button beside them, so
   the header reads as one group of equal actions. */
.dsm-workbuddy-models-sweep{white-space:nowrap}
.dsm-workbuddy-models-sweep-summary{margin:6px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-model-probe{flex:none;padding:3px 10px;font-size:11px;line-height:16px}
.dsm-workbuddy-model-probe-result{margin:0;font-size:12px;line-height:18px;word-break:break-word}
.dsm-workbuddy-model-probe-result-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-workbuddy-model-probe-result-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-model-probe-result-bad{color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-workbuddy-model-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-workbuddy-model-save-error{flex:1;min-width:0;color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;line-height:16px;text-align:right}
.dsm-workbuddy-model-actions-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-workbuddy-usage-cheer{display:inline-flex;align-items:center;gap:4px;flex:none;text-decoration:underline;text-underline-offset:2px;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5;transition:color .16s}
.dsm-workbuddy-usage-cheer-star{font-size:12px;line-height:1;display:inline-flex}
.dsm-workbuddy-usage-cheer:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-workbuddy-usage-cheer:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:2px}

/* ---- Account pool ---- */
.dsm-workbuddy-pool{display:flex;flex-direction:column;gap:12px;margin:0;padding:16px 0 4px;border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* Title, then the inline extra (the sidebar-credit switch), then the
   serving-account badge on the far edge. The badge is pushed right with
   margin-left:auto rather than the row using space-between: with three
   children the latter would strand the switch in the middle instead of binding
   it to the title, and with only two (no switch) margin-left:auto keeps the
   badge on the right edge exactly as before. */
.dsm-workbuddy-pool-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsm-workbuddy-pool-head-extra{display:inline-flex;align-items:center}
.dsm-workbuddy-pool-current-badge{margin-left:auto;padding:2px 10px;border-radius:999px;background:rgba(86,134,254,.16);color:var(--dsw-alias-brand-primary,#5686fe);font-size:12px;font-weight:600;line-height:18px;white-space:nowrap}
/* Sits under the header block, before the batch buttons: account discovery is
   the first step of using the pool, so it reads above the actions it enables. */
/* Manual-mode account picker: shares the settings row layout (.pool-set), and
   only the select itself needs a hint that it is a PICKER of accounts rather
   than of models — the two sit near each other and used to be indistinguishable
   to a selector query as well as to the eye. */
.dsm-workbuddy-pool-account-select{min-width:200px}
.dsm-workbuddy-pool-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-workbuddy-pool-badge{flex:none;padding:2px 9px;border-radius:999px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.12);border:1px solid rgba(86,134,254,.32)}
/* One row, two clusters: LEFT acts on the accounts you checked, RIGHT re-reads
   which accounts exist. Before this the rescan button was on its own row pushed
   right while the batch buttons were on the next row pushed left — two
   alignments two lines apart, with nothing explaining the split. */
.dsm-workbuddy-pool-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-workbuddy-pool-actions-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-workbuddy-pool-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-pool-note{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-pool-warn{margin:0;padding:9px 11px;border-radius:9px;font-size:12px;line-height:17px;color:var(--dsw-alias-state-warn-primary,#f59e0b);background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.3)}
/* Ghost members (issue #60): the warning plus one removable chip per id. The
   chips are what make the warning actionable — a ghost has no row in the table
   above, because that roster is the sign-ins this machine still has. */
.dsm-workbuddy-pool-ghosts{display:flex;flex-direction:column;gap:6px}
.dsm-workbuddy-pool-ghost-list{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.dsm-workbuddy-pool-ghost{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 9px;border-radius:999px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#f59e0b);background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.3)}
.dsm-workbuddy-pool-ghost-name{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-workbuddy-pool-ghost-remove{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;font-size:11px;line-height:1;cursor:pointer;color:inherit;background:transparent}
.dsm-workbuddy-pool-ghost-remove:hover:not(:disabled){background:rgba(245,158,11,.2)}
.dsm-workbuddy-pool-ghost-remove:disabled{cursor:default;opacity:.5}
.dsm-workbuddy-pool-error{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#ef4444);white-space:pre-line}
.dsm-workbuddy-pool-table{border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-workbuddy-pool-row{display:grid;grid-template-columns:1.6fr 1fr 1.3fr .9fr .8fr;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:13px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* No check-in column (the international region): the freed track goes to the actions. */
.dsm-workbuddy-pool-table:not(.dsm-workbuddy-pool-table-checkin) .dsm-workbuddy-pool-row{grid-template-columns:1.6fr 1fr 1.3fr 1.7fr}
.dsm-workbuddy-pool-row:first-child{border-top:0}
.dsm-workbuddy-pool-row-head{padding:8px 14px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.dsm-workbuddy-pool-row-current{background:rgba(86,134,254,.07)}
/* The serving row, made findable at a glance: a left accent bar plus the tint.
   The bar is what distinguishes it in a long table, where a 7%-opacity wash
   alone reads as an alternating-row stripe. */
.dsm-workbuddy-pool-row-current{box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-pool-account{display:flex;align-items:center;gap:8px;min-width:0}
.dsm-workbuddy-pool-account-name{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-workbuddy-pool-account-name b{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-workbuddy-pool-account-name span{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}
/* Declared AFTER the blanket span rule so it wins: the badge must not inherit
   the muted 11px tertiary treatment the membership line uses. */
.dsm-workbuddy-pool-account-name .dsm-workbuddy-pool-current-tag{align-self:flex-start;margin-top:2px;padding:1px 6px;border-radius:999px;background:rgba(86,134,254,.16);color:var(--dsw-alias-brand-primary,#5686fe);font-size:11px;font-weight:600;line-height:16px;white-space:nowrap}
.dsm-workbuddy-pool-excluded{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-credits{display:flex;flex-direction:column;gap:1px;min-width:0;font-variant-numeric:tabular-nums}
.dsm-workbuddy-pool-credits b{color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-workbuddy-pool-soon{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-soon-plain{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-pool-probe,.dsm-workbuddy-pool-checkin{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#999);min-width:0;overflow-wrap:anywhere}
.dsm-workbuddy-pool-probe{display:flex;flex-direction:column;gap:4px}
.dsm-workbuddy-pool-probe-main{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-pool-probe-prov{display:flex;align-items:center;gap:5px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#999);min-width:0;flex-wrap:wrap}
.dsm-workbuddy-pool-prov-tag{padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:10px;font-weight:600;line-height:15px;white-space:nowrap}
.dsm-workbuddy-pool-prov-live{background:rgba(245,158,11,.16);color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-prov-unknown{background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l1,#2c2d31);color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-pool-prov-sep{color:var(--dsw-alias-label-dimmed,#9aa0a6);opacity:.7}
.dsm-workbuddy-pool-prov-age{color:var(--dsw-alias-label-tertiary,#999);white-space:nowrap}
/* WHICH model a verdict is about (issue #61). Deliberately quiet: it is scope
   information on the provenance line, not a status of its own, so an ok row and
   a rate-limited row must not look different because of it. */
.dsm-workbuddy-pool-prov-model{color:var(--dsw-alias-label-tertiary,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.dsm-workbuddy-pool-members{display:flex;flex-direction:column;gap:10px}
.dsm-workbuddy-pool-members-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dsm-workbuddy-pool-members-title{margin:0 0 3px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-workbuddy-pool-members-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-workbuddy-pool-small-btn{padding:3px 10px;font-size:12px}
.dsm-workbuddy-pool-check{display:inline-flex;align-items:center;flex:none;cursor:pointer}
.dsm-workbuddy-pool-check input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-pool-check input:disabled{cursor:default;opacity:.5}
.dsm-workbuddy-pool-checked{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-workbuddy-pool-unknown{color:var(--dsw-alias-label-dimmed,#9aa0a6)}
.dsm-workbuddy-pool-member{color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-pool-not-member{color:var(--dsw-alias-label-dimmed,#9aa0a6)}
.dsm-workbuddy-pool-settings-wrap{display:flex;flex-direction:column;gap:10px}
.dsm-workbuddy-pool-dirty{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-settings{display:flex;flex-direction:column;gap:1px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
/* QR sign-in + export/import, hosted inside the pool settings block.
   The block's own bordered rows belong to the SAVED preferences, so these
   get their own container: same rhythm (12px 14px) so the two read as one
   group, but a dashed edge marking them as immediate actions rather than
   drafts the Save button below would commit. */
.dsm-workbuddy-pool-tools{display:flex;flex-direction:column;gap:2px;border:1px dashed var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;padding:4px 10px}
.dsm-workbuddy-pool-set{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 14px;border-top:1px solid var(--dsw-alias-border-l1,#2c2d31)}
.dsm-workbuddy-pool-set:first-child{border-top:0}
.dsm-workbuddy-pool-set-copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dsm-workbuddy-pool-set-copy b{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-workbuddy-pool-set-copy span{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-pool-set-ctl{flex:none;display:flex;align-items:center;gap:8px}
.dsm-workbuddy-pool-num{width:74px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:13px;text-align:center;font-variant-numeric:tabular-nums}
.dsm-workbuddy-pool-select{max-width:260px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:13px;cursor:pointer}
.dsm-workbuddy-pool-select:disabled,.dsm-workbuddy-pool-num:disabled{opacity:.5;cursor:default}
.dsm-workbuddy-pool-save-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-workbuddy-pool-save-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none}
.dsm-workbuddy-pool-conflict{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 13px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-pending{flex:none;align-self:center;font-size:12px;line-height:17px;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-conflict-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dsm-workbuddy-pool-conflict-main b{font-size:12px;font-weight:600;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-conflict-main span{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-pool-log{border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-workbuddy-pool-log-head{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:var(--dsw-alias-bg-layer-3,#2a2c33);border-bottom:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-pool-log-clear{padding:2px 10px;font-size:12px}
.dsm-workbuddy-pool-log-body{max-height:186px;overflow-y:auto}
.dsm-workbuddy-pool-log-row{display:flex;gap:10px;padding:7px 14px;border-top:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:12px;line-height:18px}
.dsm-workbuddy-pool-log-row:first-child{border-top:0}
.dsm-workbuddy-pool-log-time{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dsm-workbuddy-pool-log-text{min-width:0;overflow-wrap:anywhere}
.dsm-workbuddy-pool-log-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-workbuddy-pool-log-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-workbuddy-pool-log-error{color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-workbuddy-pool-log-info{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-pool-log-empty{padding:14px;font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}
/* Per-row actions (test / remove), right side of each pool row. */
/* Per-row actions (test / remove), right side of each pool row.
   The nowrap is NOT cosmetic: a two-character label (测试) belongs on one line,
   and this row's track is a fraction of the table — in a narrow window it let
   the label break into 测 / 试. Clipping is the right failure for a button
   whose label is fixed and tiny. */
.dsm-workbuddy-pool-row-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex:none}
.dsm-workbuddy-pool-row-actions .dsm-workbuddy-pool-small-btn{white-space:nowrap}
.dsm-workbuddy-pool-row-actions .dsm-workbuddy-pool-small-btn{padding:2px 10px;font-size:12px}
/* This account's own test model (issue #61). Narrower than the section-level
   picker so a long model name cannot push the two buttons out of the row. */
@media (max-width:760px){.dsm-workbuddy-pool-row{grid-template-columns:1fr 1fr;row-gap:6px}.dsm-workbuddy-pool-select{max-width:180px}}
/* Pool switch, namespaced under .dsm-workbuddy-pool so it cannot collide with host styles. */
.dsm-workbuddy-pool .sw{position:relative;display:inline-block;width:38px;height:22px;flex:none;cursor:pointer}
.dsm-workbuddy-pool .sw input{position:absolute;opacity:0;width:0;height:0}
.dsm-workbuddy-pool .sw-track{position:absolute;inset:0;border-radius:999px;background:var(--dsw-alias-border-l2,#3a3d45);transition:background .18s}
.dsm-workbuddy-pool .sw-track::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.dsm-workbuddy-pool .sw input:checked+.sw-track{background:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-workbuddy-pool .sw input:checked+.sw-track::after{transform:translateX(16px)}
.dsm-workbuddy-pool .sw input:disabled+.sw-track{opacity:.4}
.dsm-workbuddy-pool .sw input:disabled{cursor:default}
/* Account action bars: QR sign-in and export/import.
   One row each — label, live status, actions — instead of a padded block
   per feature. The bar is the resting height; only an open dialog (below)
   grows vertically, so the card does not scroll past a wall of chrome to
   reach the buttons. Status text shares the row rather than claiming its own,
   and is what truncates first when the card is narrow. */
.dsm-workbuddy-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;padding:0}
.dsm-workbuddy-bar-label{flex:none;margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-workbuddy-bar-status{flex:1 1 auto;min-width:0;margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e8e9ed);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-workbuddy-bar-hint{color:var(--dsw-alias-label-tertiary,#999)}
.dsm-workbuddy-bar-actions{display:flex;gap:8px;flex:none;margin-left:auto}
.dsm-workbuddy-bar a{color:var(--dsw-alias-brand-primary,#5686fe);text-decoration:none}
.dsm-workbuddy-bar a:hover{text-decoration:underline}
.dsm-workbuddy-bar-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-workbuddy-bar-error{color:var(--dsw-alias-state-error-primary,#ef4444)}
/* Secondary text inside the transfer DIALOG (not a bar): the privacy note
   shown when credentials leave the machine. Kept independent of the bar
   classes so the dialog does not depend on the bar's layout to be readable. */
.dsm-workbuddy-hint{color:var(--dsw-alias-label-tertiary,#999)}
/* The transfer dialog is deliberately a block: it holds a scrollable account
   list and per-entry checkboxes, which cannot live in a one-row bar. */
.dsm-workbuddy-transfer-dialog{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-secondary,transparent)}
.dsm-workbuddy-transfer-dialog p{margin:0 0 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e8e9ed)}
.dsm-workbuddy-transfer-dialog-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.dsm-workbuddy-transfer-list{list-style:none;margin:0 0 8px;padding:0;max-height:180px;overflow-y:auto}
.dsm-workbuddy-transfer-list label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary,#e8e9ed);cursor:pointer;padding:2px 0}
.dsm-workbuddy-transfer-list input[type="checkbox"]{flex:none}
.dsm-workbuddy-transfer input[type="file"]{font-size:12px;color:var(--dsw-alias-label-primary,#e8e9ed);margin-bottom:8px}
/* The import picker's input is driven by the 「import」 button, so it must not
   render as a visible field: hide it from layout AND from assistive tech (the
   button carries the accessible name). Not display:none alone — that also
   removes it from the tab order in some engines, which is fine here, but the
   clip-based form is the one that reliably keeps programmatic .click() working
   across browsers. */
.dsm-workbuddy-transfer-file{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
/* The sign-in URL inside the OAuth dialog: long https links must wrap rather
   than push the dialog wide — break-all, since URLs have no soft wrap points. */
.dsm-workbuddy-oauth-url{word-break:break-all;overflow-wrap:anywhere}
.dsm-workbuddy-oauth-url a{color:var(--dsw-alias-brand-primary,#5686fe);text-decoration:none}
.dsm-workbuddy-oauth-url a:hover{text-decoration:underline}
/* The shared busy veil: a fixed overlay for operations whose result only shows
   up after the list re-read (remove / import / sign-in).
   It is NOT a modal: no control, no dismissal — only "this is running" and
   "here is why nothing moved yet". Fixed positioning so it covers the card
   regardless of which section started the operation, and a semi-transparent
   backdrop so the table stays visible underneath — the user is watching a
   specific row change, and hiding it would defeat the point.

   The mask and the card surface are the HOST's own tokens, not this file's
   invention. --dsw-alias-bg-mask-1 + --dsw-mask-blur is exactly what the
   host's own overlays use (see dsh-client-ui-settings-general's Dws9Sa_mask),
   so the veil now dims the way every other overlay in the shell does instead
   of laying its own black wash on top. The previous hardcoded rgba(0,0,0,.38)
   was tuned against neither theme: too weak next to the host's .24 mask in
   light mode, and it ignored the host's blur entirely.

   bg-layer-2 (not bg-primary, which does not exist in the host's token set
   at all and therefore always fell through to this file's near-black #1b1c20)
   is the same surface the host puts behind its panels — that near-black fallback
   is what made the veil read as a black slab with unreadable text on it. */
.dsm-workbuddy-veil{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32));backdrop-filter:var(--dsw-mask-blur);cursor:progress}
/* --dsw-elevation-prominent is the host's own panel shadow (a hairline stroke
   plus two soft layers); the previous 0 8px 28px rgba(0,0,0,.35) was a
   hand-rolled drop shadow that read as a heavy grey box. */
.dsm-workbuddy-veil-card{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(340px,80vw);padding:16px 20px;border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.35))}
.dsm-workbuddy-veil-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#0f1115);text-align:center}
/* label-secondary, not label-tertiary: this line carries the operation's
   detail and must stay legible. tertiary is the host's dimmest tier
   (neutral-bluish-600 on light, neutral-bluish-400 on dark) and is meant
   for metadata, not for a sentence the user has to read while waiting. */
.dsm-workbuddy-veil-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center}
/* The spinner proves the UI is alive when the row under it has not changed yet
   — which is precisely the confusion the veil exists to remove. It follows the
   host's own state spinner (dsh's _dsh-state-dot-spin): an SVG arc whose
   dash breathes while it turns, currentColor so it inherits the tier it sits
   in, and the same 1.5s beat. The previous 18px border-ring at .7s was roughly
   twice the host's speed and visibly out of step with every other spinner in
   the shell — that mismatch, more than the shape itself, is what made it look
   cheap.

   Reduced-motion users get the static arc rather than a frozen ring, matching
   how the host degrades its own spinner. */
.dsm-workbuddy-veil-spinner{width:20px;height:20px;color:var(--dsw-alias-label-secondary,#61666b);animation:dsm-workbuddy-veil-spin 1.5s linear infinite}
.dsm-workbuddy-veil-spinner-track{opacity:.25}
.dsm-workbuddy-veil-spinner-arc{stroke-dasharray:12 150;animation:dsm-workbuddy-veil-dash 1.5s ease-in-out infinite}
@keyframes dsm-workbuddy-veil-spin{to{transform:rotate(360deg)}}
@keyframes dsm-workbuddy-veil-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.dsm-workbuddy-veil-spinner{animation:none}.dsm-workbuddy-veil-spinner-arc{animation:none;stroke-dasharray:18 150;stroke-dashoffset:-3}}
`;
		/**
		* Composer credit readout styles, injected by the readout component itself.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `COMPOSER_POINTS_CSS`，类名改为 `dsm-workbuddy-*`，
		*     其余（尺寸、节奏、主题变量与回退值、表格对齐）逐条沿用。
		*
		* Separate from the card bundle because the readout lives in the session's
		* composer, not inside the plugin card; a card that is closed still shows this,
		* and on some hosts the card is never mounted at all.
		*/
		const WORKBUDDY_COMPOSER_CSS = `
/* The readout is plain composer text — no border, no fill at rest. The padding
   is only the click target, invisible until the pointer arrives. */
.dsm-workbuddy-composer-credits{display:inline-flex;align-items:center;min-width:0}
.dsm-workbuddy-composer-credits-trigger{
  appearance:none;display:inline-flex;align-items:center;align-self:stretch;
  padding:2px 6px;border:0;border-radius:6px;background:transparent;
  /* EXPLICIT, not inherit. The composer row's own font and body colour are
     noticeably larger and darker than the neighbouring controls — a credit
     readout is secondary information and must not shout. 12px matches this
     plugin's original line; label-tertiary matches the shell's own composer-row
     control (ContextMeter), which is the sibling this reads alongside. */
  font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-tertiary,#999);
  white-space:nowrap;cursor:pointer;
  font-variant-numeric:tabular-nums;
}
.dsm-workbuddy-composer-credits-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-workbuddy-composer-credits-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* The panel is portaled to document.body and positioned from the trigger, so it
   MUST be fixed — otherwise the left/top it measures are ignored and it lands in
   document flow. All material comes from shell tokens so it follows the theme. */
.dsm-workbuddy-composer-panel{
  position:fixed;z-index:1100;box-sizing:border-box;
  width:min(248px,calc(100vw - 24px));padding:12px;
  border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));
  border-radius:var(--dsw-radius-lg,14px);
  background:var(--dsw-specific-menu,Canvas);
  box-shadow:var(--dsw-elevation-prominent,0 8px 32px rgba(0,0,0,.22));
  backdrop-filter:var(--dsw-menu-backdrop-filter,none);
  font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#444);
}
.dsm-workbuddy-composer-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.dsm-workbuddy-composer-panel-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
/* Self-contained: the dsm-btn primitive lives in TRAE_CARD_CSS, which the
   composer never loads, so the refresh button must style itself. */
.dsm-workbuddy-composer-panel-refresh{
  appearance:none;flex:none;margin-left:auto;padding:3px 10px;
  border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.34));
  border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-secondary,#444);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
}
.dsm-workbuddy-composer-panel-refresh:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed,rgba(127,127,127,.6));color:var(--dsw-alias-label-primary,CanvasText)}
.dsm-workbuddy-composer-panel-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-workbuddy-composer-panel-refresh:disabled{opacity:.5;cursor:default}
/* The panel is a TABLE: one row per account in the region, one figure (the
   general balance) per row, and a row click switches accounts.

   Rhythm is deliberate: the header sits on a hairline, the switch button owns
   ALL horizontal padding (and pulls back by the same amount so its label lines
   up with the header), and every row is the same height. A misaligned first
   column is what makes a two-column popover read as broken. */
.dsm-workbuddy-composer-panel-table{
  width:100%;border-collapse:collapse;
  font-size:12px;line-height:18px;
}
.dsm-workbuddy-composer-panel-table thead th{
  padding:0 0 7px;font-weight:500;text-align:left;font-size:11px;
  color:var(--dsw-alias-label-tertiary,GrayText);
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
}
.dsm-workbuddy-composer-panel-num{
  text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
.dsm-workbuddy-composer-panel-table thead th.dsm-workbuddy-composer-panel-num{padding-right:0}
.dsm-workbuddy-composer-panel-table tbody th{
  padding:0;font-weight:400;text-align:left;vertical-align:middle;
}
.dsm-workbuddy-composer-panel-table tbody td{
  padding:4px 0;vertical-align:middle;
  color:var(--dsw-alias-label-primary,CanvasText);
}
/* The current account reads as current without shouting: a filled dot and a
   slightly heavier weight. Disabled — pressing it would write a selection that
   has not changed. */
.dsm-workbuddy-composer-panel-table tbody tr.dsm-workbuddy-composer-panel-row-current td{font-weight:600}
.dsm-workbuddy-composer-panel-switch{
  appearance:none;display:flex;align-items:center;gap:7px;
  width:100%;padding:4px 6px;margin-left:-6px;
  border:0;border-radius:6px;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;
  white-space:nowrap;overflow:hidden;
}
.dsm-workbuddy-composer-panel-switch>span:last-child{overflow:hidden;text-overflow:ellipsis}
/* The name + optional reason mark. A COLUMN so the mark drops onto its own line
   under the name: side by side they would stretch the name column and squeeze
   the numeric one, and the switch's own overflow rule would ellipsise the mark
   instead of the name. */
.dsm-workbuddy-composer-panel-who{display:flex;flex-direction:column;min-width:0;gap:1px}
.dsm-workbuddy-composer-panel-name{overflow:hidden;text-overflow:ellipsis}
/* Why the account cannot serve right now ("被限流"), in the warn colour the pool
   table uses for the same fact — so one measurement reads the same on both. */
.dsm-workbuddy-composer-panel-mark{
  font-size:11px;line-height:15px;
  color:var(--dsw-alias-state-warn-primary,#f59e0b);
}
/* Hover belongs to the switch, not the row: the number cell is not clickable,
   so lighting it up would promise an action it cannot perform. */
.dsm-workbuddy-composer-panel-switch:hover:not(:disabled){
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));
}
.dsm-workbuddy-composer-panel-switch:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px;
}
.dsm-workbuddy-composer-panel-switch:disabled{cursor:default}
.dsm-workbuddy-composer-panel-dot{
  flex:none;width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-label-dimmed,rgba(127,127,127,.5));
}
.dsm-workbuddy-composer-panel-table tr.dsm-workbuddy-composer-panel-row-current .dsm-workbuddy-composer-panel-dot{
  background:var(--dsw-state-success,#22a06b);
}
.dsm-workbuddy-composer-panel-foot{
  display:flex;justify-content:space-between;gap:8px;
  margin-top:9px;padding-top:7px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
  font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-workbuddy-composer-panel-empty{margin:0;color:var(--dsw-alias-label-tertiary,GrayText)}
.dsm-workbuddy-composer-panel-error{margin:8px 0 0;color:var(--dsw-alias-state-error-primary,#d92d20);font-size:11px;line-height:16px}
`;
		//#endregion
		//#region src/client/searched-paths.ts
		/**
		* Reasons that explain a failure, as opposed to merely recording an absence.
		*
		* `missing` is the normal state of most candidates on any machine — the app
		* writes one file while the platform offers several possible directories — so
		* it is the one reason that gets hidden by default. Everything else is a real
		* finding: the file is there and unreadable, present but not a credential, or
		* present and encrypted without a key.
		*
		* `encrypted` is WorkBuddy-specific and the most important of the three: the
		* user is very likely signed in already, and the plugin simply cannot open the
		* token fields without the desktop app present. "Sign in again" is the one
		* action that cannot help, so this reason must never be hidden behind a toggle.
		*
		* `wrong-region` is equally a finding and equally actionable: the sign-in is
		* real and readable, it just belongs to the other tab. That is why it must be
		* shown up front — hidden among the absences it would look like "nothing here",
		* when it is in fact the whole explanation, and the cheapest possible fix.
		*/
		const INTERESTING_REASONS = [
			"encrypted",
			"invalid",
			"unreadable",
			"wrong-region"
		];
		/**
		* Partition one region's probe failures for display.
		*
		* Order within each group is preserved from the Host: the store reports
		* candidates in probe order, which is meaningful (the live file before its
		* timestamped backups).
		*
		* There is deliberately no `encrypted` flag here. There used to be, for a
		* notice rendered inside the list; that notice is gone because
		* {@link signedOutNotice} now answers the encrypted cause in the paragraph, so
		* the flag would have had no consumer — and a derived field kept "just in
		* case" is how the list and the paragraph drift apart again.
		*/
		function searchedView(items) {
			const interesting = items.filter((item) => INTERESTING_REASONS.includes(item.reason));
			return {
				interesting,
				missing: items.filter((item) => !INTERESTING_REASONS.includes(item.reason)),
				missingOpen: interesting.length === 0,
				total: items.length
			};
		}
		/** Every reason's locale key, so no reason can silently fall through to a wrong one. */
		const REASON_KEYS = {
			missing: "row.reasonMissing",
			unreadable: "row.reasonUnreadable",
			invalid: "row.reasonInvalid",
			encrypted: "row.reasonEncrypted",
			"wrong-region": "row.reasonWrongRegion"
		};
		/** The reason's short label; `missing`/`unreadable`/`invalid`/`encrypted`/`wrong-region`. */
		function searchReasonKey(reason) {
			return REASON_KEYS[reason] ?? "row.reasonInvalid";
		}
		/**
		* One entry's cause line: which store the path belongs to, and why it failed.
		*
		* The source matters because the two are fixed differently — a desktop-app path
		* is about the app's installation and sign-in, a plugin-owned copy is about the
		* plugin's own storage.
		*/
		function searchReasonLabel(item, t) {
			return `${t(item.source === "desktop" ? "row.sourceDesktop" : "row.sourceDsh")} · ${t(searchReasonKey(item.reason))}`;
		}
		/**
		* Choose the signed-out paragraph's copy.
		*
		* This exists because the card was saying the same thing twice. `resolve()`
		* refuses with a message that already ENUMERATES every path it tried
		* (`expected <Local>\workbuddy-desktop.info or <Roaming>\... or
		* WORKBUDDY_AUTH_FILE`), and the probed-path `<details>` right below it listed
		* those same paths with a per-entry reason. Both hint keys also opened with a
		* variant of "no sign-in was found", so one screen carried four statements of
		* one fact and the user's eye had nowhere to land.
		*
		* The rule: the paragraph states the situation, the list supplies the detail.
		* Whenever a list is rendered, the enumeration in `message` is redundant by
		* construction — the list is the same paths, with strictly better reasons — so
		* the paragraph falls back to the concise hint. Measured against the real
		* `resolve()` branches, the only content this drops is "or refresh an existing
		* session", which is vacuous exactly here: `searched` is attached only when
		* there are zero accounts, so there is no session to refresh.
		*
		* `selectionLost` still wins outright: there the tokens are healthy and the
		* advice is to re-pick an account, which no path list can replace.
		*
		* `encrypted` also outranks the generic hint, and for the same reason
		* `wrong-region` does: the generic copy tells the user to sign in again, which
		* is precisely the action that cannot work when the credential exists but is
		* encrypted. Leaving it in the collapsed list meant the headline contradicted
		* the detail below it — and the headline is the only part most users read.
		*
		* `encrypted` outranks `wrong-region` as well, which is a change (issue #68):
		* the two are not alternatives, they co-occur, and when they do the unreadable
		* key is the blocker. See the note in {@link signedOutNotice}.
		*/
		function signedOutNotice(input) {
			if (input.selectionLost) return { key: "row.selectionLostMessage" };
			if (input.searched.some((item) => item.reason === "encrypted")) return { key: "row.signedOutEncrypted" };
			if (input.searched.some((item) => item.reason === "wrong-region")) return { key: "row.signedOutWrongRegion" };
			if (input.searched.length > 0) return { key: "row.signedOutHint" };
			return input.message === void 0 ? { key: "row.signedOutHint" } : {
				key: "row.signedOutHint",
				fallback: input.message
			};
		}
		/**
		* The paragraph's final text: the localized copy, plus the Host message only
		* when {@link signedOutNotice} decided nothing supersedes it.
		*
		* Kept here rather than inline in the JSX so the anti-duplication guarantee can
		* be asserted on the string that is actually rendered, not on its inputs.
		*/
		function signedOutText(notice, t) {
			const hint = t(notice.key);
			return notice.fallback === void 0 ? hint : `${hint} (${notice.fallback})`;
		}
		//#endregion
		//#region src/client/WorkBuddyCard.tsx
		/**
		* WorkBuddy credits & models card contributed to Harness Plugin configuration.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 卡片的整体结构（折叠外壳 / 账号状态行 / 账号下拉 / 积分区 / 模型表 /
		*     操作按钮行）、模块加载时注入一次 `<style>` 的写法、
		*     草稿态（draftModels/draftEnabledIds）与 dirty 标记的保存流程、
		*     60 秒轮询与 AbortController 清理，均来自该项目的 TraeUsageCard。
		*   折叠卡片外壳与 `settings.plugin.item` 槽位形态来自
		*   dingminhua/dsh-subagent-default-model（MIT）。
		* 改动：
		*   0. 折叠箭头改用纯 CSS caret（理由见 styles.ts）：两版宿主的图标命名族
		*      不同，静态导入必挂一边。此前沿用的 `IconChevronDownOutline14` 已
		*      随该改动移除，故不再计入上方参考项。
		*   1. 积分区改为「合计 + 按套餐名聚合的进度条」，因为实测单个账号下
		*      同名套餐可达 19 个，逐条渲染会淹没卡片（原项目按上游条目直出）；
		*   2. 模型行补上 WorkBuddy 上游给出的积分倍率、多模态与推理档位；
		*   3. 移除与 WorkBuddy 上游无关的 1M 变体勾选；
		*   4. 双 provider 化后卡片顶部为「国内版 / 国际版」tab 栏 —— 每个 tab
		*      是一个独立供应商（workbuddy / workbuddy-global），账号、积分、
		*      模型目录与草稿完全按区域隔离，切 tab 不丢另一侧未保存的草稿。
		*
		* @module dsh-connect-workbuddy/client/WorkBuddyCard
		*/
		const POLL_INTERVAL_MS = 6e4;
		/**
		* Tooltip for one model's image checkbox. The box is pre-checked only for
		* models the vendored vendor table documents as natively multimodal, so the
		* two other outcomes need to say WHY they are off — otherwise a documented
		* text-only model and an unverified one look identically broken next to their
		* checked siblings.
		*/
		function imageCheckboxHint(model, t) {
			switch (nativeModalityOf(model.id)) {
				case "multimodal": return t("row.modelImage");
				case "text": return t("row.modelImageText");
				default: return t("row.modelImageUnverified");
			}
		}
		/** Inject or refresh the shared card CSS for the current client bundle. */
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-workbuddy/client.css";
			const existing = document.querySelector(`style[data-plugin-css="${cssId}"]`);
			if (existing !== null) existing.textContent = WORKBUDDY_CARD_CSS;
			else {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-workbuddy";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = WORKBUDDY_CARD_CSS;
				document.head.appendChild(styleTag);
			}
		}
		/**
		* One probed path, with its cause. The presentation rules — which entries are
		* worth showing up front, and how a reason is labelled — live in
		* `./searched-paths.ts` so they are unit-testable without a DOM.
		*/
		function renderSearchedItem(item, t) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.path }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: `dsm-workbuddy-searched-reason${item.reason === "encrypted" ? " dsm-workbuddy-searched-reason-encrypted" : item.reason === "wrong-region" ? " dsm-workbuddy-searched-reason-wrong-region" : ""}`,
				children: [searchReasonLabel(item, t), item.message === void 0 ? null : ` · ${item.message}`]
			})] }, `${item.source}:${item.path}`);
		}
		/**
		* The probed-path list behind a signed-out card.
		*
		* Collapsed by default because it is a diagnostic, not a headline. The
		* interesting failures (encrypted / invalid / unreadable) are listed up front;
		* the merely-absent candidates — most of them, on any normal machine — sit
		* behind a second toggle, so the one entry that explains the failure is not
		* buried under a dozen "not found" lines. When nothing interesting was found
		* the absent list IS the explanation, so it opens directly.
		*
		* An `encrypted` failure deliberately adds NO notice of its own. It used to,
		* because the paragraph above still said "sign in once in the desktop app" —
		* the one action that cannot work when the credential exists but is encrypted.
		* `signedOutNotice` now answers that cause in the paragraph itself, so a second
		* copy here would restate it: the paragraph states the situation, this list
		* supplies the detail, and the per-entry label already says what each path is.
		*/
		function SearchedPaths({ items, t }) {
			const view = searchedView(items);
			const [explicitOpen, setExplicitOpen] = (0, react.useState)(void 0);
			const showMissing = explicitOpen ?? view.missingOpen;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dsm-workbuddy-searched",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
						t("row.searchedTitle"),
						" (",
						view.total,
						")"
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-workbuddy-searched-hint",
						children: t("row.searchedHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
						className: "dsm-workbuddy-searched-list",
						children: [view.interesting.map((item) => renderSearchedItem(item, t)), showMissing ? view.missing.map((item) => renderSearchedItem(item, t)) : null]
					}),
					showMissing || view.missing.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsm-workbuddy-searched-more",
						onClick: () => {
							setExplicitOpen(true);
						},
						children: t("row.searchedMore", { count: view.missing.length })
					})
				]
			});
		}
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0, {
				minimumFractionDigits: 0,
				maximumFractionDigits: 0
			}).format(value);
		}
		/**
		* Compact package-date rendering with time, e.g. `08/25 14:44`.
		*
		* `hourCycle: 'h23'` is what makes that example TRUE. Without it `Intl` defers
		* to the browser locale, and en-US produced `08/25, 02:44 PM` — 12-hour, with a
		* comma the template never asked for. `h23` (not `hour12: false`) keeps midnight
		* at `00:00` instead of `24:00`, and matches DSH's own clock cycle.
		*/
		function formatDate(value) {
			return new Intl.DateTimeFormat(void 0, {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			}).format(new Date(value));
		}
		function formatCapacity(value, unknown) {
			if (value === void 0) return unknown;
			if (value >= 1e6 && value % 1e6 === 0) return `${value / 1e6}M`;
			if (value >= 1e3 && value % 1e3 === 0) return `${value / 1e3}K`;
			return formatNumber(value);
		}
		function dotStyle(status) {
			return { background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #9aa0a6)" };
		}
		/**
		* The sentence a probe result gets, and how it should be coloured.
		*
		* The cooldown wording is the part that had to be got right. The upstream names
		* a "use again" time in three situations: a `Retry-After` header, the reset
		* sentence it writes into its own failure BODY (where this service actually
		* puts it — its 429s carry no rate-limit header at all), or an exhausted
		* monthly quota whose refresh point it declares. So a limited result WITHOUT
		* any stated time must say that plainly. Substituting a locally invented
		* countdown would be the single most misleading thing this feature could do: it
		* would look like an upstream answer while being a guess, and the user would
		* wait for a moment that means nothing.
		*/
		/**
		* ` · 约 1 小时后` for a future instant, or `''` when there is none.
		*
		* Kept beside {@link probeResultView} rather than inlined three times so the
		* "append only when non-empty" rule cannot drift between the two limited
		* outcomes. The absolute instant stays the primary text: it is the upstream's
		* own answer, and the relative form is a convenience derived from it.
		*/
		function retrySuffix(t, untilMs, nowMs) {
			if (untilMs === void 0) return "";
			const remaining = remainingText(t, untilMs, nowMs);
			return remaining === "" ? "" : ` · ${remaining}`;
		}
		function probeResultView(result, t, nowMs = Date.now()) {
			switch (result.outcome) {
				case "ok": {
					const elapsed = result.elapsedMs === void 0 ? void 0 : `${String(result.elapsedMs / 1e3)}s`;
					return {
						text: elapsed === void 0 ? t("row.probeOk") : t("row.probeOkMs", { ms: elapsed }),
						tone: "ok"
					};
				}
				case "rate-limited": return {
					text: result.retryAtMs === void 0 ? t("row.probeRateLimitedUnknown") : t("row.probeRateLimitedAt", { at: formatDate(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs),
					tone: "warn"
				};
				case "model-busy": return {
					text: result.retryAtMs === void 0 ? t("row.probeModelBusyUnknown") : t("row.probeModelBusyAt", { at: formatDate(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs),
					tone: "warn"
				};
				case "out-of-credit": return {
					text: result.retryAtMs === void 0 ? t("row.probeOutOfCreditUnknown") : t("row.probeOutOfCreditAt", { at: formatDate(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs),
					tone: "bad"
				};
				case "credential-rejected": return {
					text: t("row.probeCredentialRejected"),
					tone: "bad"
				};
				case "policy-rejected": return {
					text: t("row.probePolicyRejected"),
					tone: "bad"
				};
				case "not-found": return {
					text: t("row.probeNotFound"),
					tone: "bad"
				};
				case "unavailable": return {
					text: t("row.probeUnavailable"),
					tone: "bad"
				};
				default: return {
					text: result.status === void 0 ? t("row.probeFailed") : t("row.probeFailedStatus", { status: String(result.status) }),
					tone: "bad"
				};
			}
		}
		/** Render WorkBuddy sign-in state, credits, and model selection as one card. */
		function WorkBuddyCard({ t, settingsScope, view }) {
			if (t === void 0) throw new Error("WorkBuddy plugin card requires its translation function");
			const [open, setOpen] = (0, react.useState)(view === "page");
			/** The region whose tab is on screen; each tab is its own provider stack. */
			const [activeRegion, setActiveRegion] = (0, react.useState)("cn");
			/**
			* Last-known usage per region, so tab dots survive tab switches.
			*
			* The placeholder carries `selectionExplicit: false` because that is the
			* state the plugin documents as the default before any choice is saved. It
			* is never rendered: the account picker and its state line only appear once
			* a real fetch has populated `accounts`.
			*/
			const [statusByRegion, setStatusByRegion] = (0, react.useState)({
				cn: {
					status: "signed-out",
					accounts: [],
					selectionExplicit: false
				},
				global: {
					status: "signed-out",
					accounts: [],
					selectionExplicit: false
				}
			});
			const [busy, setBusy] = (0, react.useState)(false);
			const [settingsRevision, setSettingsRevision] = (0, react.useState)(0);
			/** Per-region unsaved model edits; a draft on one tab is never dropped by
			* switching to the other tab, only by that tab's discard/save. */
			const [drafts, setDrafts] = (0, react.useState)({});
			const [saving, setSaving] = (0, react.useState)(false);
			/** Save failure surfaced next to the buttons; cleared by the next attempt. */
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [switchingAccount, setSwitchingAccount] = (0, react.useState)(false);
			/**
			* Whether the account pool's save is in flight. Both sections write into one
			* region slot and the Host merges per-region, so two concurrent saves can
			* interleave on a stale base and revert each other while both report success
			* — the two save buttons are serialized to make that impossible.
			*/
			const [poolBusy, setPoolBusy] = (0, react.useState)(false);
			/** A refused account write (silently unpersisted settings on a locked file). */
			const [accountError, setAccountError] = (0, react.useState)(void 0);
			/** Region whose on/off checkbox write is in flight, so its box can't race. */
			const [togglingRegion, setTogglingRegion] = (0, react.useState)(void 0);
			/**
			* Region whose SIDEBAR-credit checkbox write is in flight.
			*
			* Tracked separately from {@link togglingRegion} because they are different
			* fields of the same region slot: one in-flight write must not disable the
			* other control, and both must stay serialized against the SAVE writers.
			*/
			const [togglingCredits, setTogglingCredits] = (0, react.useState)(void 0);
			/**
			* Probe results, keyed by region then model id.
			*
			* Kept per region for the same reason drafts are: the two tabs are separate
			* provider stacks, so a test run on one tab must not be clobbered — or shown —
			* as the other tab's answer.
			*/
			const [probes, setProbes] = (0, react.useState)({});
			/** Model ids with a probe in flight, so each row's button can disable itself. */
			const [probing, setProbing] = (0, react.useState)({});
			/** Probe failure that is not attributable to one model (a dead route, say). */
			const [probeError, setProbeError] = (0, react.useState)(void 0);
			/**
			* The active region's probe results, mirrored into a ref.
			*
			* The sweep loop reads each verdict as soon as it lands, and state read inside
			* an async loop is the value captured when the loop STARTED — so counting from
			* `probes` would tally the previous run's answers. The ref is updated in the
			* same place the state is, so the two cannot drift.
			*/
			const probesRef = (0, react.useRef)({});
			/** Progress of an in-flight sweep, or undefined when none is running. */
			const [sweeping, setSweeping] = (0, react.useState)(void 0);
			/** The last sweep's tally, cleared when the next one starts. */
			const [sweepSummary, setSweepSummary] = (0, react.useState)(void 0);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsRevision((value) => value + 1);
			}), [settingsScope]);
			/**
			* Per-region latest-wins guard for the usage fetch.
			*
			* Two refreshes can overlap — the 60s poll, a save, a batch action, the
			* account re-scan — and they are plain `fetch`es with no ordering guarantee.
			* Without a guard the SLOWER response wins, so a snapshot taken before a
			* check-in could land after one taken after it and overwrite the newer
			* credits. The guard makes "the last request started" the one that is applied,
			* whatever order the responses arrive in.
			*
			* Keyed by region, not global: the card deliberately fetches BOTH regions at
			* once (`for (const region of WORKBUDDY_REGIONS)` below), so a single shared
			* counter would make each of those two calls cancel the other and leave one
			* tab permanently stale.
			*
			* The rule itself is the tested `createLatestWins` factory, not a second
			* implementation written here.
			*
			* `begin()` returns a probe that reports **stale**: `true` once a newer call
			* has claimed the same region (see `src/account-pool.ts`). So the variable is
			* named `stale` and the bail-out is `if (stale())` — the same polarity as the
			* Host's rotation guard in `src/index.ts`. Naming it `fresh` and writing
			* `if (!fresh())` inverts the poll: every response that is NOT superseded —
			* i.e. every response in the single-fetch case — gets discarded, and the card
			* renders its placeholder forever. That defect shipped once; the polarity is
			* now pinned by a rendered assertion rather than by the spelling of the
			* identifier.
			*/
			const usageGuard = (0, react.useRef)(createLatestWins());
			const refreshUsage = (0, react.useCallback)(async (region, signal) => {
				const stale = usageGuard.current.begin(region);
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const usage = value;
					if (stale()) return void 0;
					if (mounted.current && signal?.aborted !== true) setStatusByRegion((prev) => ({
						...prev,
						[region]: usage
					}));
					return usage;
				} catch (error) {
					if (stale()) return void 0;
					if (mounted.current && signal?.aborted !== true) {
						const message = error instanceof Error ? error.message : t("row.requestFailed");
						setStatusByRegion((prev) => {
							const previous = prev[region];
							if (previous !== void 0 && previous.status === "signed-in") return {
								...prev,
								[region]: {
									...previous,
									refreshError: message
								}
							};
							return {
								...prev,
								[region]: {
									status: "error",
									message
								}
							};
						});
					}
					return;
				}
			}, [t]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const controller = new AbortController();
				for (const region of WORKBUDDY_REGIONS) refreshUsage(region, controller.signal);
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				refreshUsage
			]);
			const status = statusByRegion[activeRegion] ?? {
				status: "signed-out",
				accounts: [],
				selectionExplicit: false
			};
			/**
			* Whether the ACTIVE region knows of any account at all.
			*
			* This is the poll's precondition in place of `status === 'signed-in'`. The
			* signed-in flag means "a credential resolves", which is false for a region
			* whose accounts exist but none is usable yet — exactly the state an import
			* or a fresh OAuth sign-in creates. Polling on it meant those regions never
			* refreshed, so the list stayed empty until the card was reopened.
			*/
			const hasAccounts = status.status !== "error" && status.accounts.length > 0;
			(0, react.useEffect)(() => {
				if (!open || !hasAccounts) return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refreshUsage(activeRegion, controller.signal);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				refreshUsage,
				status.status
			]);
			/**
			* Re-detect the local sign-ins and refresh the panel.
			*
			* This deliberately writes NO account selection. It used to persist whatever
			* row the store reported as "selected" whenever that differed from the saved
			* value, which had two harmful effects: with no explicit choice it turned the
			* documented default (follow the app's current sign-in) into a permanent
			* explicit binding — so a later sign-in in the app was no longer followed —
			* and with an orphaned saved id it silently re-bound the region to a
			* different account, which is the silent switch that the strict
			* no-fallback rule exists to prevent. Re-detecting and re-picking are
			* separate actions now; the picker and Clear button own the selection.
			*/
			const rescanAccounts = async () => {
				setBusy(true);
				setAccountError(void 0);
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_ACCOUNTS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json();
					if (!response.ok || !Array.isArray(body.accounts)) throw new Error(`HTTP ${response.status}`);
					if (body.dismissalsCleared === false) setAccountError(t("row.rescanHidesKept"));
					await refreshUsage(activeRegion);
				} catch (error) {
					if (mounted.current) setAccountError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const switchAccount = async (accountId) => {
				if (settingsScope === void 0) return;
				setSwitchingAccount(true);
				setAccountError(void 0);
				try {
					await writeAccountSlot(settingsScope, activeRegion, accountId);
					await refreshUsage(activeRegion);
				} catch (error) {
					if (mounted.current) setAccountError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSwitchingAccount(false);
				}
			};
			/**
			* Whether one region's provider is switched on.
			*
			* The HOST's answer wins, because on this deployment it is the only writer
			* that lands: the switch goes through the plugin's Host save endpoint (that
			* endpoint is the only writer that cannot drop the sibling region), and a
			* write made there does NOT update the browser settings mirror. Reading the
			* mirror therefore left the checkbox stuck ON after a successful disable —
			* "不能正确取消国际版/国内版" — even though `enabled: false` was already in
			* the profile configuration. The Host sends the committed value it derives
			* from its own config (`status.enabled`, see `deps.regionEnabled`), so the
			* card renders that.
			*
			* The mirror stays as the FALLBACK: a host that predates the field, or a
			* status that has not loaded yet, still renders from the stored document
			* rather than guessing. Both rules are the same opt-out rule (only an
			* explicit `false` disables), so the two sources cannot disagree — only one
			* of them can be stale.
			*/
			const regionOn = (item) => {
				const fromHost = statusByRegion[item]?.enabled;
				if (typeof fromHost === "boolean") return fromHost;
				return regionEnabledOf(settingsScope?.getSnapshot().value, item);
			};
			const activeRegionOn = regionOn(activeRegion);
			/**
			* Whether one region's sidebar credit line is shown — for the ACTIVE tab.
			*
			* Prefers the Host's answer, exactly like {@link regionOn} and for the same
			* measured reason: on the affected 0.1.7 deployment the browser's settings
			* mirror never picks up this plugin's writes, so a checkbox reading the mirror
			* rendered its previous value after a successful save and looked impossible to
			* turn off ("关闭不了"). The Host is the authority; the mirror is only a
			* fallback for a Host line that predates the field.
			*/
			const creditsShownOn = (item) => {
				const fromHost = statusByRegion[item]?.showCreditsInMainUi;
				if (typeof fromHost === "boolean") return fromHost;
				return regionCreditsShownOf(settingsScope?.getSnapshot().value, item);
			};
			/**
			* Switch one region's provider off or on. The write carries the region's
			* whole slot through untouched — only `enabled` changes — so the user's
			* directory, model picks, image opt-ins and budgets survive a round trip.
			* The Host withdraws or restores the provider route on the next `onChange`,
			* which is what actually removes it from DSH's model picker.
			*
			* Goes through `writeRegionEnabled` rather than calling `scope.set()`
			* directly: on the affected 0.1.7 deployments that scope settles without
			* storing anything, so a direct write appeared to succeed and then silently
			* reverted. The helper adds the landed-check and the Host-endpoint fallback
			* that every other settings write already had.
			*/
			const toggleRegion = async (item, enabled) => {
				if (settingsScope === void 0) return;
				setTogglingRegion(item);
				try {
					const slot = nextRegionEnabled(settingsScope.getSnapshot().value, item, enabled)[item];
					await writeRegionEnabled(settingsScope, item, enabled, typeof slot === "object" && slot !== null ? slot : {});
					await refreshUsage(item);
				} catch (error) {
					if (mounted.current) setAccountError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setTogglingRegion(void 0);
				}
			};
			/**
			* Show or hide one region's sidebar credit line.
			*
			* This is the SECOND control for that line: the sidebar row also carries an
			* `×` that writes the same `regions.<region>.showCreditsInMainUi` flag, and
			* both go through the same landed-checked writer, so they can never disagree.
			* The checkbox stays because the sidebar is not always rendered (collapsed
			* rail, or a host that never mounts the footer slot).
			*
			* Writes the region's WHOLE slot — unchanged except for this one flag — so a
			* hide never drops the directory, model picks, budgets or pool preferences
			* that live alongside it.
			*/
			/**
			* WHERE the active region's credit readout sits (issue #62).
			*
			* Read off the Host's usage answer, like {@link creditsShownOn} and for the
			* same measured reason: the browser's settings mirror for this namespace is
			* documented as stale on the affected 0.1.7 deployments, so a control reading
			* it would keep showing the previous seat after a successful write. Absent
			* means `composer`, which is what the Host resolves for a profile written
			* before the setting existed.
			*/
			const creditPositionOn = (item) => {
				return statusByRegion[item]?.creditPosition === "stats" ? "stats" : "composer";
			};
			/**
			* Move one region's credit readout between its two seats.
			*
			* Same shape as {@link toggleCredits}: whole region slot in, landed check,
			* then a Host re-read. The re-read is load-bearing here for the same reason —
			* the control renders the Host's answer, so without it the picker keeps
			* showing the seat it had and the change looks like it did nothing.
			*/
			const changeCreditPosition = async (item, position) => {
				if (settingsScope === void 0) return;
				setTogglingCredits(item);
				try {
					const slot = nextRegionCreditPosition(settingsScope.getSnapshot().value, item, position)[item];
					await writeRegionCreditPosition(settingsScope, item, position, typeof slot === "object" && slot !== null ? slot : {});
					await refreshUsage(item);
				} catch (error) {
					if (mounted.current) setAccountError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setTogglingCredits(void 0);
				}
			};
			const toggleCredits = async (item, shown) => {
				if (settingsScope === void 0) return;
				setTogglingCredits(item);
				try {
					const slot = nextRegionCreditsShown(settingsScope.getSnapshot().value, item, shown)[item];
					await writeRegionCreditsShown(settingsScope, item, shown, typeof slot === "object" && slot !== null ? slot : {});
					await refreshUsage(item);
				} catch (error) {
					if (mounted.current) setAccountError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setTogglingCredits(void 0);
				}
			};
			const refreshModels = async () => {
				setBusy(true);
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_MODELS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json();
					if (!response.ok || !Array.isArray(body.models)) throw new Error(`HTTP ${response.status}`);
					const fresh = body.models;
					const freshIds = new Set(fresh.map((model) => model.id));
					const stillEnabled = [...activeEnabledIds].filter((id) => freshIds.has(id));
					const upstreamImages = fresh.filter((model) => imageDefaultFor(model)).map((model) => model.id);
					const stillBudgets = {};
					for (const id of freshIds) {
						const budget = activeContextBudgets[id];
						if (typeof budget === "number") stillBudgets[id] = budget;
					}
					setDrafts((prev) => ({
						...prev,
						[activeRegion]: {
							models: fresh,
							enabledIds: new Set(stillEnabled),
							imageIds: new Set(upstreamImages),
							offIds: new Set(activeOffIds),
							contextBudgets: stillBudgets
						}
					}));
				} catch (error) {
					if (mounted.current) setStatusByRegion((prev) => ({
						...prev,
						[activeRegion]: {
							...prev[activeRegion],
							status: "error",
							message: error instanceof Error ? error.message : t("row.requestFailed")
						}
					}));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const draft = drafts[activeRegion];
			const visibleModels = draft?.models ?? (status.status === "signed-in" ? status.models : []);
			const savedEnabledIds = status.status === "signed-in" ? new Set(status.enabledModelIds) : /* @__PURE__ */ new Set();
			const activeEnabledIds = draft?.enabledIds ?? savedEnabledIds;
			const savedImageIds = status.status === "signed-in" ? new Set(status.imageModelIds) : /* @__PURE__ */ new Set();
			const activeImageIds = draft?.imageIds ?? savedImageIds;
			const savedOffIds = status.status === "signed-in" ? new Set(status.offModelIds) : /* @__PURE__ */ new Set();
			const activeOffIds = draft?.offIds ?? savedOffIds;
			settingsScope?.getSnapshot().value;
			const savedContextBudgets = status.status === "signed-in" ? status.contextBudgets ?? {} : {};
			const activeContextBudgets = draft?.contextBudgets ?? savedContextBudgets;
			const dirty = draft !== void 0;
			/**
			* Whether the card's inputs accept edits.
			*
			* Deliberately NOT the settings scope's own `writable` flag: on the affected
			* DSH 0.1.7 deployment that flag stays false (the scope initialises it false
			* and only raises it once its mirror loads as a Host-backed form), which left
			* every input `disabled` — clicking them did nothing at all. Writes no longer
			* depend on that flag: `writeField` tries the scope and falls back to the
			* plugin's own Host endpoint, which performs the mutate in the Host process.
			* A bound scope is therefore all that is required to accept an edit.
			*/
			const canWrite = settingsScope !== void 0;
			const editDraft = (edit) => {
				setDrafts((prev) => ({
					...prev,
					[activeRegion]: edit(prev[activeRegion] ?? {
						models: [...visibleModels],
						enabledIds: new Set(activeEnabledIds),
						imageIds: new Set(activeImageIds),
						offIds: new Set(activeOffIds),
						contextBudgets: { ...activeContextBudgets }
					})
				}));
			};
			const toggleModel = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.enabledIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						enabledIds: next
					};
				});
			};
			const toggleImage = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.imageIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						imageIds: next
					};
				});
			};
			/**
			* Flip one row's `off` answer (issue #34).
			*
			* Writes an EXPLICIT answer in both directions, so the built-in rule is only
			* consulted while the user has no opinion. That is also why there is no
			* "reset" control: once an answer matches the rule, the two are
			* indistinguishable in effect, and the tooltip already names the override.
			*/
			const toggleOff = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.offIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						offIds: next
					};
				});
			};
			const setContextBudget = (modelId, budget) => {
				editDraft((current) => ({
					...current,
					contextBudgets: {
						...current.contextBudgets,
						[modelId]: budget
					}
				}));
			};
			const discardModels = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					delete next[activeRegion];
					return next;
				});
			};
			/**
			* Probe ONE model (the route refuses more than one — see `web-status.ts`,
			* where the cap is the gate that keeps a whole-roster sweep from becoming a
			* single unaccounted spend). The HOST owns the request: the browser half sends
			* only a model id and gets an outcome back, because the credential must never
			* cross to the page.
			*
			* The plural name is historical: this used to post a whole list in one request
			* before 3.0.0 removed the batch button. It is kept because callers that
			* already hold a list (the two sweep buttons below) can still express "test
			* these" without a second code path — it just sends them one at a time.
			*
			* Probing is deliberately independent of `dirty`: a test answers "does this
			* model work right now", which is true of the SAVED selection and the draft
			* alike, and blocking it on unsaved edits would make the button dead exactly
			* when the user is deciding what to keep.
			*/
			const probeModels = async (modelIds) => {
				if (modelIds.length === 0) return;
				setProbeError(void 0);
				setProbing((previous) => {
					const next = { ...previous };
					for (const id of modelIds) next[id] = true;
					return next;
				});
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_PROBE_PATH, activeRegion), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ modelIds })
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok || !Array.isArray(body?.results)) throw new Error(body?.error ?? `HTTP ${String(response.status)}`);
					if (!mounted.current) return;
					const landedResults = body.results;
					probesRef.current = { ...probesRef.current };
					for (const result of landedResults) probesRef.current[result.modelId] = result;
					setProbes((previous) => {
						const regionResults = { ...previous[activeRegion] ?? {} };
						for (const result of landedResults) regionResults[result.modelId] = result;
						return {
							...previous,
							[activeRegion]: regionResults
						};
					});
				} catch (error) {
					if (mounted.current) setProbeError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setProbing((previous) => {
						const next = { ...previous };
						for (const id of modelIds) delete next[id];
						return next;
					});
				}
			};
			/**
			* ONE-CLICK availability sweep over several models (issue #61 follow-up, by
			* request of the maintainer after comparing with the sibling `trae` plugin).
			*
			* WHY IT IS A CLIENT-SIDE LOOP. The route accepts exactly ONE model id and
			* refuses more, and that cap is deliberate: it is what stops a stale bundle or
			* a hand-rolled client from turning one click into an unaccounted spend over a
			* whole roster (3.0.0's reason for deleting the original batch button). A
			* sweep is therefore expressed the way trae expresses it — one model per
			* request, from here — which keeps that gate intact and has a second benefit
			* the host-side batch never had: each row's verdict appears the moment it is
			* known, instead of the card sitting blank until the slowest model answers.
			*
			* COST is stated in the button's own hint rather than in a confirmation
			* dialog: a probe sends a real-volume request, so a sweep over a whole catalog
			* spends real credit (measured 0.01 per probe at the current default size, on
			* this machine — see the hint text). The user asked for the hint form, and it
			* matches the sibling plugin.
			*
			* SEQUENTIAL, not parallel: a probe exists to discover rate limits, and firing
			* a roster's worth of requests at once is the surest way to create one — the
			* same reason the host's own loop was serial.
			*
			* STOPS ON THE FIRST AUTH FAILURE: a rejected credential answers identically
			* for every remaining model, so continuing would only spend credit to collect
			* the same answer again. Other failures (a rate limit on one model) do NOT
			* stop the sweep — that is information about that model, and stopping would
			* hide it.
			*
			* The summary counts what the run actually established, so a stopped or
			* failed sweep cannot read as a complete green roster.
			*/
			const sweepModels = async (modelIds) => {
				if (modelIds.length === 0) return;
				setProbeError(void 0);
				setSweepSummary(void 0);
				setSweeping({
					done: 0,
					total: modelIds.length
				});
				let available = 0;
				let measured = 0;
				try {
					for (const [index, modelId] of modelIds.entries()) {
						if (!mounted.current) return;
						await probeModels([modelId]);
						const result = probesRef.current[modelId];
						measured += 1;
						if (result?.outcome === "ok") available += 1;
						if (result?.outcome === "credential-rejected") {
							if (mounted.current) setProbeError(t("row.modelsTestAuth"));
							break;
						}
						if (mounted.current) setSweeping({
							done: index + 1,
							total: modelIds.length
						});
					}
					if (mounted.current) setSweepSummary(t("row.modelsTestDone", {
						available,
						total: measured
					}));
				} finally {
					if (mounted.current) setSweeping(void 0);
				}
			};
			/** Sweep the models this region has ENABLED (the current draft's selection). */
			const sweepEnabledModels = () => {
				sweepModels(visibleModels.filter((model) => activeEnabledIds.has(model.id)).map((model) => model.id));
			};
			/**
			* Sweep EVERY model in the region's live catalog, enabled or not.
			*
			* Deliberately the whole VISIBLE catalog and nothing else: those are the ids
			* the host can validate against its own catalog, so this cannot spend credit
			* on an id that only exists in a config file.
			*/
			const sweepAllModels = () => {
				sweepModels(visibleModels.map((model) => model.id));
			};
			const saveModels = async () => {
				if (settingsScope === void 0) return;
				if (status.status !== "signed-in") return;
				setSaving(true);
				setSaveError(void 0);
				try {
					await writeRegionModels(settingsScope, status.region, {
						enabled: activeRegionOn,
						lastCatalog: visibleModels.map(toPersistedWorkBuddyModel),
						enabledModelIds: [...activeEnabledIds],
						imageModelIds: [...activeImageIds],
						offModelIds: [...activeOffIds],
						contextBudgets: activeContextBudgets
					});
					discardModels();
					await refreshUsage(activeRegion);
				} catch (error) {
					if (mounted.current) {
						const reason = error instanceof Error ? error.message : t("row.requestFailed");
						setSaveError(isFileContentionWriteError(error) ? `${reason}${t("row.saveContentionHint")}` : reason);
					}
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			const title = t("row.title");
			/**
			* Show a name, or a placeholder when the desktop app recorded none.
			*
			* The Host sends `''` rather than an identifier, because a `uin`/`uid` shown
			* where a name belongs reads as "the plugin does not know who this is" — the
			* placeholder says the honest thing instead.
			*/
			const nameOf = (value) => value === "" ? t("row.accountUnnamed") : value;
			/** The saved choice no longer matches a local sign-in (tokens are fine). */
			const selectionLost = status.status === "signed-out" && status.selectionLost === true;
			/**
			* The paths the Host probed, on the branch where nothing was found at all.
			* Absent on the legacy card payload (an older Host), so it defaults empty
			* rather than rendering an empty diagnostic.
			*/
			const searched = status.status === "signed-out" ? status.searched ?? [] : [];
			/**
			* What the signed-out paragraph says, and whether to append the Host's raw
			* error. The rule lives in `./searched-paths.ts` because it is the fix for a
			* real duplication: `resolve()`'s message already enumerated every path, and
			* the list below enumerates them again with better reasons.
			*/
			const notice = signedOutNotice({
				selectionLost,
				message: status.status === "signed-out" ? status.message : void 0,
				searched
			});
			status.status === "error" || status.selectionExplicit;
			/**
			* Account-adding and account-migration controls, defined ONCE and rendered
			* in both sign-in states: inside the pool settings block when an account
			* exists, and in the signed-out branch when it does not (the pool section is
			* not rendered there at all). Two JSX copies would be free to drift, and the
			* two states are the same feature — a user who learns these controls in one
			* must find them in the same order in the other.
			*/
			const accountTools = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OAuthSignIn, {
				t,
				region: activeRegion,
				onAdded: () => refreshUsage(activeRegion)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
				t,
				region: activeRegion,
				onChanged: () => refreshUsage(activeRegion),
				accounts: status.status === "error" ? [] : status.accounts.map((account) => ({
					id: account.id,
					accountName: account.accountName
				}))
			})] });
			/**
			* Sidebar credit line switch — ONE control, for the ACTIVE tab's region only.
			*
			* The two regions are independent providers with independent accounts, so
			* each tab owns its own switch and they are never shown as a pair: this one
			* writes `regions.<activeRegion>.showCreditsInMainUi`, which decides only
			* whether THAT region's line appears in the sidebar. That matches how every
			* other control in this card is scoped to the selected tab (account, pool,
			* model list), and it means a CN-only user is never shown a switch for an
			* account they do not have. An earlier revision rendered both boxes side by
			* side under the tab bar regardless of the active tab; that read as one
			* shared setting and was replaced.
			*
			* RENDERED BESIDE THE POOL HEADING, not on its own row. It used to occupy a
			* full line of vertical space for a single checkbox; the pool heading already
			* had a title-left / badge-right row, so the control fits there without the
			* block growing. It is handed to `AccountPool` as a ready-made node purely so
			* the two can share a flex row — the write path, the disabled rules and the
			* serialization against the card's other region writers all stay here, where
			* the settings scope and the save state live.
			*/
			const creditsSwitch = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dsm-workbuddy-credits-switch",
				title: activeRegion === "cn" ? t("row.showCreditsCnHint") : t("row.showCreditsGlobalHint"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: activeRegionOn ? creditsShownOn(activeRegion) : false,
					disabled: !activeRegionOn || togglingCredits === activeRegion || !canWrite || saving || poolBusy,
					onChange: (event) => {
						toggleCredits(activeRegion, event.target.checked);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: activeRegion === "cn" ? t("row.showCreditsCn") : t("row.showCreditsGlobal") })]
			});
			/**
			* WHERE the readout sits — a two-way choice, active tab's region only
			* (issue #62).
			*
			* It sits directly under the show/hide switch because the two answer one
			* question together ("show it, and where"), and because a user only reaches
			* for this when the default seat is unavailable — typically after installing
			* another plugin that occupies the composer row. Rendered as a `<select>`
			* rather than a pair of radios so it stays one compact row on the pool
			* heading, matching the switch beside it.
			*
			* Disabled with the region, exactly like the switch: a region that is off has
			* no readout to place.
			*/
			const creditPositionPicker = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dsm-workbuddy-credit-position-switch",
				title: t("row.creditPositionHint"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: "dsm-workbuddy-pool-select dsm-workbuddy-credit-position",
					value: activeRegionOn ? creditPositionOn(activeRegion) : "composer",
					disabled: !activeRegionOn || togglingCredits === activeRegion || !canWrite || saving || poolBusy,
					"aria-label": t("row.creditPositionAria", { region: activeRegion === "cn" ? t("row.tabCn") : t("row.tabGlobal") }),
					onChange: (event) => {
						changeCreditPosition(activeRegion, event.currentTarget.value === "stats" ? "stats" : "composer");
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "composer",
						children: t("row.creditPositionComposer")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "stats",
						children: t("row.creditPositionStats")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.creditPositionLabel") })]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `dsm-plugin-card${open ? " dsm-plugin-card-open" : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-plugin-card-header",
					"aria-expanded": open,
					"aria-label": `${t(open ? "row.collapse" : "row.expand")}: ${title}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: "dsm-plugin-card-icon",
							src: WORKBUDDY_PLUGIN_ICON,
							alt: ""
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-plugin-card-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-plugin-card-title",
								children: title
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-plugin-card-description",
								children: t("row.desc")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							className: `dsm-plugin-card-chevron${open ? " dsm-plugin-card-chevron-open" : ""}`
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsm-plugin-card-body",
					hidden: !open,
					children: open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-workbuddy-usage",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-workbuddy-tabs",
								role: "tablist",
								"aria-label": title,
								children: WORKBUDDY_REGIONS.map((region) => {
									const regionStatus = statusByRegion[region];
									const regionOnState = regionOn(region);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-workbuddy-tab-cell",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "tab",
											"aria-selected": region === activeRegion,
											className: `dsm-workbuddy-tab${region === activeRegion ? " dsm-workbuddy-tab-active" : ""}${regionOnState ? "" : " dsm-workbuddy-tab-off"}`,
											onClick: () => {
												setActiveRegion(region);
												setAccountError(void 0);
											},
											children: [regionStatus === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												className: "dsm-workbuddy-tab-dot",
												style: dotStyle(regionStatus.status)
											}), region === "cn" ? t("row.tabCn") : t("row.tabGlobal")]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: "dsm-workbuddy-tab-switch",
											title: t("row.tabSwitchHint"),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: regionOnState,
												disabled: togglingRegion === region || !canWrite || saving || poolBusy,
												"aria-label": t("row.tabSwitchAria", { region: region === "cn" ? t("row.tabCn") : t("row.tabGlobal") }),
												onChange: (event) => {
													toggleRegion(region, event.target.checked);
												}
											})
										})]
									}, region);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-models-summary",
								children: t("row.tabHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-models-summary dsm-workbuddy-free-quota-warn",
								children: t("row.tabFreeQuotaWarn")
							}),
							!activeRegionOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-tab-off-notice",
								children: t("row.tabOffNotice")
							}) : null,
							status.status === "error" || status.status === "signed-in" && status.creditsError !== void 0 ? status.status === "signed-in" && status.credentialRejected === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-usage-hint",
								children: t("row.reloginHint")
							}) : null,
							accountError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-account-error",
								role: "alert",
								children: accountError
							}),
							selectionLost ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-usage-hint",
								children: t("row.selectionLostHint")
							}) : null,
							status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								status.credentialRejected === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "dsm-workbuddy-usage-error",
									role: "alert",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("row.credentialRejectedTitle") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedIntro", { accountName: nameOf(status.accountName) }) }),
										status.recovery?.usableAccount !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedSwitch", { accountName: nameOf(status.recovery.usableAccount.accountName) }) }) : status.recovery?.reloginRequired === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedRelogin") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedChoose") }),
										status.recovery?.usableAccount === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: switchingAccount || !canWrite,
											onClick: () => {
												const target = status.recovery?.usableAccount;
												if (target !== void 0) switchAccount(target.accountId);
											},
											children: switchingAccount ? t("row.accountsScanning") : t("row.credentialRejectedSwitchAction", { accountName: nameOf(status.recovery.usableAccount.accountName) })
										})
									]
								}) : null,
								status.creditsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-workbuddy-usage-error",
									children: t("row.creditsError", { message: status.creditsError })
								}),
								status.refreshError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-workbuddy-usage-error",
									role: "alert",
									children: t("row.requestFailedHint", { message: status.refreshError })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPool, {
									t,
									region: activeRegion,
									...status.pool === void 0 ? {} : { pool: status.pool },
									...settingsScope === void 0 ? {} : { settingsScope },
									onRescan: () => {
										rescanAccounts();
									},
									rescanning: busy,
									onSelectAccount: (accountId) => {
										switchAccount(accountId);
									},
									selectingAccount: switchingAccount,
									accountTools,
									...status.pool === void 0 ? {} : { headerExtra: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [creditsSwitch, creditPositionPicker] }) },
									siblingBusy: saving || togglingRegion !== void 0,
									onBusyChange: setPoolBusy,
									onSaved: async () => await refreshUsage(activeRegion) !== void 0,
									onRefresh: () => refreshUsage(activeRegion)
								}),
								status.pool === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-workbuddy-credits-switch-row",
									children: [creditsSwitch, creditPositionPicker]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
									className: "dsm-workbuddy-models",
									"aria-label": t("row.modelsTitle"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-workbuddy-models-fold",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-workbuddy-models-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "dsm-workbuddy-models-title-row",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
														className: "dsm-workbuddy-models-title",
														children: [t("row.modelsTitle"), dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-workbuddy-models-dirty",
															children: t("row.modelsDirty")
														}) : null]
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dsm-workbuddy-models-summary",
													children: t("row.modelsSummary", { count: activeEnabledIds.size })
												})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsm-workbuddy-models-head-actions",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline",
															disabled: busy,
															onClick: () => {
																refreshModels();
															},
															children: busy ? t("row.modelsRefreshing") : t("row.modelsRefresh")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline dsm-workbuddy-models-sweep",
															disabled: busy || sweeping !== void 0 || activeEnabledIds.size === 0,
															title: t("row.modelsTestEnabledHint"),
															onClick: sweepEnabledModels,
															children: sweeping === void 0 ? t("row.modelsTestEnabled") : t("row.modelsTesting", {
																done: sweeping.done,
																total: sweeping.total
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline dsm-workbuddy-models-sweep",
															disabled: busy || sweeping !== void 0 || visibleModels.length === 0,
															title: t("row.modelsTestAllHint"),
															onClick: sweepAllModels,
															children: sweeping === void 0 ? t("row.modelsTestAll") : t("row.modelsTesting", {
																done: sweeping.done,
																total: sweeping.total
															})
														})
													]
												})]
											}),
											probeError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-workbuddy-model-probe-result dsm-workbuddy-model-probe-result-bad",
												role: "alert",
												children: t("row.probeError", { message: probeError })
											}),
											sweepSummary === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-workbuddy-models-sweep-summary",
												role: "status",
												children: sweepSummary
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsm-workbuddy-model-list",
												children: visibleModels.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: `dsm-workbuddy-model${activeEnabledIds.has(model.id) ? "" : " dsm-workbuddy-model-disabled"}`,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "dsm-workbuddy-model-head",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "dsm-workbuddy-model-enabled",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: activeEnabledIds.has(model.id),
																		disabled: !canWrite || saving,
																		onChange: () => {
																			toggleModel(model.id);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "dsm-workbuddy-model-copy",
																		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			className: "dsm-workbuddy-model-name",
																			children: [model.name, model.creditMultiplier === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																				className: "dsm-workbuddy-model-name-rate",
																				children: [
																					"(",
																					model.creditMultiplier.toFixed(2),
																					"x)"
																				]
																			})]
																		})
																	})]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "dsm-workbuddy-model-image",
																	title: imageCheckboxHint(model, t),
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: activeImageIds.has(model.id),
																		disabled: !canWrite || saving,
																		onChange: () => {
																			toggleImage(model.id);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelImage") })]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "dsm-workbuddy-model-off",
																	title: t("row.modelOffHint"),
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: activeOffIds.has(model.id),
																		disabled: !canWrite || saving,
																		onChange: () => {
																			toggleOff(model.id);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOff") })]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
																	className: "dsm-workbuddy-context-budget",
																	"aria-label": t("row.contextBudget"),
																	children: [
																		model.nativeContextWindow > 2e5 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																			type: "radio",
																			name: `context-${model.id}`,
																			checked: (activeContextBudgets[model.id] ?? 2e5) === 2e5,
																			disabled: !canWrite || saving,
																			onChange: () => {
																				setContextBudget(model.id, 2e5);
																			}
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "200K" })] }) : null,
																		model.nativeContextWindow > 5e5 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																			type: "radio",
																			name: `context-${model.id}`,
																			checked: activeContextBudgets[model.id] === 5e5,
																			disabled: !canWrite || saving,
																			onChange: () => {
																				setContextBudget(model.id, 5e5);
																			}
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "500K" })] }) : null,
																		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																			type: "radio",
																			name: `context-${model.id}`,
																			checked: model.nativeContextWindow <= 2e5 || activeContextBudgets[model.id] === model.nativeContextWindow,
																			disabled: model.nativeContextWindow <= 2e5 || !canWrite || saving,
																			onChange: () => {
																				setContextBudget(model.id, model.nativeContextWindow);
																			}
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatCapacity(model.nativeContextWindow, t("row.modelUnknown")) })] })
																	]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "dsm-workbuddy-model-actions-buttons",
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "dsm-btn dsm-btn-outline dsm-workbuddy-model-probe",
																		disabled: probing[model.id] === true || status.status !== "signed-in",
																		title: t("row.probeHint"),
																		onClick: () => {
																			probeModels([model.id]);
																		},
																		children: probing[model.id] === true ? t("row.probing") : t("row.probe")
																	})
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "dsm-workbuddy-model-details",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "dsm-workbuddy-model-meta",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelContext", { context: formatCapacity(model.nativeContextWindow, t("row.modelUnknown")) }) }),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOutput", { output: formatCapacity(model.maxTokens, t("row.modelUnknown")) }) }),
																	model.reasoning === void 0 || model.reasoning.supportedEfforts === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelReasoning", { efforts: model.reasoning.supportedEfforts.join(" / ") }) })
																]
															})
														}),
														(() => {
															const result = probes[activeRegion]?.[model.id];
															if (result === void 0) return null;
															const view = probeResultView(result, t);
															const reason = inlineProbeReason(result.outcome, result.message);
															return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
																className: `dsm-workbuddy-model-probe-result dsm-workbuddy-model-probe-result-${view.tone}`,
																role: "status",
																...result.message === void 0 ? {} : { title: result.message },
																children: [view.text, reason === void 0 ? null : " · " + reason]
															});
														})()
													]
												}, model.id))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-workbuddy-model-capability-note",
												children: t("row.modelCapabilityPending")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-workbuddy-model-actions",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
														className: "dsm-workbuddy-usage-cheer",
														href: WORKBUDDY_GITHUB_URL,
														target: "_blank",
														rel: "noopener noreferrer",
														children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-workbuddy-usage-cheer-star",
															"aria-hidden": "true",
															children: "★"
														})]
													}),
													saveError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-workbuddy-model-save-error",
														children: t("row.saveError", { message: saveError })
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsm-workbuddy-model-actions-buttons",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline",
															disabled: !dirty || saving || poolBusy || togglingRegion !== void 0,
															onClick: discardModels,
															children: t("row.discard")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-primary",
															disabled: !dirty || saving || poolBusy || togglingRegion !== void 0 || activeEnabledIds.size === 0,
															onClick: () => {
																saveModels();
															},
															children: saving ? t("row.saving") : t("row.save")
														})]
													})
												]
											})
										]
									})
								})
							] }) : null,
							status.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-workbuddy-usage-text",
									children: signedOutText(notice, t)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-workbuddy-usage-account-actions",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										disabled: busy,
										onClick: () => {
											rescanAccounts();
										},
										children: busy ? t("row.accountsScanning") : t("row.accountsRescan")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-workbuddy-pool-tools",
									children: accountTools
								}),
								searched.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchedPaths, {
									items: searched,
									t
								}) : null
							] }) : null,
							status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-workbuddy-usage-error",
								children: status.message
							}) : null
						]
					}) : null
				})]
			});
		}
		//#endregion
		//#region src/client/popover.ts
		/**
		* The two shell behaviours the composer credit panel needs: hanging the panel
		* off its trigger, and dismissing it on an outside press.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `client/popover.ts`，逐条沿用其判断：同样的上下放置、同样的
		*     视口收边、同样的 scroll(capture)/resize/自身尺寸变化重测、同样的
		*     「pointerdown 落在触发器与面板之外即关闭」。这些不是随手写的——那边
		*     2.12.0/2.13.0 的客户端加载失败与面板位置错乱都留下了记录，这里直接
		*     采用其最终结论。
		*
		* Implemented locally rather than imported from
		* `@deepseek-ai/dsh-client-ui-primitives`. The shell DOES register that package
		* for plugin bundles, so importing it is legal — this is a deliberate choice,
		* not a workaround: the two behaviours are ~40 lines of DOM geometry, and owning
		* them keeps this component renderable in the Node test suite without mocking a
		* package that itself reaches `*.module.css` and further DSH dependencies.
		*
		* NOTE ON A MISDIAGNOSIS, kept because it is the kind of thing that gets
		* re-litigated: the client load failure on the referring project was first
		* attributed to importing the primitives package. It was not that. The real
		* cause was `import { createPortal } from 'react-dom'` being BUNDLED rather than
		* externalized — the inlined development build opens with
		* `process.env.NODE_ENV` and threw `ReferenceError: process is not defined` in
		* the browser, at module-evaluation time, so the ENTIRE client half failed to
		* import. See `tsdown.config.ts` (`CLIENT_EXTERNALS`) for the fix and
		* `tests/client-runtime-imports.spec.ts` for the rule that now pins it.
		*/
		/**
		* Clearance to keep from the top of the viewport.
		*
		* The shell reserves a strip at the top of the frame
		* (`--dsh-frame-top-clearance`) for the window chrome, so a panel clamped to
		* `margin` alone can still land under it. Absent variable or no `data-fullscreen`
		* distinction is handled the same way the shell does: fall back to `min`.
		*/
		function overlayTopMargin(min) {
			if (typeof document === "undefined") return min;
			const root = document.documentElement;
			const clearance = Number.parseFloat(getComputedStyle(root).getPropertyValue("--dsh-frame-top-clearance"));
			if (Number.isNaN(clearance)) return min;
			return Math.max(min, (root.hasAttribute("data-fullscreen") ? 0 : clearance) + 20);
		}
		/** Keep a `position: fixed` floating element anchored to a trigger. */
		function useAnchoredPosition(options) {
			const { open, anchorRef, panelRef, side = "bottom", align = "start", gap, margin } = options;
			const [position, setPosition] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setPosition(null);
					return;
				}
				const place = () => {
					const rect = anchorRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const panel = panelRef.current;
					const width = panel?.offsetWidth ?? 0;
					const height = panel?.offsetHeight ?? 0;
					let left = align === "end" ? rect.right - width : rect.left;
					let top = side === "top" ? rect.top - gap - height : rect.bottom + gap;
					if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
					if (height > 0) top = Math.min(Math.max(top, overlayTopMargin(margin)), window.innerHeight - height - margin);
					setPosition({
						left,
						top
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				const panel = panelRef.current;
				let observer = null;
				if (typeof ResizeObserver !== "undefined" && panel !== null) {
					observer = new ResizeObserver(place);
					observer.observe(panel);
				}
				return () => {
					observer?.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				open,
				anchorRef,
				panelRef,
				side,
				align,
				gap,
				margin
			]);
			return position;
		}
		/**
		* Close an open popover when a pointerdown lands outside it.
		*
		* `portal` counts as inside: the panel is portaled to `document.body`, so it is
		* not a descendant of `root` and a click on the panel itself would otherwise
		* read as "outside" and dismiss the popover the user is trying to use.
		*/
		function useDismissOnOutsidePointer(root, open, setOpen, portal) {
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const closeOutside = (event) => {
					if (event.target instanceof Node && root.current?.contains(event.target) !== true && portal?.current?.contains(event.target) !== true) setOpen(false);
				};
				document.addEventListener("pointerdown", closeOutside);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
				};
			}, [
				root,
				open,
				setOpen,
				portal
			]);
		}
		//#endregion
		//#region src/client/ComposerCredits.tsx
		/**
		* Credit readout for the composer tool row (`conversation.input.left`).
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `client/ComposerPoints.tsx`：读数形态（`<区域> · <余额>`）、
		*     点击弹出锚定面板、面板内是**账号表格**（点行即切换账号）、刷新按钮
		*     放在面板里而不是读数上、每账号读数**只在面板打开时抓**、5 分钟定时器、
		*     失败保留上次数值。本文件把「只有国内版」扩成「两个区域都支持」：那边
		*     的国际版是订阅制、没有可比数字，本插件的国际版有真实余额，所以按当前
		*     选中模型所属的区域显示，并在读数上标明是 WB CN 还是 WB AI。
		*
		* Shows the selected region's general credit balance, but ONLY while the
		* session's selected model belongs to this plugin (the gate decides that).
		*
		* The row itself is a bare clickable readout — `WB CN · 1,072` — with NO
		* refresh control: the manual refresh lives in the panel, because the row is
		* shared with the shell's own permission/agent/model controls and every extra
		* control there costs space that is not ours. Clicking it opens an anchored
		* panel: a TABLE with one row per account in that region and its balance, where
		* a row click switches to it.
		*
		* Two deliberate choices in that panel:
		*
		*  - Per-account figures are fetched ONLY while the panel is open. The 5-minute
		*    readout must not multiply its upstream reads by the account count — a
		*    healthy balance should not pay for a table nobody is looking at.
		*  - A row whose balance could not be read shows `—`, never `0`. The endpoint
		*    omits the field in that case precisely so this component cannot render a
		*    wrong claim about the account.
		*/
		/**
		* Inject the readout's styles into the document head, once, on module load.
		*
		* Same idempotent pattern as the card's injection, and for the same reason: the
		* classes are attached to DOM this component owns, and `WORKBUDDY_CARD_CSS` only
		* loads when the settings card does — which is not guaranteed on a host where
		* the card is never rendered. The referring project shipped exactly that bug
		* (the trigger rendered as a default button box and the panel, without
		* `position: fixed`, had its measured left/top ignored and appeared nowhere).
		*/
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-workbuddy/composer-credits.css";
			if (!document.querySelector(`style[data-plugin-css="${cssId}"]`)) {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-workbuddy";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = WORKBUDDY_COMPOSER_CSS;
				document.head.appendChild(styleTag);
			}
		}
		/**
		* Automatic refresh period for the READOUT. Five minutes, matching a credit
		* balance's actual rate of change: it moves on the scale of model calls, not
		* seconds, and each read is a read-only upstream call.
		*/
		const COMPOSER_CREDITS_REFRESH_INTERVAL_MS = 3e5;
		/**
		* Refresh period for the panel's per-account table, while it stays open.
		*
		* Deliberately NOT the readout's five minutes. The table carries two things,
		* and the faster-moving one decides the cadence:
		*
		*  - the balance, which barely moves, and
		*  - each account's `excludedBy` ("被限流" / "模型繁忙"), which is derived from
		*    the pool's own cooldowns — and the SHORTEST of those is the model-scoped
		*    two-minute throttle (`MODEL_BUSY_COOLDOWN_MS`).
		*
		* At five minutes the table could state an account is 模型繁忙 long after the
		* upstream let it serve again, and the pool card — which polls every 60 s
		* (`POLL_INTERVAL_MS` in `WorkBuddyCard.tsx`) — would say it is fine at the same
		* moment. Two surfaces disagreeing about one account is exactly the complaint
		* this constant answers, so the table now converges on the card's cadence
		* instead of its own.
		*
		* The cost is bounded and paid only while the panel is open: one `fetchCredits`
		* per account per minute, the same read the card already makes when it is open.
		*/
		const COMPOSER_ACCOUNT_REFRESH_INTERVAL_MS = 6e4;
		/**
		* Provider routes whose credit balance this readout can show, mapped to the
		* region to read it from.
		*
		* BOTH regions, unlike the referring project: its international side is
		* subscription-based and has no comparable balance, while WorkBuddy's
		* international accounts do carry one, so there is a real number to show on
		* either side. Mirrors `WORKBUDDY_PROVIDERS` on the host side; duplicated here
		* because the client bundle must not import the host entry.
		*/
		const WORKBUDDY_COMPOSER_PROVIDERS = {
			"workbuddy": "cn",
			"workbuddy-global": "global"
		};
		/** The credit total out of one usage document, or undefined. */
		function creditsOf(usage) {
			if (usage.status !== "signed-in") return void 0;
			return usage.credits?.total;
		}
		/**
		* The Host's per-region readout switch off a usage document, when it carries one.
		*
		* The `error` variant has no data at all, so it can only ever answer `undefined`
		* — "the Host did not say", which leaves the settings scope in charge.
		*/
		function hostCreditsShownOf(usage) {
			if (usage === void 0 || usage.status === "error") return void 0;
			const value = usage.showCreditsInMainUi;
			return typeof value === "boolean" ? value : void 0;
		}
		function formatClock(value) {
			return new Date(value).toLocaleTimeString("zh-CN", {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		function ComposerCredits(props) {
			const { t, provider, region, settingsScope } = props;
			if (t === void 0) throw new Error("Composer credits readout requires its translation function");
			const owned = provider === void 0 ? void 0 : WORKBUDDY_COMPOSER_PROVIDERS[provider];
			const activeRegion = region ?? owned;
			const [usage, setUsage] = (0, react.useState)(void 0);
			const [accountCredits, setAccountCredits] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [switchingId, setSwitchingId] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [lastRefresh, setLastRefresh] = (0, react.useState)(void 0);
			const [open, setOpen] = (0, react.useState)(false);
			const inFlight = (0, react.useRef)(false);
			/** Account-table reads in flight; see `fetchAccountCredits`. */
			const accountsInFlight = (0, react.useRef)(0);
			/** Which account-table read is the newest; see `fetchAccountCredits`. */
			const accountsReadGeneration = (0, react.useRef)(0);
			const mounted = (0, react.useRef)(true);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const position = useAnchoredPosition({
				open: open && activeRegion !== void 0,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: 8,
				margin: 12
			});
			useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
			const fetchUsage = (0, react.useCallback)(async (signal) => {
				if (inFlight.current || activeRegion === void 0) return;
				inFlight.current = true;
				if (mounted.current) setBusy(true);
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_USAGE_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const value = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					setUsage(value);
					setLastRefresh(Date.now());
					setFailed(false);
				} catch {
					if (mounted.current && signal?.aborted !== true) setFailed(true);
				} finally {
					inFlight.current = false;
					if (mounted.current) setBusy(false);
				}
			}, [activeRegion]);
			/**
			* Every account's balance in the region — one upstream read per account.
			*
			* Paid only while the panel is open (see the note at the top of this file).
			* A failure keeps whatever we already have rather than clearing it: the table
			* falls back to the usage document's account list, so a failed figure must not
			* remove the switch.
			*
			* `force` distinguishes the TWO callers, and the distinction is the point:
			*
			*  - the panel's timer passes nothing, so a tick that arrives while a read is
			*    still in flight is SKIPPED. The panel is asking "has anything changed?",
			*    and a read already on its way answers that.
			*  - a deliberate action (the refresh button, or `switchTo` re-reading after a
			*    write) passes `force: true`, because it must actually happen. Skipping it
			*    would be the same defect this file is fixing: a control that reports "the
			*    table is current" without having asked. It also claims the newest
			*    generation, so its answer is the one that lands.
			*
			* Latest-wins rather than a queue: responses can resolve out of order, and a
			* slow tick started earlier must not overwrite the press that superseded it —
			* which would silently re-draw a mark the press had just cleared.
			*/
			const fetchAccountCredits = (0, react.useCallback)(async (signal, force) => {
				if (activeRegion === void 0) return;
				if (!force && accountsInFlight.current > 0) return;
				const generation = ++accountsReadGeneration.current;
				accountsInFlight.current += 1;
				try {
					const response = await fetch(withWorkBuddyRegion(WORKBUDDY_ACCOUNT_CREDITS_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					if (generation !== accountsReadGeneration.current) return;
					if (Array.isArray(data.accounts)) {
						setAccountCredits(data.accounts);
						setLastRefresh(Date.now());
					}
				} catch {} finally {
					accountsInFlight.current -= 1;
				}
			}, [activeRegion]);
			const hostHidden = hostCreditsShownOf(usage) === false;
			(0, react.useEffect)(() => {
				if (owned === void 0 || hostHidden) return void 0;
				let cancelled = false;
				let timer;
				const controller = new AbortController();
				fetchUsage(controller.signal).finally(() => {
					if (cancelled) return;
					timer = window.setInterval(() => {
						fetchUsage(controller.signal);
					}, COMPOSER_CREDITS_REFRESH_INTERVAL_MS);
				});
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearInterval(timer);
					controller.abort();
				};
			}, [
				owned,
				hostHidden,
				fetchUsage
			]);
			/**
			* Per-account figures are read on OPEN, then kept fresh while the panel stays
			* open.
			*
			* The on-open read is what makes the table useful immediately. The TIMER is
			* the fix for the complaint that started this: with an open-only read, a panel
			* left open showed a frozen snapshot of every account's `excludedBy`, while
			* the pool card behind it re-ranked every 60 s. The two then disagreed about
			* the same account — the panel drawing no mark where the card said 模型繁忙 —
			* and neither surface was wrong on its own data, which is what made it so hard
			* to read.
			*
			* The timer starts only AFTER the first read settles, so a slow upstream
			* cannot stack overlapping reads (the same shape the readout's own effect
			* uses). Aborted on close: the panel pays one read per minute only while it is
			* actually on screen.
			*/
			(0, react.useEffect)(() => {
				if (!open || activeRegion === void 0) return void 0;
				let cancelled = false;
				let timer;
				const controller = new AbortController();
				fetchAccountCredits(controller.signal).finally(() => {
					if (cancelled) return;
					timer = window.setInterval(() => {
						fetchAccountCredits(controller.signal);
					}, COMPOSER_ACCOUNT_REFRESH_INTERVAL_MS);
				});
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				fetchAccountCredits
			]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			/**
			* Switch to another account, then re-read both the usage document and the
			* table so the marker, the readout and the panel all move together.
			*
			* Goes through the shared `writeAccountSlot`, which is read-back checked and
			* carries the host-endpoint-first path: `set()` resolving is not proof the
			* write landed, and a refused write must report failure instead of showing a
			* marker on an account that was never selected.
			*/
			const switchTo = async (accountId) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				if (activeRegion === void 0 || switchingId !== void 0) return;
				if (accountId === (accountCredits?.find((account) => account.selected)?.id ?? (usage?.status === "signed-in" ? usage.accountId : void 0))) return;
				setSwitchingId(accountId);
				setFailed(false);
				try {
					await writeAccountSlot(settingsScope, activeRegion, accountId);
					await fetchUsage();
					await fetchAccountCredits(void 0, true);
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					if (mounted.current) setSwitchingId(void 0);
				}
			};
			/**
			* One manual refresh, of both things the panel shows.
			*
			* It used to call `fetchUsage` alone, so pressing 刷新 on the account table
			* refreshed the trigger's balance and left every ROW exactly as it was —
			* including its 被限流 / 模型繁忙 mark. The button sits inside the table's own
			* header, so the user reads it as "refresh this table"; a control that
			* refreshes something else is worse than no control, and it is one of the
			* reasons the panel could keep claiming a state the card had already moved
			* past.
			*
			* Both reads run concurrently rather than in sequence: neither depends on the
			* other, and awaiting the usage document first would delay the table by one
			* round trip for no benefit. `refreshUsage` resolves rather than throws on
			* failure (it records `failed` itself), so the table's read is never skipped
			* because the other half went wrong.
			*/
			const refresh = (0, react.useCallback)(async () => {
				setFailed(false);
				await Promise.all([fetchUsage(), fetchAccountCredits(void 0, true)]);
			}, [fetchUsage, fetchAccountCredits]);
			if (owned === void 0) return null;
			/**
			* The Host's own answer for this region, when the document carries one.
			*
			* The Host is the AUTHORITY on whether this readout is wanted, exactly as the
			* card's `creditsShownOn` treats it — and here it is also the fix for a defect
			* shipped in 4.3.0 (issue #46): the gate's decision rests on the settings
			* scope, which on a host whose describe mirror lands late was bound to a
			* namespace nothing serves. Every read of that scope is then `undefined`, and
			* the opt-out rule (`!== false`) reads "shown" forever — so unticking the
			* checkbox wrote correctly and changed nothing on screen.
			*
			* Checked AFTER the fetch rather than before it because the answer only
			* arrives with the document. The cost is one usage read for a readout the user
			* may have hidden, against a persistent wrong number on screen.
			*/
			if (hostCreditsShownOf(usage) === false) return null;
			const signedIn = usage?.status === "signed-in" ? usage : void 0;
			const total = signedIn === void 0 ? void 0 : creditsOf(signedIn);
			const signedOut = usage !== void 0 && usage.status === "signed-out";
			const valueText = total === void 0 ? "—" : formatCredits(total);
			const label = t(activeRegion === "cn" ? "composer.pointsCn" : "composer.pointsGlobal");
			/**
			* The table's rows: every account in this region, with its balance.
			*
			* The endpoint's answer is authoritative (it carries the figures). Before it
			* lands — or if it fails — fall back to the usage document's account list so
			* the switches are reachable immediately, showing `—` for the figure rather
			* than a spinner the user has to wait on.
			*/
			const selectedId = accountCredits?.find((account) => account.selected)?.id ?? (signedIn === void 0 ? void 0 : signedIn.accountId);
			const rows = (accountCredits ?? (signedIn === void 0 ? [] : signedIn.accounts.map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})))).map((row) => {
				if (row.id !== selectedId || row.credits !== void 0 || total === void 0) return row;
				return {
					...row,
					credits: total
				};
			});
			const canSwitch = settingsScope !== void 0 && settingsScope.getSnapshot().writable === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: "dsm-workbuddy-composer-credits",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-workbuddy-composer-credits-trigger",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						label,
						" · ",
						valueText
					]
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: "dsm-workbuddy-composer-panel",
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": t("composer.panelTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-workbuddy-composer-panel-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-workbuddy-composer-panel-title",
								children: t(activeRegion === "cn" ? "composer.panelTitleCn" : "composer.panelTitleGlobal")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-workbuddy-composer-panel-refresh",
								disabled: busy || switchingId !== void 0,
								onClick: () => {
									refresh();
								},
								children: busy ? t("composer.refreshing") : t("composer.refresh")
							})]
						}),
						signedOut ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-workbuddy-composer-panel-empty",
							children: t("composer.signedOut")
						}) : rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-workbuddy-composer-panel-empty",
							children: t("composer.noAccounts")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "dsm-workbuddy-composer-panel-table",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("composer.account")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: "dsm-workbuddy-composer-panel-num",
								children: t("composer.credits")
							})] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => {
								const current = row.id === selectedId;
								const excluded = exclusionText(t, row.excludedBy);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: current ? "dsm-workbuddy-composer-panel-row-current" : void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "row",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "dsm-workbuddy-composer-panel-switch",
											disabled: !canSwitch || switchingId !== void 0 || current,
											"aria-label": t("composer.switchTo", { account: row.accountName }),
											onClick: () => {
												switchTo(row.id);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-workbuddy-composer-panel-dot",
												"aria-hidden": "true"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-workbuddy-composer-panel-who",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-workbuddy-composer-panel-name",
													children: row.accountName
												}), excluded === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-workbuddy-composer-panel-mark",
													children: excluded
												})]
											})]
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dsm-workbuddy-composer-panel-num",
										children: row.credits === void 0 ? "—" : formatCredits(row.credits)
									})]
								}, row.id);
							}) })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-workbuddy-composer-panel-foot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("composer.lastRefresh"),
								" ",
								lastRefresh === void 0 ? "—" : formatClock(lastRefresh)
							] })
						}),
						failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-workbuddy-composer-panel-error",
							role: "status",
							children: t("composer.refreshFailed")
						}) : null
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region src/client/ComposerCreditsGate.tsx
		/**
		* Decides whether the composer credit readout belongs in this session, by
		* reading the Host's own `modelSelection` projection and the plugin's
		* per-region `showCreditsInMainUi` switch.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `client/ComposerPointsGate.tsx`：从 `modelSelection` 投影读
		*     「本会话当前用哪个 provider」来决定要不要渲染，以及 `next` 优先于
		*     `lastUsed` 的判定。这是本项目从侧边栏迁到输入框的核心机制。
		*
		* WHY the projection rather than this plugin's own state: the projection is
		* what the model picker writes and what the next request will use, so the
		* readout cannot disagree with the model actually in effect. `next` outranks
		* `lastUsed` because a selection that has been made but not yet sent is still
		* what the composer shows the user — the same precedence the shell itself uses.
		*
		* WHY the composer row rather than the sidebar foot: the sidebar foot is a
		* SINGLE root-scope row shared by every bundle, so two connector plugins each
		* parking a line there fight over the same width (measured on the referring
		* project: its line was squeezed to a clipped "Tr" beside this plugin's two
		* rows). The composer row is per-session and provider-scoped, so exactly one
		* plugin's credits are relevant at a time and nothing overlaps.
		*
		* WHY THERE IS A SECOND SEAT (issue #62). The composer tool row is a LIST seat,
		* so it is shared not only with the shell's own controls but with any other
		* plugin that registers there — and one report is exactly that: with a
		* third-party plugin installed the readout stopped appearing at all. A list seat
		* cannot promise that every occupant is visible, so the seat is the USER's
		* choice: `composer` (default, unchanged for anyone who does not choose) or
		* `stats`, the ambient dock below the composer card where the shell renders its
		* own round/token pills. The gate is registered in BOTH seats and renders in the
		* one the setting names, which keeps the decision in one function instead of
		* re-registering slots when the setting changes.
		*
		* Kept separate from {@link ComposerCredits} (and from the browser-plugin
		* entry) so the decision can be unit-tested without a Host: the entry imports
		* browser-only DSH packages the test environment cannot load, while this module
		* depends only on React and a narrow projection shape.
		*/
		/**
		* The provider route the session is currently pointed at.
		*
		* `next` wins over `lastUsed`: a switch that has landed but not yet been sent
		* is still the selection the composer displays.
		*/
		function selectedProviderOf(projection) {
			const provider = (projection?.next ?? projection?.lastUsed)?.provider;
			return typeof provider === "string" && provider !== "" ? provider : void 0;
		}
		/**
		* Which region's readout this session should show, or undefined for none.
		*
		* Returns undefined when the selected provider is not this plugin's — the
		* ownership test and the region choice are ONE lookup, so there is no second
		* copy of the rule to drift.
		*
		* The region's own switches are applied HERE rather than inside the component,
		* so a region that is switched off (or whose provider is off) starts no fetch
		* loop at all.
		*
		* `hostValue` is the Host's own `showCreditsInMainUi` answer for this region,
		* when a usage document carrying it is already in hand. It OUTRANKS the settings
		* scope, exactly as the card's `creditsShownOn` does and for the same measured
		* reason: the browser's settings mirror is documented as stale for this
		* namespace on the affected deployments, and — the shipped 4.3.0 defect (issue
		* #46) — the scope can be bound to a namespace nothing serves, where every read
		* is `undefined` and the opt-out rule then reads "shown" forever. The Host is
		* the authority; the scope is the fallback for a Host line that predates the
		* field.
		*/
		/**
		* The settings tree this plugin writes, unwrapped to a plain object.
		*
		* `unwrapVolatileDeep` first: the scope's value is a live cosmokit reference on
		* the 0.1.7 line, and reading fields off it without unwrapping yields proxies
		* whose `===` comparisons against a string are false.
		*/
		function scopeValueOf(scope) {
			return scope === void 0 ? void 0 : unwrapVolatileDeep(scope.getSnapshot().value);
		}
		function composerCreditsRegionOf(projection, scope, hostValue) {
			const provider = selectedProviderOf(projection);
			const region = provider === void 0 ? void 0 : WORKBUDDY_COMPOSER_PROVIDERS[provider];
			if (region === void 0) return void 0;
			if (typeof hostValue === "boolean") return hostValue ? region : void 0;
			const value = scope === void 0 ? void 0 : unwrapVolatileDeep(scope.getSnapshot().value);
			if (!regionCreditsShownOf(value, region)) return void 0;
			if (!regionEnabledOf(value, region)) return void 0;
			return region;
		}
		function ComposerCreditsGate(props) {
			const { t, position, settingsScope, useProjection } = props;
			const [, setRevision] = (0, react.useState)(0);
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setRevision((value) => value + 1);
			}), [settingsScope]);
			const projection = useProjection === void 0 ? void 0 : useProjection("modelSelection");
			const region = composerCreditsRegionOf(projection, settingsScope);
			if (region === void 0) return null;
			if (regionCreditPositionOf(scopeValueOf(settingsScope), region) !== (position ?? "composer")) return null;
			const provider = selectedProviderOf(projection);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerCredits, {
				t,
				provider,
				region,
				...settingsScope === void 0 ? {} : { settingsScope }
			});
		}
		//#endregion
		//#region src/client/WorkBuddyQuotaNotice.tsx
		/**
		* The supplement this plugin adds to a quota failure (issue #63).
		*
		* 参考：`dsh-connect-trae`（MIT）— 「以插件身份向宿主的通知链注册一个条目」的
		*   席位用法与自建 DOM（不依赖 ui-primitives）的渲染约定，见 docs/DESIGN.md §5.3。
		* 改动：本模块是原创实现，但其中两处决定**与本文件早期版本相反**，且都是被真机
		*   截图推翻的：(1) 曾认领 `shell.quota-notice` 链并在其中重绘宿主句子，后判定该
		*   链的语义是「接管整个界面」而非加装饰，遂改为**一律拒收**；(2) 曾是带按钮的
		*   卡片，后改为只读的行内括号。两处的原因各自写在下文对应位置，删改前请先读。
		*
		* WHY THIS EXISTS. When an upstream failure is classified `QUOTA`, the host
		* renders ONE fixed sentence — 「当前请求的额度已用尽」 — and (measured on the
		* shipped client) it DISCARDS the provider's own message to do so:
		*
		*   function failureMessage(message, code, t) {
		*     if (code === 'QUOTA' || code === 'ACCOUNT_QUOTA') return t('message.failure.quota')
		*     return code === 'AUTH' ? t('message.failure.auth') : message
		*   }
		*
		* That sentence is right for a genuinely exhausted account (14018), and wrong
		* for `6004` — the upstream's own words are 「您的使用量已超出频率限制，将在
		* <时刻> 重置」, and the reporter's account still held 6,788 credits. The
		* plugin cannot fix that by re-classifying: measured against the shipped
		* classifier, every spelling that stops reading as `QUOTA` falls into
		* `RATE_LIMIT`, which IS in `DEFAULT_RETRYABLE_CODES` — so it would buy an
		* honest sentence with 5 in-place retries and ~15.5s of backoff on a limit that
		* resets hours later. Staying out of the retry set is the behaviour we keep
		* (the maintainer's call on issue #63); the sentence is what we supplement.
		*
		* HOW (SUPERSEDED — see the DECLINE note below). The host ships a CHAIN seat
		* for exactly this: `shell.quota-notice`, a frame-wide surface whose own
		* comment says "a `shell.quota-notice` entry may replace the generic Toast for
		* codes it claims". An earlier build of this plugin claimed `QUOTA` there and
		* re-rendered the sentence plus the supplement.
		*
		* THE DECLINE (the maintainer's call, on a screenshot). Claiming a chain entry
		* does not decorate the host's surface, it TAKES IT OVER: the host's generic
		* warning Toast is then not rendered at all, and what replaced it was an inline
		* `<span>` — no fixed positioning, no centring, no background, no fade-out. It
		* landed at the top-left of `shell.overlay` and stayed. That is the box the
		* maintainer reported as "not being there before", and it was correct: the
		* plugin had painted it. The registration now declines every owner, so the
		* host's own Toast is what shows — a surface whose look this plugin does not
		* get to decide — and the supplement lives in the conversation instead, beside
		* the host's failure row, which is where the user is actually looking when a
		* turn fails.
		*
		* WHY THE HOST'S SENTENCE IS LEFT ALONE: it is the string the shell shows
		* everywhere else for this code, and a plugin that reworded it would contradict
		* the shell's own vocabulary. The supplement is additive, and it is written to
		* be TRUE FOR BOTH CASES the code covers — a model's own daily quota (not
		* credits) and a genuinely empty balance — because the plugin cannot always
		* tell which one it is: the upstream states it in Chinese prose the plugin is
		* not allowed to parse for policy.
		*
		* Rendered as plain DOM with this plugin's own classes: the client half
		* deliberately does not depend on `@deepseek-ai/dsh-client-ui-primitives` (see
		* the note in `src/client/index.tsx` — a stale inject entry there once made the
		* whole card's arrival depend on the churn-heaviest host package), so the
		* notice is built from the same primitives every other component here uses.
		*/
		/**
		* The chain selector: which owner (if any) this plugin takes over.
		*
		* ALWAYS `null`, and that is the fix — see the DECLINE note in the file header.
		* Exported so the decline is unit-testable without a host: the spec asserts
		* this returns null for every owner, which is what keeps the host's own Toast
		* on screen. A function rather than an inline lambda in the registration so the
		* rule has one home and one test, instead of being restated at the call site.
		*/
		function selectQuotaNoticeClaim(_owner) {
			return null;
		}
		/**
		* The supplement this plugin adds to a quota failure.
		*
		* It is what the `shell.quota-notice` chain WOULD render if the registration
		* claimed an owner — which it no longer does. Kept as the rendering seat for
		* the supplement so the copy, the locale keys and their guards survive the
		* decline: the next surface that wants this sentence (a failure row, a
		* transcript notice) mounts this component rather than re-inventing the markup.
		*
		* ONE line, no body, no button, no host sentence of its own — the takeover that
		* used to prepend the host's sentence is exactly what was removed.
		*/
		function WorkBuddyQuotaNotice(props) {
			const { t } = props;
			return (0, react.createElement)("span", {
				className: "dsm-workbuddy-quota-notice",
				role: "status"
			}, (0, react.createElement)("span", { className: "dsm-workbuddy-quota-notice-body" }, t("quotaNotice.supplement")));
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Plugin-card copy registered under the settings.workbuddy locale namespace.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — `row.*` 的文案键约定与中英 1:1 键对齐（`zh: Record<Key, string>`
		*     强制双语同步）来自该项目，其又继承自
		*     dingminhua/dsh-subagent-default-model（MIT）。
		* 改动：文案按 WorkBuddy 的实际情况改写（积分套餐、模型倍率、多账号）。
		*
		* @module dsh-connect-workbuddy/client/locales
		*/
		const en = {
			"row.title": "WorkBuddy credits & models (dsh-connect-workbuddy)",
			"row.desc": "Use WorkBuddy models in DSH and see your remaining credits; the domestic and international sides are two independent providers, each with its own account — use both at the same time.",
			"row.expand": "Expand",
			"row.collapse": "Collapse",
			"row.tabCn": "Domestic",
			"row.tabGlobal": "Global",
			"row.tabHint": "Each tab is a separate provider (workbuddy / workbuddy-global) with its own account, credits, and models. Both sides are live at once: different sessions can pick from either side, and changes on one tab never touch the other.",
			"row.tabFreeQuotaWarn": "Free models have a per-window token quota — they are not unlimited.",
			"row.tabSwitchHint": "Uncheck to switch this provider off. Its models disappear from the DSH model picker; your account, credits, and model settings are kept and return when you check it again.",
			"row.tabSwitchAria": "Offer the {region} provider to DSH",
			"row.tabOffNotice": "This provider is switched off: none of its models are offered to DSH. Your account, credits, and model settings are kept — check the box above the tab to bring it back.",
			"row.signedOutHint": "Sign in once in the WorkBuddy desktop app; this plugin follows that sign-in automatically.",
			"row.signedOutWrongRegion": "Your WorkBuddy sign-in was found, but it belongs to the other region tab. Switch tabs above to use it — there is nothing to sign in again.",
			"row.signedOutEncrypted": "Your WorkBuddy sign-in is present, but its token fields are encrypted and the plugin could not read the key. Install the WorkBuddy desktop app, or set WORKBUDDY_APP_EXECUTABLE to its executable — signing in again will not change this.",
			"row.searchedTitle": "Paths checked",
			"row.searchedHint": "If your WorkBuddy keeps its login somewhere else, point the plugin at it with the WORKBUDDY_AUTH_FILE environment variable.",
			"row.reasonMissing": "not found",
			"row.reasonUnreadable": "unreadable",
			"row.reasonInvalid": "no usable token",
			"row.reasonEncrypted": "encrypted — needs the desktop app",
			"row.reasonWrongRegion": "belongs to the other region",
			"row.sourceDesktop": "desktop app",
			"row.sourceDsh": "plugin copy",
			"row.searchedMore": "Show the {count} path(s) that were not found",
			"row.reloginHint": "If errors occur, sign back in to the WorkBuddy app.",
			"row.rescanHidesKept": "The accounts you removed are still hidden: the plugin could not update its own list file. On Windows this is usually a file lock — close antivirus or sync tools that may be holding files in the DSH profile, then try again.",
			"row.credentialRejectedTitle": "WorkBuddy refused this account's token",
			"row.credentialRejectedIntro": "The token for \"{accountName}\" is no longer accepted by the upstream, so credits and check-in are unavailable. Signing in again only helps if the problem is the token itself — here is what actually applies:",
			"row.credentialRejectedSwitch": "Another sign-in on this machine answered the upstream: \"{accountName}\". Switching to it fixes this — no need to sign in again.",
			"row.credentialRejectedSwitchAction": "Switch to \"{accountName}\"",
			"row.credentialRejectedRelogin": "No other local sign-in exists to switch to. Sign in again in the WorkBuddy desktop app.",
			"row.credentialRejectedChoose": "Other local sign-ins exist but none of them answered the upstream just now. Try switching to one above; if none works, sign in again in the desktop app.",
			"row.requestFailed": "Request failed",
			"row.requestFailedHint": "Refresh failed — showing the last loaded data: {message}",
			"row.poolErrUnavailable": "The account pool is not available in this build (or its batch route is missing). Restart the app; if it persists, the plugin needs reinstalling.",
			"row.poolErrFailed": "The batch failed on the host side: {message}",
			"row.poolErrHttp": "The batch was refused (HTTP {status}). Check the plugin is up to date and try again.",
			"row.poolErrNoMembers": "No account is checked into this pool — the batch had nothing to run. Check at least one account and save.",
			"row.poolErrNoLiveMembers": "Every account checked into this pool has lost its local sign-in, so the batch had nothing to run. Sign in again in the WorkBuddy desktop app, or save to drop them.",
			"row.poolErrNoFreeModel": "This region has no zero-multiplier model to test with. Refresh the model catalog, or pick a target model yourself.",
			"row.poolErrNoCheckin": "This region has no daily check-in — the action is not offered here.",
			"row.poolErrStaleModel": "The target model is no longer offered by this region. Pick another, or switch back to automatic.",
			"row.creditsError": "Credit query unavailable: {message}",
			"row.refresh": "Refresh",
			"row.refreshing": "Refreshing…",
			"row.accountUnnamed": "Unnamed account",
			"row.accountsHint": "Choose from locally detected sign-ins. Tokens are never shown or saved in DSH settings.",
			"row.accountsRescan": "Detect accounts again",
			"row.accountsScanning": "Detecting…",
			"row.accountsWriteFailed": "The account change was not saved: {message} — the active profile's configuration file could not be updated (on Windows it may be locked by an antivirus scanner or a sync client). Your previous choice is still in effect; close whatever holds that file and try again (see docs/WINDOWS.md in the plugin repo for the exact path).",
			"row.selectionLostHint": "The saved account no longer exists locally.",
			"row.selectionLostMessage": "The account saved for this region is no longer among the local sign-ins (WorkBuddy replaced its login or cleaned up backups). Your other sign-ins are fine — pick a current one from the list above. Signing in again in the desktop app will not fix this.",
			"row.modelsTitle": "Models",
			"row.modelsSummary": "{count} enabled",
			"row.modelsDirty": "unsaved changes",
			"row.modelsRefresh": "Refresh from WorkBuddy",
			"row.modelsRefreshing": "Refreshing models…",
			"row.discard": "Discard changes",
			"row.save": "Save",
			"row.saving": "Saving…",
			"row.saveError": "Save failed: {message}",
			"row.saveContentionHint": " (The file was locked, so the write was refused — on Windows this is usually an antivirus scanner, a sync client such as OneDrive, or an editor with that file open. Close whatever holds it and save again; your edits are still here.)",
			"row.modelContext": "Maximum context {context}",
			"row.contextBudget": "DSH context budget",
			"row.modelOutput": "Output {output}",
			"row.modelRate": "{rate}x credits",
			"row.modelMultimodal": "Multimodal",
			"row.modelImage": "Image",
			"row.modelImageText": "Image input: the vendor documents this model as text-only, so a refresh leaves it unchecked. Tick it yourself only if you know it reads images.",
			"row.modelImageUnverified": "Image input unverified: no vendor source confirms this model reads images, so a refresh leaves it unchecked rather than guessing. Tick it yourself if you have verified it works.",
			"row.modelOff": "Can disable",
			"row.modelOffHint": "Offer the “off” level for this model",
			"row.modelReasoning": "Reasoning: {efforts}",
			"row.modelUnknown": "Unknown",
			"row.modelCapabilityPending": "Only capabilities advertised by WorkBuddy are shown.",
			"row.modelsTestEnabled": "Test enabled models",
			"row.modelsTestAll": "Test all models",
			"row.modelsTesting": "Testing {done}/{total}…",
			"row.modelsTestEnabledHint": "Tests every model you have ENABLED, one request each — each probe sends a real-volume request, so this spends real credit (about 0.01 per model at the default 25000-token size). Rows show their verdict as it lands. Stops early if the credential is rejected.",
			"row.modelsTestAllHint": "Tests EVERY model in this region's catalog, including the ones you have NOT enabled — so it costs noticeably more than \"test enabled models\". Same per-probe cost, same early stop on a rejected credential.",
			"row.modelsTestDone": "Done: {available} of {total} available",
			"row.modelsTestAuth": "Stopped: the credential was rejected, so every remaining model would answer the same way. Sign in again, then re-run.",
			"row.probe": "Test",
			"row.probing": "Testing…",
			"row.probeHint": "Send a real-volume request (~25k input tokens) to this model and report whether it answers right now. The upstream rate limit fires on request SIZE — measured: about 20k tokens pass, about 30k are refused — so a small request can look fine while every long-conversation request is refused. This is why every test costs real credits (about 0.7) and runs one model at a time.",
			"row.probeOk": "✓ Usable",
			"row.probeOkMs": "✓ Usable ({ms})",
			"row.probeRateLimitedUnknown": "✗ Rate limited · the upstream gave no time for when it frees up",
			"row.probeRateLimitedAt": "✗ Rate limited · usable again after {at}",
			"row.probeModelBusyUnknown": "✗ This model is loaded right now · not your account — another account will not help; wait about a minute or switch models",
			"row.probeModelBusyAt": "✗ This model is loaded right now · not your account; retry after {at}, or switch models",
			"row.probeOutOfCreditUnknown": "✗ Not enough credits · the upstream gave no time for when it frees up",
			"row.probeOutOfCreditAt": "✗ Not enough credits · quota refreshes {at}",
			"row.probeCredentialRejected": "✗ WorkBuddy refused this account's token — sign in again or pick another account",
			"row.probePolicyRejected": "✗ WorkBuddy's server refused this request under its content policy — re-signing in won't help; try the desktop app or another region/account",
			"row.probeNotFound": "✗ The upstream does not know this model",
			"row.probeUnavailable": "✗ The upstream could not be reached — no usable answer came back",
			"row.probeFailed": "✗ Test failed",
			"row.probeFailedStatus": "✗ Test failed (HTTP {status})",
			"row.probeError": "Could not run the test: {message}",
			"row.cheer": "Star on GitHub",
			"row.oauthTitle": "Add an account by QR sign-in",
			"row.oauthStart": "Sign in with QR code",
			"row.oauthStarting": "Opening…",
			"row.oauthOpenHint": "Open the sign-in page and confirm — the account is added here automatically when you finish:",
			"row.oauthOpened": "Opened. Waiting for you to finish…",
			"row.oauthWaiting": "Waiting for the sign-in to finish… ({seconds}s)",
			"row.oauthExpires": "The sign-in window expires in about {minutes} min.",
			"row.oauthCancel": "Cancel",
			"row.oauthCancelled": "Sign-in cancelled.",
			"row.oauthTimedOut": "The sign-in timed out — start again when ready.",
			"row.oauthDone": "Added “{accountName}”. Pick it above to use it.",
			"row.oauthError": "Sign-in failed: {message}",
			"row.oauthCopy": "Copy link",
			"row.oauthCopied": "Link copied",
			"row.oauthReopen": "Open page again",
			"row.oauthDialogClose": "Close",
			"row.oauthTitleGlobal": "Add an account by web sign-in",
			"row.oauthStartGlobal": "Sign in on the web",
			"row.veilHintList": "The list refreshes as soon as this finishes.",
			"row.oauthSyncing": "Adding the account…",
			"row.transferTitle": "Export / import accounts",
			"row.transferHint": "Move accounts between computers as a JSON file. The file carries the credentials — keep it private. The format is shared with other WorkBuddy credential managers.",
			"row.transferExport": "Export accounts",
			"row.transferExporting": "Exporting…",
			"row.transferExportPick": "Choose the accounts to export ({total} available):",
			"row.transferExportConfirm": "Export {count} account(s)",
			"row.transferExported": "Exported {count} account(s) to {fileName}.",
			"row.transferImport": "Import accounts",
			"row.transferImporting": "Importing…",
			"row.transferPreviewing": "Reading the file…",
			"row.transferPreviewTotal": "{total} account(s) in the file — untick what should stay out. Accounts already stored here are overwritten by the import.",
			"row.transferImportConfirm": "Import {count} account(s)",
			"row.transferImported": "Imported {imported} account(s); {skipped} skipped (no token, or belongs to the other region).",
			"row.transferEntryUnknown": "unknown account",
			"row.transferNoToken": "no token in this record",
			"row.transferCancel": "Cancel",
			"row.transferError": "Transfer failed: {message}",
			"row.poolTitle": "Account pool",
			"row.poolNoCandidate": "No account in this pool can be used right now.",
			"row.poolNoCandidateHint": "Members are rate-limited, out of credits, rejected, or unreachable. Rate limits, drained quotas and transient failures return to the pool on their own — at the time the upstream states, or after a 30-minute fallback. Only a rejected credential needs a new sign-in.",
			"row.poolModelWideBusy": "Every member is blocked on the same model — this is the model, not your accounts.",
			"row.poolModelWideBusyHint": "Switching accounts cannot help: the limit follows the model, so a different account hits the same wall. Wait about a minute, or switch to a less busy model in this session.",
			"row.poolCheckinAll": "Check in all accounts",
			"row.poolCheckingIn": "Checking in…",
			"row.poolTestAll": "Test all accounts",
			"row.poolTesting": "Testing…",
			"row.poolBusyHint": "Running one account at a time…",
			"row.poolTargetAuto": "Auto",
			"row.poolTargetStaleShort": "target model unavailable",
			"row.poolTargetNoneShort": "no free model",
			"row.poolTargetFree": "Auto-picked free model: {model}",
			"row.poolTargetPreferred": "Your chosen model: {model}",
			"row.poolTargetCurrentPreferred": "Current: {model} (your choice).",
			"row.poolTargetCurrentFree": "Current: {model} (auto-picked free model).",
			"row.poolTargetNone": "This region has no zero-multiplier model yet.",
			"row.poolTargetStale": "The target model you saved is no longer offered: {model}",
			"row.poolTargetStaleHint": "The region's catalog changed and no longer lists this model, so testing is off rather than running against a model the upstream may not accept. Pick another target, or switch back to automatic.",
			"row.poolTargetStaleClear": "Switch back to automatic",
			"row.poolTargetStaleOption": "{model} (no longer offered)",
			"row.poolTargetNoneHint": "The domestic catalog only reveals its multipliers after a model refresh. Rather than quietly spending credits on a paid model, testing stays off until one appears — refresh the models, or pick a target model yourself.",
			"row.poolColumnAccount": "Account",
			"row.poolColumnCredits": "Credits",
			"row.poolColumnProbe": "Target model",
			"row.poolColumnCheckin": "Check-in",
			"row.poolNeverTested": "Not tested yet",
			"row.poolTestedAt": "Tested {at}",
			"row.poolCheckedIn": "Checked in",
			"row.poolNotCheckedIn": "Not checked in",
			"row.poolCheckinUnknown": "—",
			"row.poolCreditSoon": "{count} expiring within 3 days",
			"row.poolCreditNearest": "Nearest package expires {at}",
			"row.poolExcludedRateLimited": "Rate limited",
			"row.poolExcludedModelBusy": "Model busy",
			"row.poolExcludedOutOfCredit": "Out of credits",
			"row.poolExcludedRejected": "Rejected",
			"row.poolExcludedUnusable": "Unusable",
			"row.poolRetryAt": "Back after {at}",
			"row.poolRetryUnknown": "The upstream gave no time for when this frees up",
			"row.remainingImminent": "any moment now",
			"row.remainingMinutes": "in about {count} min",
			"row.remainingHours": "in about {count} h",
			"row.remainingDays": "in about {count} d",
			"row.poolProbeJustNow": "just now",
			"row.poolProbeMinutesAgo": "{count} min ago",
			"row.poolProbeHoursAgo": "{count} h ago",
			"row.poolProbeDaysAgo": "{count} d ago",
			"row.poolProbeSourceTest": "tested",
			"row.poolProbeSourceLive": "hit by a live request",
			"row.poolProbeSourceUnknown": "source unknown",
			"row.poolProbeModel": "model {model}",
			"row.poolProbeModelUnknown": "model not recorded",
			"row.poolSettingsTitle": "Account pool settings",
			"row.poolSettingsHint": "These are preferences: they take effect when you save (same as the model list). Test results are written automatically and are not affected by this button.",
			"row.poolEnabled": "Enable the account pool",
			"row.poolEnabledHint": "While on, this region's pool decides who serves every request (usable first, then credits, soonest-expiring, freshest credential) and retries on another account when one fails. While off, the plugin does not pick or switch: the account you selected serves every request and a failure is reported as-is. Check-in and testing are MANUAL actions and stay available either way — the switch only controls whether the plugin decides by itself.",
			"row.poolManualAccountLabel": "Account in use",
			"row.poolManualAccountHint": "Which account serves this region while the pool is off. Turn the pool on and the ranking picks instead.",
			"row.poolManualAccountNone": "No account in effect",
			"row.poolTargetLabel": "Target test model",
			"row.poolTargetHint": "Auto (default) picks a zero-multiplier model from this region's catalog, preferring the largest context window. The two regions can pick different models. A manual choice always wins.",
			"row.poolTargetAutoOption": "Auto — pick a free model",
			"row.poolProbeSizeLabel": "Test request size",
			"row.poolProbeSizeHint": "How much text a test sends. The upstream refuses a request once it grows past roughly 20K–30K tokens, so a test smaller than your real conversations answers \"usable\" for an account that would refuse them. Bigger tests are more truthful but cost more credit each.",
			"row.poolProbeSizeDefault": "Default (25K)",
			"row.poolProbeSizeOption": "{tokens}K tokens",
			"row.poolSaved": "Save",
			"row.poolSaving": "Saving…",
			"row.poolSaveFailed": "Could not save: {message}",
			"row.poolSavedStaleRefresh": "Saved, but the panel could not re-read it. The value is stored; the next refresh will show it.",
			"row.poolDiscard": "Discard changes",
			"row.poolDirty": "● Unsaved changes",
			"row.poolManualUnlock": "Turn off rotation",
			"row.poolLogTitle": "Activity",
			"row.poolLogClear": "Clear",
			"row.poolLogEmpty": "Nothing yet. Check-ins, tests, and account switches are recorded here.",
			"row.poolLogCheckinStart": "Checking in {count} account(s), one at a time",
			"row.poolLogCheckinClaimed": "{accountName}: checked in (+{credit})",
			"row.poolLogCheckinAlready": "{accountName}: already checked in today — skipped",
			"row.poolLogCheckinFailed": "{accountName}: check-in failed — {message}",
			"row.poolLogCheckinDone": "Check-in finished",
			"row.poolLogBatchFailed": "Batch failed — nothing ran: {message}",
			"row.poolLogTestStart": "Testing {count} account(s) against {model}",
			"row.poolLogTestRow": "{accountName}: {outcome}",
			"row.poolLogTestDone": "Test finished; the pool was re-ranked",
			"row.poolLogTestRowMalformed": "{accountName}: the host returned no result for this account",
			"row.poolRegionNote": "The domestic and international pools are fully independent: accounts, switches, intervals, and target models never affect each other.",
			"row.poolMembersTitle": "Accounts in this pool",
			"row.poolMembersHint": "Only checked accounts are checked in, tested, and used for rotation. Nothing is selected by default — check the ones you want, then save.",
			"row.poolSelectAll": "Select all",
			"row.poolSelectNone": "Clear all",
			"row.poolSelectedCount": "{count} of {total} selected",
			"row.poolNoneSelected": "No account is checked into this pool.",
			"row.poolNoneSelectedHint": "Check at least one account above and save. Until then both buttons stay disabled, because a pool with no members has nothing to run on.",
			"row.poolGhostMembers": "{count} pool member(s) are no longer signed in on this machine, so they are not counted and not used: {names}. Remove any you no longer need below.",
			"row.poolGhostRemove": "Remove {account} from this pool",
			"row.poolGhostRemoveNamed": "Remove {account} from this pool. This account is no longer signed in on this machine.",
			"row.poolGhostRemoveUnnamed": "Remove {account} from this pool. No name was ever recorded for this account, so what you see is the start of its id.",
			"row.poolSelectAria": "Include {accountName} in this region's account pool",
			"row.poolMember": "In pool",
			"row.poolCurrentBadge": "In use",
			"row.poolCurrentHeader": "In use: {account}",
			"row.poolNotMember": "Not in pool",
			"row.poolUnsavedMembers": "Selection changed — save to apply",
			"row.poolRowTest": "Test",
			"row.poolRowRemove": "Remove",
			"row.poolRowRemoveHint": "Remove this account from the list. The WorkBuddy desktop app is not signed out — it keeps its own sign-in. Removing only hides the account here; 「Detect accounts again」 brings it back.",
			"row.poolRowRemoveAria": "Remove the stored credential of {accountName}",
			"row.poolRowRemoved": "{accountName}: hidden from the list. 「Detect accounts again」 re-adds it; the desktop app stays signed in.",
			"row.poolRowRemoving": "Removing the account…",
			"row.poolRowRemoveDesktopOnly": "{accountName}: hidden from the list — this account comes from the desktop app's own sign-in, which is left untouched. 「Detect accounts again」 re-adds it.",
			"row.showCreditsCn": "WB CN credits in composer",
			"row.showCreditsGlobal": "WB AI credits in composer",
			"row.showCreditsCnHint": "Show the domestic (WB CN) credit balance in the composer toolbar, but only while this session uses a WB CN model. Click it for per-account balances and a manual refresh (refreshes by itself every 5 minutes).",
			"row.creditPositionLabel": "position",
			"row.creditPositionComposer": "composer toolbar",
			"row.creditPositionStats": "below the input box",
			"row.creditPositionAria": "Credit readout position for {region}",
			"quotaNotice.fallbackHead": "The quota for this request is exhausted",
			"quotaNotice.supplement": " (some models also have a daily limit that is unrelated to your credits)",
			"row.creditPositionHint": "Where the credit readout sits. \"composer toolbar\" is the default (the row with the model picker). Choose \"below the input box\" — the row carrying the round / step / token statistics — if another plugin occupies the composer toolbar and the readout does not appear.",
			"row.showCreditsGlobalHint": "Show the international (WB AI) credit balance in the composer toolbar, but only while this session uses a WB AI model. Click it for per-account balances and a manual refresh (refreshes by itself every 5 minutes).",
			"composer.pointsCn": "WB CN",
			"composer.pointsGlobal": "WB AI",
			"composer.panelTitleCn": "WB CN credits",
			"composer.panelTitleGlobal": "WB AI credits",
			"composer.account": "Account",
			"composer.credits": "Credits",
			"composer.switchTo": "Switch to {account}",
			"composer.noAccounts": "No account in this region",
			"composer.signedOut": "Not signed in",
			"composer.refresh": "Refresh credits",
			"composer.refreshing": "Refreshing credits…",
			"composer.refreshFailed": "Could not refresh credits",
			"composer.lastRefresh": "Last refreshed",
			"composer.panelTitle": "WorkBuddy credits",
			"sidebar.creditsCn": "WB CN credits",
			"sidebar.creditsGlobal": "WB AI credits",
			"sidebar.refresh": "Refresh",
			"sidebar.refreshing": "Refreshing…",
			"sidebar.lastRefresh": "Last refreshed {time}",
			"sidebar.refreshFailed": "Refresh failed",
			"sidebar.signedOut": "Not signed in"
		};
		const zh = {
			"row.title": "接入使用 WorkBuddy 积分与模型（dsh-connect-workbuddy）",
			"row.desc": "在 DSH 中使用 WorkBuddy 模型并随时查看剩余积分；国内版与国际版是两个独立供应商，各有自己的账号，可同时使用。",
			"row.expand": "展开",
			"row.collapse": "收起",
			"row.tabCn": "国内版",
			"row.tabGlobal": "国际版",
			"row.tabHint": "每个 tab 是一个独立供应商（workbuddy / workbuddy-global），各有自己的账号、积分与模型。两边同时生效：不同会话可各选一边，一侧的改动不影响另一侧。",
			"row.tabFreeQuotaWarn": "免费模型有时间段内定额 Token 上限，并非无限制使用。",
			"row.tabSwitchHint": "取消勾选即关闭该供应商：它的模型不再出现在 DSH 模型选择器里；账号、积分与模型设置都会保留，重新勾选即恢复。",
			"row.tabSwitchAria": "是否向 DSH 提供{region}供应商",
			"row.tabOffNotice": "该供应商已关闭：它的模型不会提供给 DSH。账号、积分与模型设置均已保留——勾选上方复选框即可恢复。",
			"row.signedOutHint": "在 WorkBuddy 桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。",
			"row.signedOutWrongRegion": "找到了你的 WorkBuddy 登录信息，但它属于另一个地区的标签页。切换到上方对应标签页即可使用——不需要重新登录。",
			"row.signedOutEncrypted": "你的 WorkBuddy 登录信息在，但其中的 token 字段是加密的，插件拿不到密钥。请安装 WorkBuddy 桌面 App，或用环境变量 WORKBUDDY_APP_EXECUTABLE 指定它的可执行文件——重新登录无法解决这个问题。",
			"row.searchedTitle": "已检查的路径",
			"row.searchedHint": "如果你的 WorkBuddy 把登录信息存在别处，可以用环境变量 WORKBUDDY_AUTH_FILE 指定。",
			"row.reasonMissing": "不存在",
			"row.reasonUnreadable": "无法读取",
			"row.reasonInvalid": "没有可用的 token",
			"row.reasonEncrypted": "已加密——需要桌面 App",
			"row.reasonWrongRegion": "属于另一个地区",
			"row.sourceDesktop": "桌面 App",
			"row.sourceDsh": "插件副本",
			"row.searchedMore": "显示另外 {count} 条「不存在」的路径",
			"row.reloginHint": "出现错误，重新登录 WorkBuddy APP 即可。",
			"row.rescanHidesKept": "已删除的账号仍是隐藏状态：插件没能更新自己的名单文件。Windows 上通常是文件被占用——请关闭可能正在占用 DSH 配置目录的杀毒/同步工具后重试。",
			"row.credentialRejectedTitle": "WorkBuddy 拒绝了这个账号的 token",
			"row.credentialRejectedIntro": "「{accountName}」的 token 已不被上游接受，所以积分与签到都用不了。重新登录只在「确实是 token 的问题」时才有用——当前实际适用的是下面这一条：",
			"row.credentialRejectedSwitch": "本机另一个账号「{accountName}」刚刚实测可用，切换到它即可恢复，不必重新登录。",
			"row.credentialRejectedSwitchAction": "切换到「{accountName}」",
			"row.credentialRejectedRelogin": "本机没有其他账号可切换。请在 WorkBuddy 桌面端重新登录。",
			"row.credentialRejectedChoose": "本机还有其他账号，但刚才都没能通过上游校验。可以在上方切换一个试试；如果都不行，请在桌面端重新登录。",
			"row.requestFailed": "请求失败",
			"row.requestFailedHint": "刷新失败——下方为上次加载的数据：{message}",
			"row.poolErrUnavailable": "本版本没有可用的账号池（或其批量接口缺失）。请重启应用；若仍不行，插件可能需要重新安装。",
			"row.poolErrFailed": "批量操作在宿主侧失败：{message}",
			"row.poolErrHttp": "批量操作被拒绝（HTTP {status}）。请确认插件是最新版本后重试。",
			"row.poolErrNoMembers": "本池没有勾选任何账号，批量操作没有可执行对象。请至少勾选一个账号并保存。",
			"row.poolErrNoLiveMembers": "本池勾选的账号在本机都已不再登录，批量操作没有可执行对象。请在 WorkBuddy 桌面端重新登录，或保存以移除它们。",
			"row.poolErrNoFreeModel": "本区域没有可用的免费（倍率为 0）模型。请先刷新模型目录，或自己指定一个目标模型。",
			"row.poolErrNoCheckin": "本区域没有每日签到 —— 这里不提供该操作。",
			"row.poolErrStaleModel": "目标模型已不在本区域目录中。请改选一个，或切回自动。",
			"row.creditsError": "积分查询失败：{message}",
			"row.refresh": "刷新",
			"row.refreshing": "正在刷新…",
			"row.accountUnnamed": "未命名账号",
			"row.accountsHint": "选择本机检测到的登录账号；Token 不会显示，也不会保存到 DSH 设置。",
			"row.accountsRescan": "重新检测账号",
			"row.accountsScanning": "正在检测…",
			"row.accountsWriteFailed": "账号改动未保存：{message} —— 当前 profile 的配置文件写入失败（Windows 上可能被杀毒软件或同步盘占用）。当前仍是原来保存的选择，请先关闭占用该文件的程序再重试（文件的确切路径见插件仓库的 docs/WINDOWS.md）。",
			"row.selectionLostHint": "已保存的账号在本机已不存在。",
			"row.selectionLostMessage": "该区域保存的账号已不在本机登录列表中（WorkBuddy 更换了登录或清理了备份文件）。本机其他登录仍然可用——请在上方列表中重新选择一个当前账号。重新登录桌面端 App 无法修复此问题。",
			"row.modelsTitle": "模型",
			"row.modelsSummary": "已启用 {count} 个",
			"row.modelsDirty": "有未保存的修改",
			"row.modelsRefresh": "从 WorkBuddy 刷新",
			"row.modelsRefreshing": "正在刷新模型…",
			"row.discard": "放弃修改",
			"row.save": "保存",
			"row.saving": "保存中…",
			"row.saveError": "保存失败：{message}",
			"row.saveContentionHint": "（该文件被占用，写入被拒——Windows 上通常是杀毒软件、OneDrive 这类同步盘，或正打开该文件的编辑器。请先关闭占用者再保存一次；你的改动仍然还在。）",
			"row.modelContext": "最大上下文 {context}",
			"row.contextBudget": "DSH 上下文预算",
			"row.modelOutput": "最大输出 {output}",
			"row.modelRate": "积分 {rate}x",
			"row.modelMultimodal": "多模态",
			"row.modelImage": "图片",
			"row.modelImageText": "图片输入：厂商文档标明该模型仅支持文本，因此刷新时不会自动勾选。只有你确认它能读图，才建议手动勾上。",
			"row.modelImageUnverified": "图片输入未核实：没有厂商资料确认该模型能读图，刷新时按「不猜」处理，不会自动勾选。如果你验证过确实可用，可以手动勾上。",
			"row.modelOff": "可关闭思考",
			"row.modelOffHint": "为这个模型提供「关闭思考」档位",
			"row.modelReasoning": "推理强度：{efforts}",
			"row.modelUnknown": "未知",
			"row.modelCapabilityPending": "仅展示 WorkBuddy 接口明确公布的模型能力。",
			"row.modelsTestEnabled": "一键测试启用模型",
			"row.modelsTestAll": "一键测试所有模型",
			"row.modelsTesting": "测试中 {done}/{total}…",
			"row.modelsTestEnabledHint": "逐个测试你**已启用**的模型，一个模型一次请求 —— 每次探测都发真实体积的请求，真花积分（默认 25000 token 体积下约 0.01/个）。每行的结果一出来就显示。凭据被拒时提前停止。",
			"row.modelsTestAllHint": "测试本区域目录里的**每一个**模型，含**未启用**的 —— 所以比「仅测试启用模型」明显更贵。单次探测成本相同，凭据被拒时同样提前停止。",
			"row.modelsTestDone": "完成：{total} 个里 {available} 个可用",
			"row.modelsTestAuth": "已停止：凭据被拒，剩下的模型都会得到同一个答案。请重新登录后再跑一次。",
			"row.probe": "测试",
			"row.probing": "测试中…",
			"row.probeHint": "对该模型发一条真实体积的请求（约 25k 输入 token），报告它现在能不能用。上游的限流按请求体积触发——实测约 20k 能过、约 30k 被拒——所以小请求看着正常、长对话里却可能每次都被拒。这也是为什么每次测试都会消耗真实积分（约 0.7），且一次只测一个模型。",
			"row.probeOk": "✓ 可用",
			"row.probeOkMs": "✓ 可用（{ms}）",
			"row.probeRateLimitedUnknown": "✗ 被限流 · 上游未给出何时恢复",
			"row.probeRateLimitedAt": "✗ 被限流 · {at} 之后可再用",
			"row.probeModelBusyUnknown": "✗ 该模型当前负载较高 · 不是账号被限流——换账号没用，建议等待约 1 分钟或切换模型",
			"row.probeModelBusyAt": "✗ 该模型当前负载较高 · 不是账号被限流；{at} 之后可重试，或切换模型",
			"row.probeOutOfCreditUnknown": "✗ 积分不足 · 上游未给出何时恢复",
			"row.probeOutOfCreditAt": "✗ 积分不足 · 积分包 {at} 刷新",
			"row.probeCredentialRejected": "✗ WorkBuddy 拒绝了这个账号的 token——请重新登录或换一个账号",
			"row.probePolicyRejected": "✗ WorkBuddy 服务端按内容策略拒绝了这次请求——重新登录无效；可在桌面端验证或切换区域/账号",
			"row.probeNotFound": "✗ 上游不认识这个模型",
			"row.probeUnavailable": "✗ 连不上上游——上游没有给出可用答复",
			"row.probeFailed": "✗ 测试失败",
			"row.probeFailedStatus": "✗ 测试失败（HTTP {status}）",
			"row.probeError": "无法执行测试：{message}",
			"row.cheer": "鼓励一下",
			"row.oauthTitle": "扫码添加账号",
			"row.oauthStart": "扫码登录",
			"row.oauthStarting": "正在打开…",
			"row.oauthOpenHint": "打开登录页并完成确认——完成后账号会自动出现在这里：",
			"row.oauthOpened": "已打开，等待你完成登录…",
			"row.oauthWaiting": "正在等待登录完成…（{seconds} 秒）",
			"row.oauthExpires": "登录窗口约 {minutes} 分钟后过期。",
			"row.oauthCancel": "取消",
			"row.oauthCancelled": "已取消登录。",
			"row.oauthTimedOut": "登录超时——请重新开始。",
			"row.oauthDone": "已添加「{accountName}」。在上方选中它即可使用。",
			"row.oauthError": "登录失败：{message}",
			"row.oauthCopy": "复制链接",
			"row.oauthCopied": "已复制链接",
			"row.oauthReopen": "重新打开页面",
			"row.oauthDialogClose": "关闭",
			"row.oauthTitleGlobal": "网页登录添加账号",
			"row.oauthStartGlobal": "网页登录",
			"row.veilHintList": "完成后列表会立即刷新。",
			"row.oauthSyncing": "正在添加账号…",
			"row.transferTitle": "导出 / 导入账号",
			"row.transferHint": "用 JSON 文件在电脑之间迁移账号。文件里是账号凭据——请妥善保管。该格式与同类 WorkBuddy 凭据管理工具通用。",
			"row.transferExport": "导出账号",
			"row.transferExporting": "正在导出…",
			"row.transferExportPick": "选择要导出的账号（共 {total} 个）：",
			"row.transferExportConfirm": "导出 {count} 个账号",
			"row.transferExported": "已导出 {count} 个账号到 {fileName}。",
			"row.transferImport": "导入账号",
			"row.transferImporting": "正在导入…",
			"row.transferPreviewing": "正在读取文件…",
			"row.transferPreviewTotal": "文件中共 {total} 个账号——不需要的请取消勾选。导入会覆盖这里已存储的同名账号。",
			"row.transferImportConfirm": "导入 {count} 个账号",
			"row.transferImported": "已导入 {imported} 个账号；跳过 {skipped} 个（缺 token，或属于另一个区域）。",
			"row.transferEntryUnknown": "未知账号",
			"row.transferNoToken": "此记录没有 token",
			"row.transferCancel": "取消",
			"row.transferError": "传输失败：{message}",
			"row.poolTitle": "账号池",
			"row.poolNoCandidate": "账号池里目前没有可用的账号。",
			"row.poolNoCandidateHint": "成员要么在限流冷却中、要么积分耗尽、要么凭据被拒、要么上游无响应。限流、积分耗尽与瞬时故障都会自动回池——按上游给出的恢复时间，没给时间就按 30 分钟兜底，不需要你操作；只有「凭据被拒」需要重新登录。",
			"row.poolModelWideBusy": "所有成员都卡在同一个模型上 —— 这是模型的问题，不是你的账号。",
			"row.poolModelWideBusyHint": "换账号解决不了：限制跟随模型，换一个账号撞的是同一堵墙。等大约 1 分钟，或把这个会话切到负载较低的模型。",
			"row.poolCheckinAll": "一键签到所有账号",
			"row.poolCheckingIn": "签到中…",
			"row.poolTestAll": "一键测试所有账号",
			"row.poolTesting": "测试中…",
			"row.poolBusyHint": "正在逐个账号执行…",
			"row.poolTargetAuto": "自动",
			"row.poolTargetStaleShort": "目标模型已失效",
			"row.poolTargetNoneShort": "无免费模型",
			"row.poolTargetFree": "自动选中的免费模型：{model}",
			"row.poolTargetPreferred": "你指定的模型：{model}",
			"row.poolTargetCurrentPreferred": "当前：{model}（你指定）。",
			"row.poolTargetCurrentFree": "当前：{model}（自动挑选的免费模型）。",
			"row.poolTargetNone": "本区域暂时没有倍率为 0 的免费模型。",
			"row.poolTargetStale": "你保存的目标模型已不在目录中：{model}",
			"row.poolTargetStaleHint": "本区域的模型目录已变化，不再包含这个模型，因此测试被停用——而不是拿一个上游可能不接受的模型去跑。请改选一个目标模型，或切回自动。",
			"row.poolTargetStaleClear": "切回自动",
			"row.poolTargetStaleOption": "{model}（已下架）",
			"row.poolTargetNoneHint": "国内版的倍率要等模型目录刷新后才会出现。为了不让你在不知情的情况下花掉积分，插件不会自动改用收费模型——请先刷新模型目录，或自己指定一个目标模型。",
			"row.poolColumnAccount": "账号",
			"row.poolColumnCredits": "积分",
			"row.poolColumnProbe": "目标模型",
			"row.poolColumnCheckin": "签到",
			"row.poolNeverTested": "尚未测试",
			"row.poolTestedAt": "测试于 {at}",
			"row.poolCheckedIn": "已签到",
			"row.poolNotCheckedIn": "未签到",
			"row.poolCheckinUnknown": "—",
			"row.poolCreditSoon": "{count} 积分 3 天内过期",
			"row.poolCreditNearest": "最近积分包 {at} 过期",
			"row.poolExcludedRateLimited": "被限流",
			"row.poolExcludedModelBusy": "模型繁忙",
			"row.poolExcludedOutOfCredit": "积分耗尽",
			"row.poolExcludedRejected": "被拒绝",
			"row.poolExcludedUnusable": "不可用",
			"row.poolRetryAt": "{at} 之后可再用",
			"row.poolRetryUnknown": "上游未给出何时恢复",
			"row.remainingImminent": "即将恢复",
			"row.remainingMinutes": "约 {count} 分钟后",
			"row.remainingHours": "约 {count} 小时后",
			"row.remainingDays": "约 {count} 天后",
			"row.poolProbeJustNow": "刚刚",
			"row.poolProbeMinutesAgo": "{count} 分钟前",
			"row.poolProbeHoursAgo": "{count} 小时前",
			"row.poolProbeDaysAgo": "{count} 天前",
			"row.poolProbeSourceTest": "测得",
			"row.poolProbeSourceLive": "聊天撞上",
			"row.poolProbeSourceUnknown": "来源未知",
			"row.poolProbeModel": "模型 {model}",
			"row.poolProbeModelUnknown": "未记录模型",
			"row.poolSettingsTitle": "账号池设置",
			"row.poolSettingsHint": "下面是偏好设置：点保存才生效（与「模型管理」一致）。测试结果由插件自动写入，不受这个保存按钮影响。",
			"row.poolEnabled": "启用账号池",
			"row.poolEnabledHint": "开启后由本区域的账号池自动决定每一次请求用谁（可用优先，其次积分高、快过期的积分包、凭据更新的），失败时自动换下一个可用账号。关闭后插件不替你选、也不替你换：你选的账号服务每一次请求，失败就如实报错。签到与测试是手动动作，两种状态下都可用 —— 这个开关只管「插件要不要自己决定」。",
			"row.poolManualAccountLabel": "使用哪个账号",
			"row.poolManualAccountHint": "账号池关闭时，由你在这里选定服务本区域的账号。开启账号池后改由排序自动决定。",
			"row.poolManualAccountNone": "当前没有生效的账号",
			"row.poolTargetLabel": "目标测试模型",
			"row.poolTargetHint": "「自动」（默认）会从本区域目录里挑一个倍率为 0 的免费模型，多个候选取上下文窗口最大的。国内版与国际版可能挑到不同的模型。手动指定优先于自动。",
			"row.poolTargetAutoOption": "自动 —— 挑一个免费模型",
			"row.poolProbeSizeLabel": "测试请求体积",
			"row.poolProbeSizeHint": "测试时发送多少文本。上游在请求大约超过 2 万～3 万 token 时会开始拒绝，所以测试体积若小于你真实对话的体积，就会出现「测出可用、实际一发就被限」。体积越大测得越准，但每次测试消耗的积分也越多。",
			"row.poolProbeSizeDefault": "默认（2.5 万）",
			"row.poolProbeSizeOption": "{tokens} 万 token",
			"row.poolSaved": "保存",
			"row.poolSaving": "保存中…",
			"row.poolSaveFailed": "保存失败：{message}",
			"row.poolSavedStaleRefresh": "已保存，但面板未能重新读取。设置已写入；下次刷新后会显示。",
			"row.poolDiscard": "放弃修改",
			"row.poolDirty": "● 有未保存的修改",
			"row.poolManualUnlock": "关闭自动轮换",
			"row.poolLogTitle": "活动记录",
			"row.poolLogClear": "清空",
			"row.poolLogEmpty": "尚无活动。签到、测试与账号切换都会记录在这里。",
			"row.poolLogCheckinStart": "开始签到 {count} 个账号（逐个执行）",
			"row.poolLogCheckinClaimed": "{accountName}：签到成功 +{credit}",
			"row.poolLogCheckinAlready": "{accountName}：今日已签到，跳过",
			"row.poolLogCheckinFailed": "{accountName}：签到失败 —— {message}",
			"row.poolLogCheckinDone": "签到完成",
			"row.poolLogBatchFailed": "批量操作失败 —— 没有执行：{message}",
			"row.poolLogTestStart": "开始测试 {count} 个账号 × {model}",
			"row.poolLogTestRow": "{accountName}：{outcome}",
			"row.poolLogTestDone": "测试完成，已重新计算候选账号",
			"row.poolLogTestRowMalformed": "{accountName}：Host 未返回该账号的结果",
			"row.poolRegionNote": "国内版与国际版是完全独立的两个账号池：账号、开关、间隔、目标模型互不影响。",
			"row.poolMembersTitle": "本池包含的账号",
			"row.poolMembersHint": "只有勾选的账号才会被签到、测试和轮换。默认一个都不勾 —— 请勾选你要的账号，然后保存。",
			"row.poolSelectAll": "全选",
			"row.poolSelectNone": "全不选",
			"row.poolSelectedCount": "已选 {count} / {total}",
			"row.poolNoneSelected": "这个池里还没有勾选任何账号。",
			"row.poolNoneSelectedHint": "请在上方勾选至少一个账号并保存。在此之前两个按钮都不可用 —— 空池没有可执行的对象。",
			"row.poolGhostMembers": "有 {count} 个已选入本池的账号在本机已不再登录，因此不计入、也不会被使用：{names}。不需要的可在下方逐个移除。",
			"row.poolGhostRemove": "把 {account} 移出本池",
			"row.poolGhostRemoveNamed": "把 {account} 移出本池。该账号在本机已不再登录。",
			"row.poolGhostRemoveUnnamed": "把 {account} 移出本池。这个账号从未记录过名字，显示的是它 id 的开头几位。",
			"row.poolSelectAria": "把 {accountName} 加入本区域的账号池",
			"row.poolMember": "已在池中",
			"row.poolCurrentBadge": "当前使用",
			"row.poolCurrentHeader": "当前使用：{account}",
			"row.poolNotMember": "未入池",
			"row.poolUnsavedMembers": "勾选已改动 —— 保存后生效",
			"row.poolRowTest": "测试",
			"row.poolRowRemove": "删除",
			"row.poolRowRemoveHint": "把这个账号从列表中移除。桌面 App 不会被退出登录——它保留自己的登录状态。移除只是暂时隐藏，点「重新检测账号」即可找回。",
			"row.poolRowRemoveAria": "删除 {accountName} 的已存凭据",
			"row.poolRowRemoved": "{accountName}：已从列表中隐藏。点「重新检测账号」会重新加入，桌面 App 的登录不受影响。",
			"row.poolRowRemoving": "正在删除账号…",
			"row.poolRowRemoveDesktopOnly": "{accountName}：已从列表中隐藏——这个账号来自桌面 App 自己的登录，该登录未被改动。点「重新检测账号」会重新加入。",
			"row.showCreditsCn": "对话框显示 WB CN 积分",
			"row.showCreditsGlobal": "对话框显示 WB AI 积分",
			"row.showCreditsCnHint": "在对话输入框工具栏显示国内版（WB CN）剩余积分，仅当本会话使用 WB CN 模型时出现。点击可看各账号余额并手动刷新（每 5 分钟也会自动刷新）。",
			"row.creditPositionLabel": "位置",
			"row.creditPositionComposer": "输入框工具栏",
			"row.creditPositionStats": "输入框下方",
			"row.creditPositionAria": "{region} 的积分显示位置",
			"quotaNotice.fallbackHead": "当前请求的额度已用尽",
			"quotaNotice.supplement": "（部分模型另有每日额度，与积分无关）",
			"row.creditPositionHint": "积分显示在哪里。「输入框工具栏」是默认位置（与模型选择同一行）。如果装了别的插件后读数不显示，改成「输入框下方」—— 那是「轮次 / 步数 / token」统计所在的那一行。",
			"row.showCreditsGlobalHint": "在对话输入框工具栏显示国际版（WB AI）剩余积分，仅当本会话使用 WB AI 模型时出现。点击可看各账号余额并手动刷新（每 5 分钟也会自动刷新）。",
			"composer.pointsCn": "WB CN",
			"composer.pointsGlobal": "WB AI",
			"composer.panelTitleCn": "WB CN 积分",
			"composer.panelTitleGlobal": "WB AI 积分",
			"composer.account": "账号",
			"composer.credits": "积分",
			"composer.switchTo": "切换到 {account}",
			"composer.noAccounts": "该区域暂无账号",
			"composer.signedOut": "未登录",
			"composer.refresh": "刷新积分",
			"composer.refreshing": "正在刷新积分…",
			"composer.refreshFailed": "积分刷新失败",
			"composer.lastRefresh": "最近刷新",
			"composer.panelTitle": "WorkBuddy 积分",
			"sidebar.creditsCn": "WB CN 积分",
			"sidebar.creditsGlobal": "WB AI 积分",
			"sidebar.refresh": "刷新",
			"sidebar.refreshing": "刷新中…",
			"sidebar.lastRefresh": "最近刷新 {time}",
			"sidebar.refreshFailed": "刷新失败",
			"sidebar.signedOut": "未登录"
		};
		//#endregion
		//#region src/client/index.tsx
		/**
		* Browser half: WorkBuddy credits and model management inside Plugin
		* configuration.
		*
		* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
		*   — 浏览器插件的注册形态（`slots` / `locale` / `settingsScope` 三项注入、
		*     `LocaleNamespaceMap` 的模块增强、`settings.plugin.item` 槽位与
		*     `key` / `priority` 的 rc.7 写法、以及整个 apply 体包 try/catch
		*     以便槽位 API 变更时降级为 console.error 而不触发
		*     "Failed to load plugins" 红色横幅）来自该项目，
		*     其亦注明沿用 corrinehu/dsh-workbuddy-connect 的同一模式。
		* 改动：无实质改动，仅改为本插件的命名空间与组件名。
		*
		* NOTE: the try/catch boundary of this function is mirrored (duplicated) in
		* `tests/client-fallback.spec.ts`, because the real client entry imports
		* browser-only DSH packages that cannot load in the Node test environment.
		* That test therefore does not import this function — it replicates its
		* shape. If you change the guarded body or the `console.error` message here,
		* update the mirrored `apply()` in that spec too, or the fallback test will
		* silently diverge from this real implementation.
		*
		* @module dsh-connect-workbuddy/client
		*/
		/** Stable browser-plugin name. */
		const name = "dsh-connect-workbuddy-client";
		/**
		* Client services required by the Plugin configuration contribution.
		*
		* Deliberately only the two services that exist on BOTH host lines. The
		* settings surface differs by line — 0.1.5 provides `settingsScope`, 0.1.7
		* replaces it with `configForms` — and Cordis' dependency gate is hard: any
		* inject entry the running line does not provide keeps `apply` from ever
		* running. Probing both via `ctx.get()` (which returns undefined, never
		* throws, for an absent service) is what lets one build serve both lines.
		*/
		const inject = ["slots", "locale"];
		/** Register card copy and the WorkBuddy card under Plugin configuration. */
		function apply(ctx) {
			try {
				const namespace = "settings.workbuddy";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-connect-workbuddy: settings copy");
				const t = ctx.locale.bind(namespace);
				const softGet = (name) => ctx.get(name);
				let settingsScope;
				const forms = softGet("configForms");
				/**
				* Register one card slot; returns its disposer, or undefined if it failed.
				*
				* `ctx.slots.inject(name, …)` resolves as soon as the slot is DECLARED (the
				* Plugins page declares all three ledgers — `plugins.item`,
				* `plugins.bundle.config`, `plugins.row.config` — as children of its own
				* registration), and is otherwise queued until a later declaration. So a
				* registration here is not lost just because the page has not mounted yet.
				*/
				const registerCard = (slotName, key) => {
					try {
						return ctx.slots.inject(slotName, () => ctx.slots.register({
							name: slotName,
							key,
							priority: 30,
							inject: () => settingsScope === void 0 ? { t } : {
								t,
								settingsScope
							}
						}, WorkBuddyCard));
					} catch (error) {
						console.error(`[dsh-connect-workbuddy] card slot "${slotName}" failed to register (host provider unaffected):`, error);
						return;
					}
				};
				/**
				* Credit readout in the composer tool row (`conversation.input.left`, a
				* session-scope list slot).
				*
				* 参考：dingminhua/dsh-connect-trae（MIT，Copyright (c) 2026 LaoDing）
				*   — 该项目的 `registerComposerPoints`：无条件注册插槽、由 gate 读
				*     `modelSelection` 投影自行决定是否渲染。本项目原先放在侧边栏底部
				*     （`sidebar.footer.action`），那里是**单个 root 级共享行**，两个连接器
				*     插件各占一行会互相挤压；输入框这行是 per-session 且按 provider 归属，
				*     天然只有一个插件的积分相关。
				*
				* Provider-scoped on purpose: it renders only while the session's selected
				* model belongs to this plugin, which is what keeps two connector plugins
				* from competing for one shared row. Registration is unconditional; the
				* gate reads the Host's `modelSelection` projection and returns null for
				* every other provider, so nothing is drawn and no fetch loop starts while
				* another provider is selected.
				*/
				const registerComposerCredits = () => {
					try {
						return ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
							name: "conversation.input.left",
							id: "dsh-connect-workbuddy-composer-credits",
							order: 4,
							locale: namespace,
							inject: () => settingsScope === void 0 ? {
								t,
								position: "composer"
							} : {
								t,
								position: "composer",
								settingsScope
							}
						}, ComposerCreditsGate));
					} catch (error) {
						console.error("[dsh-connect-workbuddy] composer credits slot failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* The SAME readout in the ambient dock below the composer card (issue #62).
				*
				* Registered unconditionally, like the composer seat, because the CHOICE
				* between the two seats lives in the gate: it renders in the seat the
				* setting names and returns null in the other. Registering only the chosen
				* seat would mean re-registering on every settings change, and the seat is
				* exactly the kind of thing a user flips once while looking at the result.
				*
				* WHY THIS SEAT EXISTS: the composer tool row is a list seat shared with any
				* other plugin that registers there, and issue #62 is one report of the
				* readout disappearing when another plugin was installed. This row is where
				* the shell renders its own round/step/token pills, so it is a place a user
				* already reads session numbers from.
				*
				* `order` places it after the shell's own pills (`stats` registers at 0), so
				* the shipped statistics stay leftmost and the readout reads as an addition
				* rather than a replacement.
				*/
				const registerStatsCredits = () => {
					try {
						return ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
							name: "conversation.composer.dock",
							id: "dsh-connect-workbuddy-stats-credits",
							order: 10,
							locale: namespace,
							inject: () => settingsScope === void 0 ? {
								t,
								position: "stats"
							} : {
								t,
								position: "stats",
								settingsScope
							}
						}, ComposerCreditsGate));
					} catch (error) {
						console.error("[dsh-connect-workbuddy] stats credits slot failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* The frame-wide quota notice, DECLINED so the host keeps its own Toast
				* (issue #63 follow-up, the maintainer's call on a screenshot).
				*
				* WHAT WAS WRONG. The previous build claimed `QUOTA` and rendered the
				* supplement as an inline `<span>` in this seat. The chain's own contract
				* says a claiming entry "takes over the surface" — so claiming REPLACED the
				* host's generic warning Toast, and the replacement was not a Toast: an
				* inline span has no `position: fixed`, no centring, no background and no
				* fade, so it parked at the TOP-LEFT of `shell.overlay` (an `inset: 0`
				* layer) and stayed there until the next notice. The maintainer read it, on
				* screen, as a box that had not been there before — and it had not.
				*
				* WHY DECLINING IS THE FIX, not a worse one. The host's own sentence is
				* already correct and already appears in the turn's failure row inside the
				* conversation (`message.failure.quota`, via `failureMessage` in
				* `ui-chat`'s MessageItem) — the place the user is actually reading when a
				* turn fails. Taking over the frame-wide surface bought this plugin nothing
				* except a second, uglier copy of a sentence the host already draws where it
				* matters. Declining the claim returns the seat to the host: the Toast is
				* the host's own design, and this plugin stops imposing a look on a surface
				* it does not own.
				*
				* The supplement itself is NOT lost — it rides in the conversation, which is
				* the only surface that is actually in the user's eyeline (see
				* `registerStatsCredits` and the failure row). The `select` below is
				* therefore an explicit, documented DECLINE of every code rather than a
				* deletion of the registration: the seat stays claimed in one place with its
				* rationale attached, so a future reader does not re-add the takeover
				* without re-reading why it was removed.
				*/
				const registerQuotaNotice = () => {
					try {
						return ctx.slots.inject("shell.quota-notice", () => ctx.slots.register({
							name: "shell.quota-notice",
							locale: namespace,
							select: selectQuotaNoticeClaim,
							inject: () => ({ t })
						}, WorkBuddyQuotaNotice));
					} catch (error) {
						console.error("[dsh-connect-workbuddy] quota notice slot failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* Every slot this plugin contributes, and how to (re)create them.
				*
				* Kept as one list because the binding of `settingsScope` and the slot
				* registrations must move TOGETHER: see {@link bindSettingsScope} for why a
				* late-arriving namespace has to produce fresh registrations rather than a
				* mutated closure.
				*
				* The card registers under EVERY spelling of its package name (see
				* {@link WORKBUDDY_CARD_KEYS}): the Plugins page looks a
				* configuration up by exact `key` equality against the inventory's package
				* name, and a deployment is free to name the install row whatever it likes
				* — issue #55 is exactly that mismatch, which renders an empty page and
				* reports nothing at all.
				*/
				const registerAllSlots = () => [
					...WORKBUDDY_CARD_KEYS.map((key) => registerCard("plugins.bundle.config", key)),
					...WORKBUDDY_CARD_KEYS.map((key) => registerCard("plugins.row.config", `${key}#${key}`)),
					registerComposerCredits(),
					registerStatsCredits(),
					registerQuotaNotice()
				].filter((disposer) => disposer !== void 0);
				/**
				* Disposers of the slots registered for the CURRENT binding.
				*
				* Declared before {@link bindSettingsScope} because that function closes
				* over it and reassigns it; the binding is only armed at the end of `apply`,
				* so this is initialised by then either way — hoisting it keeps that
				* ordering a non-requirement rather than a trap.
				*/
				let liveDisposers = [];
				/**
				* Replace the live registrations with a fresh set.
				*
				* ORDER MATTERS: dispose FIRST, then register.
				*
				* The ledger is a KEYED slot with one entry per `key` per priority, so
				* registering a key that is still live THROWS (`already has an entry for
				* key …`). Every registration in this entry is isolated by its own
				* try/catch, so the failure is not visible — the throw is logged and the
				* key is simply left with NO entry, because the old one was just disposed
				* by the `previous` loop. Registering before disposing therefore produces
				* an EMPTY ledger, which is a worse version of the very defect this
				* function exists to prevent.
				*/
				const rebindSlots = () => {
					for (const dispose of liveDisposers) try {
						dispose();
					} catch {}
					liveDisposers = [];
					liveDisposers = registerAllSlots();
					try {
						console.info(`[dsh-connect-workbuddy] registered ${String(liveDisposers.length)} slots (settings form: ${settingsScope === void 0 ? "none — card is read-only" : "bound"})`);
					} catch {}
				};
				/**
				* Bind `settingsScope` to whichever namespace the Host really serves, and
				* RE-REGISTER every slot when that answer changes.
				*
				* Why this is not a one-shot read at startup — the shipped 4.3.0 defect
				* (issue #46): the mirror is filled by an async `remote.settings.describe()`,
				* so at `apply` time `view` is usually still absent. The old code read that
				* absence as "the declared name must be right", bound
				* `forms.get('workbuddy')`, and never looked again. `ConfigFormController.
				* derive()` matches the namespace EXACTLY, so the guessed form stayed
				* `unavailable` forever; the composer gate — reading only that scope —
				* judged the opt-out switch `undefined !== false` and kept rendering the
				* readout. Unticking the box wrote `false` correctly and changed nothing on
				* screen.
				*
				* `whileServed` is the Host's own idiom for this (`mirror.subscribe` plus an
				* immediate sync). It is strictly better than re-reading the snapshot by
				* hand because it ALSO withdraws the binding if the Host stops serving our
				* namespace, and it hands `register` the set of namespaces actually served
				* — so the choice is made from live data instead of a captured guess.
				*
				* `register` runs on the unserved→served EDGE, not on every mirror update
				* (see the service's `sync`), so the disposal below is not a churn loop: it
				* clears whatever a previous edge left registered. That replacement is NOT
				* optional, because the renderer caches each entry's inject result by object
				* identity (`rootInjectCache` / `cachedRootInject` in
				* `dsh-client-ui-renderer`: `if (!props) { props = runInject(...) }`), so an
				* entry registered before the mirror landed is never re-evaluated. Late
				* binding can therefore only work if the OLD registrations are disposed and
				* NEW ones created — which is what this callback does.
				*/
				const bindSettingsScope = () => {
					if (forms === void 0 || typeof forms.whileServed !== "function") {
						settingsScope = forms?.get(WORKBUDDY_SETTINGS_NS);
						liveDisposers = registerAllSlots();
						return;
					}
					ctx.effect(() => forms.whileServed(WORKBUDDY_SETTINGS_NAMESPACE_CANDIDATES, (served) => {
						const ns = WORKBUDDY_SETTINGS_NAMESPACE_CANDIDATES.find((candidate) => served.has(candidate)) ?? [...served].find((entry) => /workbuddy/i.test(entry));
						settingsScope = ns === void 0 ? void 0 : forms.get(ns);
						rebindSlots();
						return () => {
							for (const dispose of liveDisposers) try {
								dispose();
							} catch {}
							liveDisposers = [];
						};
					}), "dsh-connect-workbuddy: settings namespace binding");
					rebindSlots();
				};
				bindSettingsScope();
			} catch (error) {
				console.error("[dsh-connect-workbuddy] client card failed to load (host provider unaffected):", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
