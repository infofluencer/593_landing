/**
 * Shared Meta action / funnel / video helpers (insights + ads + UI).
 */
export function mapActions(
  raw: Array<{ action_type?: string; value?: string }> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of raw ?? []) {
    if (!a.action_type) continue;
    out[a.action_type] = Number(a.value ?? 0);
  }
  return out;
}

/** Meta video_* fields are action arrays — fold into actions map. */
export function mergeVideoActions(
  actions: Record<string, number>,
  row: {
    video_play_actions?: Array<{ action_type?: string; value?: string }>;
    video_thruplay_watched_actions?: Array<{
      action_type?: string;
      value?: string;
    }>;
    video_p25_watched_actions?: Array<{ action_type?: string; value?: string }>;
    video_p50_watched_actions?: Array<{ action_type?: string; value?: string }>;
    video_p75_watched_actions?: Array<{ action_type?: string; value?: string }>;
    video_p100_watched_actions?: Array<{ action_type?: string; value?: string }>;
  },
): Record<string, number> {
  const out = { ...actions };
  const add = (
    key: string,
    list?: Array<{ action_type?: string; value?: string }>,
  ) => {
    let n = 0;
    for (const a of list ?? []) n += Number(a.value ?? 0);
    if (n > 0) out[key] = (out[key] ?? 0) + n;
  };
  add("video_play", row.video_play_actions);
  add("video_thruplay", row.video_thruplay_watched_actions);
  add("video_p25", row.video_p25_watched_actions);
  add("video_p50", row.video_p50_watched_actions);
  add("video_p75", row.video_p75_watched_actions);
  add("video_p100", row.video_p100_watched_actions);
  return out;
}

export const META_INSIGHT_BASE_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "actions",
  "action_values",
  "video_play_actions",
  "video_thruplay_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
] as const;

function firstPositive(
  map: Record<string, number>,
  keys: string[],
): number {
  for (const k of keys) {
    const v = map[k];
    if (v != null && v > 0) return v;
  }
  return 0;
}

function sumKeys(map: Record<string, number>, keys: string[]): number {
  let total = 0;
  for (const k of keys) {
    if (map[k] != null) total += map[k]!;
  }
  return total;
}

const VIEW_KEYS = [
  "omni_view_content",
  "view_content",
  "offsite_conversion.fb_pixel_view_content",
  "onsite_web_view_content",
  "onsite_conversion.view_content",
];

const CART_KEYS = [
  "omni_add_to_cart",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "onsite_web_add_to_cart",
  "onsite_conversion.add_to_cart",
];

const CHECKOUT_KEYS = [
  "omni_initiated_checkout",
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_conversion.initiate_checkout",
];

const PURCHASE_KEYS = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_conversion.purchase",
  "onsite_web_app_purchase",
  "onsite_app_purchase",
  "web_in_store_purchase",
];

export type MetaFunnel = {
  viewContent: number;
  addToCart: number;
  checkout: number;
  purchase: number;
  purchaseValue: number;
};

export function deriveMetaFunnel(
  actions: Record<string, number>,
  actionValues: Record<string, number> = {},
): MetaFunnel {
  return {
    viewContent: firstPositive(actions, VIEW_KEYS),
    addToCart: firstPositive(actions, CART_KEYS),
    checkout: firstPositive(actions, CHECKOUT_KEYS),
    purchase: firstPositive(actions, PURCHASE_KEYS),
    purchaseValue: firstPositive(actionValues, PURCHASE_KEYS),
  };
}

export function sumMetaFunnel(parts: MetaFunnel[]): MetaFunnel {
  return parts.reduce(
    (acc, p) => ({
      viewContent: acc.viewContent + p.viewContent,
      addToCart: acc.addToCart + p.addToCart,
      checkout: acc.checkout + p.checkout,
      purchase: acc.purchase + p.purchase,
      purchaseValue: acc.purchaseValue + p.purchaseValue,
    }),
    {
      viewContent: 0,
      addToCart: 0,
      checkout: 0,
      purchase: 0,
      purchaseValue: 0,
    },
  );
}

export type MetaVideoTotals = {
  plays: number;
  thruplay: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};

export function deriveMetaVideo(
  actions: Record<string, number>,
): MetaVideoTotals {
  return {
    plays: actions.video_play ?? 0,
    thruplay: actions.video_thruplay ?? 0,
    p25: actions.video_p25 ?? 0,
    p50: actions.video_p50 ?? 0,
    p75: actions.video_p75 ?? 0,
    p100: actions.video_p100 ?? 0,
  };
}

export function sumMetaVideo(parts: MetaVideoTotals[]): MetaVideoTotals {
  return parts.reduce(
    (acc, p) => ({
      plays: acc.plays + p.plays,
      thruplay: acc.thruplay + p.thruplay,
      p25: acc.p25 + p.p25,
      p50: acc.p50 + p.p50,
      p75: acc.p75 + p.p75,
      p100: acc.p100 + p.p100,
    }),
    { plays: 0, thruplay: 0, p25: 0, p50: 0, p75: 0, p100: 0 },
  );
}

export { sumKeys, firstPositive, PURCHASE_KEYS };
