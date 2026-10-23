import { getAxiosClient } from "./axiosClient";

/**
 * Public online store configuration for a branch, as returned by the backend.
 *
 * The password is never exposed in clear text: the API only reports whether a
 * credential is stored via `hasPassword`.
 */
export interface OnlineStoreConfig {
  branch: string;
  enabled: boolean;
  apiUrl: string | null;
  storeName: string | null;
  username: string | null;
  productsEndpoint: string | null;
  salesEndpoint: string | null;
  /** Indicates whether a stored credential exists (never the value itself). */
  hasPassword: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payload for saving (upserting) a branch configuration.
 *
 * The password is write-only and optional: when omitted, the backend keeps the
 * previously stored credential.
 */
export interface OnlineStoreConfigPayload {
  branch: string;
  enabled: boolean;
  apiUrl?: string | null;
  storeName?: string | null;
  username?: string | null;
  /** Only sent when the admin types a new password. */
  password?: string;
  productsEndpoint?: string | null;
  salesEndpoint?: string | null;
}

/**
 * Backend response shape for the config endpoints: the public fields plus an
 * `exists` flag that is not part of the exposed configuration type.
 */
type OnlineStoreConfigResponse = OnlineStoreConfig & { exists?: boolean };

/** Extracts the public config fields, dropping the transport-only `exists` flag. */
const toOnlineStoreConfig = (
  data: OnlineStoreConfigResponse
): OnlineStoreConfig => ({
  branch: data.branch,
  enabled: data.enabled,
  apiUrl: data.apiUrl ?? null,
  storeName: data.storeName ?? null,
  username: data.username ?? null,
  productsEndpoint: data.productsEndpoint ?? null,
  salesEndpoint: data.salesEndpoint ?? null,
  hasPassword: Boolean(data.hasPassword),
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

/**
 * Fetches the online store configuration for a branch.
 *
 * Returns `null` when no configuration exists for the branch (HTTP 404).
 */
export const getOnlineStoreConfig = async (
  branch: string
): Promise<OnlineStoreConfig | null> => {
  try {
    const clientAxios = await getAxiosClient();
    const { data } = await clientAxios.get<OnlineStoreConfigResponse>(
      `/online-store-config/${encodeURIComponent(branch)}`
    );
    return toOnlineStoreConfig(data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Creates or updates (upsert) the online store configuration for a branch.
 */
export const saveOnlineStoreConfig = async (
  payload: OnlineStoreConfigPayload
): Promise<OnlineStoreConfig> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<OnlineStoreConfigResponse>(
    "/online-store-config",
    payload
  );
  return toOnlineStoreConfig(data);
};
