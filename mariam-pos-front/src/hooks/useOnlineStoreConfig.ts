import { useCallback, useEffect, useState } from 'react';
import { setOnlineStoreApiBaseUrl } from '../api/onlineStoreOrders';
import {
  getOnlineStoreConfig,
  type OnlineStoreConfig,
} from '../api/onlineStoreConfig';

/**
 * Pure visibility predicate for online store features.
 *
 * Online store features (the "Cobrar en línea" button and the store module
 * access) are visible if and only if a configuration exists for the current
 * branch AND its `enabled` flag is `true`. Any other case (no config, disabled,
 * network error) hides the features — safe degradation (Req 6.4, 7.1-7.5).
 */
export const computeOnlineStoreVisible = (
  config: OnlineStoreConfig | null
): boolean => Boolean(config) && config?.enabled === true;

/**
 * Runtime shape exposed by {@link useOnlineStoreConfig}.
 *
 * Carries the resolved configuration plus the derived values the rest of the
 * app consumes instead of the former hardcoded constants (Req 6.1-6.3).
 */
export interface OnlineStoreRuntime {
  loading: boolean;
  config: OnlineStoreConfig | null;
  /** True iff a config exists for the current branch and `enabled === true`. */
  isOnlineStoreVisible: boolean;
  username: string | null;
  apiUrl: string | null;
  productsEndpoint: string | null;
  salesEndpoint: string | null;
  reload: () => void;
}

/** Reads the current branch name from localStorage (empty string if absent). */
const getCurrentBranch = (): string => localStorage.getItem('sucursal') ?? '';

/**
 * Loads the online store configuration for the current branch and derives the
 * runtime values that replace the former hardcoded URL and credentials.
 *
 * Behavior:
 * - Reads the branch from `localStorage` key `sucursal`.
 * - Loads the config via {@link getOnlineStoreConfig}; manages a `loading` flag.
 * - On empty branch or network error, `config` stays `null` and
 *   `isOnlineStoreVisible` is `false` (safe degradation — Req 6.4, 7.*).
 * - When the config provides `apiUrl`, propagates it to the axios client via
 *   {@link setOnlineStoreApiBaseUrl} without recreating the instance (Req 6.1).
 */
export function useOnlineStoreConfig(): OnlineStoreRuntime {
  const [config, setConfig] = useState<OnlineStoreConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    const branch = getCurrentBranch();

    // Empty branch -> no valid config to query; degrade safely.
    if (branch === '') {
      setConfig(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const resolved = await getOnlineStoreConfig(branch);
      setConfig(resolved);
      // Propagate the resolved API URL to the axios client (Req 6.1).
      if (resolved?.apiUrl) {
        setOnlineStoreApiBaseUrl(resolved.apiUrl);
      }
    } catch {
      // Network/error -> hide online store features instead of failing (Req 7).
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return {
    loading,
    config,
    isOnlineStoreVisible: computeOnlineStoreVisible(config),
    username: config?.username ?? null,
    apiUrl: config?.apiUrl ?? null,
    productsEndpoint: config?.productsEndpoint ?? null,
    salesEndpoint: config?.salesEndpoint ?? null,
    reload,
  };
}
