import type { SubscriptionProvider, UsageWindow } from './SubscriptionsSection.js';
/**
 * The slice of a model catalog entry this presentation filter needs: the wire
 * id the saved selection stores, plus the display name some providers put in
 * a window's `scope` (Claude's usage endpoint names a family like `Opus`).
 */
export interface UsageWindowModelRef {
    id: string;
    name?: string;
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
export declare function visibleUsageWindows(provider: SubscriptionProvider, windows: UsageWindow[] | undefined, visibleModels: readonly string[] | undefined, models?: readonly UsageWindowModelRef[], accountModels?: readonly string[] | undefined): UsageWindow[];
/**
 * Format a usage share without inventing precision: whole numbers stay whole
 * (`59%`), anything else keeps one decimal (`7.5%`). Rounding 7.5 to 8 was
 * reading as a different quota next to the provider's own 92.5% remaining.
 * @param value - the share in percent.
 * @returns the display string.
 */
export declare function formatUsagePercent(value: number): string;
