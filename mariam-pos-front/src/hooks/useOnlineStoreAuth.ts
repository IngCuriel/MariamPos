import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  loginOnlineStore,
  removeOnlineStoreToken,
  getOnlineStoreUser,
  isOnlineStoreAuthenticated,
  ONLINE_STORE_UNAUTHORIZED_EVENT,
} from '../api/onlineStoreOrders';
import { useOnlineStoreConfig } from './useOnlineStoreConfig';

export const OFFLINE_LOGIN_MESSAGE = 'Revisa tu conexión a Internet.';

type OnlineStoreUser = Record<string, unknown> | null;

function isNetworkLoginFailure(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      return true;
    }
    if (!err.response && typeof err.message === 'string' && err.message.toLowerCase().includes('network')) {
      return true;
    }
  }
  return false;
}

export interface UseOnlineStoreAuthResult {
  isAuthenticated: boolean;
  user: OnlineStoreUser;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  loginLoading: boolean;
  loginError: string | null;
  browserOnline: boolean;
  login: (e?: React.FormEvent) => Promise<void>;
  logout: () => void;
}

/**
 * Encapsula el login/logout contra la API de tienda en línea (compartida con recargas).
 * Reutiliza el token en localStorage: si el cajero ya inició sesión en otro módulo,
 * `isAuthenticated` arranca en true.
 */
export function useOnlineStoreAuth(): UseOnlineStoreAuthResult {
  // El usuario se prellenar desde la configuración de tienda online por sucursal
  // (OnlineStoreConfig.username); la contraseña nunca se precarga ni se hardcodea.
  const { username: configUsername } = useOnlineStoreConfig();

  const [isAuthenticated, setIsAuthenticated] = useState(() => isOnlineStoreAuthenticated());
  const [user, setUser] = useState<OnlineStoreUser>(() => getOnlineStoreUser());
  const [email, setEmailState] = useState('');
  const [password, setPassword] = useState('');
  // Marca si el cajero ya editó el email manualmente, para no pisarlo al
  // resolver la config de forma asíncrona.
  const [emailTouched, setEmailTouched] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [browserOnline, setBrowserOnline] = useState(
    () => globalThis.navigator?.onLine ?? true,
  );

  // Envoltorio de setEmail: cualquier edición manual marca `emailTouched`.
  const setEmail = useCallback((value: string) => {
    setEmailTouched(true);
    setEmailState(value);
  }, []);

  // Prellena el email con el username de la config cuando resuelve, salvo que el
  // cajero ya haya escrito algo en el campo.
  useEffect(() => {
    if (!emailTouched && configUsername) {
      setEmailState(configUsername);
    }
  }, [configUsername, emailTouched]);

  useEffect(() => {
    const syncOnline = () => {
      setBrowserOnline(globalThis.navigator?.onLine ?? true);
    };
    globalThis.addEventListener?.('online', syncOnline);
    globalThis.addEventListener?.('offline', syncOnline);
    return () => {
      globalThis.removeEventListener?.('online', syncOnline);
      globalThis.removeEventListener?.('offline', syncOnline);
    };
  }, []);

  const login = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setLoginError(null);

      if (globalThis.navigator?.onLine === false) {
        setLoginError(OFFLINE_LOGIN_MESSAGE);
        return;
      }

      setLoginLoading(true);
      try {
        const response = await loginOnlineStore(email, password);
        setUser(response.user as Record<string, unknown>);
        setIsAuthenticated(true);
        setEmailState(configUsername ?? '');
        setEmailTouched(false);
        setPassword('');
      } catch (err: unknown) {
        if (isNetworkLoginFailure(err)) {
          setLoginError(OFFLINE_LOGIN_MESSAGE);
        } else {
          const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
          setLoginError(message);
        }
      } finally {
        setLoginLoading(false);
      }
    },
    [email, password, configUsername],
  );

  const logout = useCallback(() => {
    removeOnlineStoreToken();
    setIsAuthenticated(false);
    setUser(null);
    setEmailState(configUsername ?? '');
    setEmailTouched(false);
    setPassword('');
    setLoginError(null);
  }, [configUsername]);

  // Desloguea la UI en el acto cuando el interceptor detecta un 401 (token expirado).
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUser(null);
      setEmailState(configUsername ?? '');
      setEmailTouched(false);
      setPassword('');
    };
    globalThis.addEventListener?.(ONLINE_STORE_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      globalThis.removeEventListener?.(ONLINE_STORE_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [configUsername]);

  return {
    isAuthenticated,
    user,
    email,
    password,
    setEmail,
    setPassword,
    loginLoading,
    loginError,
    browserOnline,
    login,
    logout,
  };
}
