/** Case-insensitive exact match, or the family form a scope like `Opus` implies. */
function scopeMatchesModel(scope, model) {
    if (model.id === scope)
        return true;
    const name = (model.name ?? model.id).toLowerCase();
    const wanted = scope.toLowerCase();
    return name === wanted || name.startsWith(`${wanted} `);
}
/**
 * Presentation only: never trim the raw snapshots used by quota/routing logic.
 *
 * Drops the quota windows of models the user disabled in **Edit model list**
 * (`visibleModels`), so a disabled model stops showing up in the usage list and
 * in the composer badge. Rules:
 *
 * - An absent selection (`visibleModels` provider-wide, `accountModels` for one
 *   account) means "follow discovery" — nothing is disabled there.
 * - The two selections intersect: a window shows only when the model is enabled
 *   in BOTH the provider picker and the account's own model list, which is what
 *   the user unchecked.
 * - Windows without a `scope` are account-wide quotas; no single model owns
 *   them and no selection can disable them.
 * - A scope that resolves to an enabled model stays. Resolution uses the saved
 *   ids first, then — when the caller supplies the catalog — the display names
 *   a provider may use instead (`Opus` → every `Opus …` model).
 * - An unresolved scope is dropped for `antigravity`, whose scopes are always
 *   model ids (so an unknown id is simply not selected), and kept for providers
 *   that scope quotas by family: hiding what cannot be attributed would lose
 *   real quota information.
 *
 * @param provider - The subscription provider the windows belong to.
 * @param windows - Raw usage windows as reported by the `usage` endpoint.
 * @param visibleModels - Saved picker selection; `undefined` means automatic.
 * @param models - Optional catalog for name-style scopes (never fetched here).
 * @param accountModels - One account's own saved model list (`poolModels`);
 *   `undefined` means every model, `[]` hides every model-scoped window.
 * @returns A new array when filtering applies; the input array otherwise.
 */
export function visibleUsageWindows(provider, windows, visibleModels, models, accountModels) {
    const all = windows ?? [];
    if (visibleModels === undefined && accountModels === undefined)
        return all;
    const picker = visibleModels === undefined ? undefined : new Set(visibleModels);
    const account = accountModels === undefined ? undefined : new Set(accountModels);
    // A model must be enabled in both lists; a missing list imposes no restriction.
    const enabled = new Set([...(picker ?? account ?? [])].filter(id => picker?.has(id) !== false && account?.has(id) !== false));
    const kept = all.filter(window => {
        const scope = window.scope;
        if (scope === undefined || scope === '')
            return true;
        if (enabled.has(scope))
            return true;
        if (models !== undefined) {
            const candidates = models.filter(model => scopeMatchesModel(scope, model));
            if (candidates.length > 0)
                return candidates.some(model => enabled.has(model.id));
        }
        return provider !== 'antigravity';
    });
    // Keep the caller's array identity when nothing was hidden: callers compare
    // the filtered list with the reported one to tell "no selection" from
    // "selection hides everything".
    return kept.length === all.length ? all : kept;
}
/**
 * Format a usage share without inventing precision: whole numbers stay whole
 * (`59%`), anything else keeps one decimal (`7.5%`). Rounding 7.5 to 8 was
 * reading as a different quota next to the provider's own 92.5% remaining.
 * @param value - the share in percent.
 * @returns the display string.
 */
export function formatUsagePercent(value) {
    const clamped = Math.min(100, Math.max(0, value));
    const rounded = Math.round(clamped * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
