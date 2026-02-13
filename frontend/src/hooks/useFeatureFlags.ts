import { useEffect, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

export interface FeatureFlags {
  ai_enabled: boolean;
  ai_features: {
    scenario_generation?: boolean;
    correlation_enrichment?: boolean;
    natural_language_search?: boolean;
    gap_analysis?: boolean;
    entry_assist?: boolean;
  };
}

const DEFAULT_FLAGS: FeatureFlags = {
  ai_enabled: false,
  ai_features: {},
};

let cachedFlags: FeatureFlags | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 min

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(cachedFlags ?? DEFAULT_FLAGS);
  const [loading, setLoading] = useState(!cachedFlags);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/config/features`);
      if (res.ok) {
        const data: FeatureFlags = await res.json();
        cachedFlags = data;
        cacheTime = Date.now();
        setFlags(data);
      }
    } catch {
      // Silently fail — AI features will be hidden
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedFlags || Date.now() - cacheTime > CACHE_TTL_MS) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  return {
    flags,
    loading,
    refresh,
    aiEnabled: flags.ai_enabled,
    hasFeature: (name: keyof FeatureFlags["ai_features"]) =>
      flags.ai_enabled && !!flags.ai_features[name],
  };
}
