import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Card from './Card';
import Button from './Button';
import {
  loginOnlineStore,
  removeOnlineStoreToken,
  getOnlineStoreUser,
  isOnlineStoreAuthenticated,
} from '../api/onlineStoreOrders';
import OnlineStoreCajeroPanel from './onlineStore/OnlineStoreCajeroPanel';
import CashExpressCajeroPanel from './onlineStore/CashExpressCajeroPanel';
import '../styles/components/onlineStoreModal.css';
interface OnlineStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthPanel = 'hub' | 'orders' | 'cash-express';

interface AppConfigJson {
  cashExpressUrl?: string;
  storeClientUrl?: string;
}

function resolveCashExpressUrl(config: AppConfigJson | null): string | null {
  if (!config) return null;
  const direct = config.cashExpressUrl?.trim();
  if (direct) return direct;
  const base = config.storeClientUrl?.trim();
  if (base) {
    return `${base.replace(/\/$/, '')}/cash-express`;
  }
  return null;
}

/** Credenciales por defecto en POS (solo para agilizar el acceso al cajero tienda online). */
const DEFAULT_ONLINE_STORE_EMAIL = 'admin@mariamstore.com';
const DEFAULT_ONLINE_STORE_PASSWORD = 'admin123'; // NOSONAR — credenciales de demo en POS solicitadas por producto

const OFFLINE_LOGIN_MESSAGE = 'Revisa tu conexión a Internet.';

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

function getOnlineStoreHeaderTitle(panel: AuthPanel): string {
  switch (panel) {
    case 'hub':
      return 'Tienda online';
    case 'orders':
      return 'Pedidos tienda online';
    case 'cash-express':
      return 'Cajero · Efectivo Express';
    default:
      return 'Tienda online';
  }
}

const OnlineStoreModal: React.FC<OnlineStoreModalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<AuthPanel>('hub');
  const [remoteConfig, setRemoteConfig] = useState<AppConfigJson | null>(null);

  const [loginEmail, setLoginEmail] = useState(DEFAULT_ONLINE_STORE_EMAIL);
  const [loginPassword, setLoginPassword] = useState(DEFAULT_ONLINE_STORE_PASSWORD);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [browserOnline, setBrowserOnline] = useState(
    () => globalThis.navigator?.onLine ?? true,
  );

  const cashExpressUrl = resolveCashExpressUrl(remoteConfig);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    fetch('/config.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') {
          setRemoteConfig(data as AppConfigJson);
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const authenticated = isOnlineStoreAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      setUser(getOnlineStoreUser() as Record<string, unknown> | null);
      setPanel('hub');
    } else {
      setUser(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setLoginEmail(DEFAULT_ONLINE_STORE_EMAIL);
    setLoginPassword(DEFAULT_ONLINE_STORE_PASSWORD);
    setLoginError(null);
    setLoginLoading(false);
  }, [isOpen]);

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

  useEffect(() => {
    if (isOpen) {
      setBrowserOnline(globalThis.navigator?.onLine ?? true);
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (globalThis.navigator?.onLine === false) {
      setLoginError(OFFLINE_LOGIN_MESSAGE);
      return;
    }

    setLoginLoading(true);

    try {
      const response = await loginOnlineStore(loginEmail, loginPassword);
      setUser(response.user as Record<string, unknown>);
      setIsAuthenticated(true);
      setLoginEmail(DEFAULT_ONLINE_STORE_EMAIL);
      setLoginPassword(DEFAULT_ONLINE_STORE_PASSWORD);
      setPanel('hub');
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
  };

  const handleLogout = () => {
    removeOnlineStoreToken();
    setIsAuthenticated(false);
    setUser(null);
    setLoginEmail(DEFAULT_ONLINE_STORE_EMAIL);
    setLoginPassword(DEFAULT_ONLINE_STORE_PASSWORD);
    setPanel('hub');
  };

  if (!isOpen) return null;

  const headerTitle = getOnlineStoreHeaderTitle(panel);
  const headerIcon = panel === 'cash-express' ? '💸' : '🛒';
  const showBack = isAuthenticated && panel !== 'hub';
  const userName = typeof user?.name === 'string' ? user.name : 'Usuario';
  const userEmail = typeof user?.email === 'string' ? user.email : '';
  const loginSubmitLabel = loginLoading ? 'Iniciando sesión…' : 'Iniciar sesión';

  const renderHubPanel = () => (
    <div className="online-store-hub">
      <div className="online-store-user-bar">
        <div className="online-store-user-details">
          <span className="online-store-user-icon" aria-hidden>
            👤
          </span>
          <div>
            <div className="online-store-user-name">{userName}</div>
            {userEmail ? <div className="online-store-user-email">{userEmail}</div> : null}
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleLogout}
          className="online-store-logout-button online-store-logout-button--touch"
        >
          Cerrar sesión
        </Button>
      </div>

      <p className="online-store-hub-intro">Elige una opción</p>

      <nav className="online-store-hub-grid" aria-label="Opciones de tienda online">
        <button
          type="button"
          className="online-store-hub-tile online-store-hub-tile--orders"
          onClick={() => setPanel('orders')}
        >
          <span className="online-store-hub-tile-icon" aria-hidden>
            📦
          </span>
          <span className="online-store-hub-tile-title">Pedidos</span>
          <span className="online-store-hub-tile-subtitle">Online</span>
          <span className="online-store-hub-tile-hint">Gestiona los pedidos de la tienda online</span>
        </button>

        <button
          type="button"
          className="online-store-hub-tile online-store-hub-tile--cash"
          onClick={() => setPanel('cash-express')}
        >
          <span className="online-store-hub-tile-icon" aria-hidden>
            💵
          </span>
          <span className="online-store-hub-tile-title">Efectivo Express</span>
          <span className="online-store-hub-tile-subtitle">Entrega de Efectivo</span>
          <span className="online-store-hub-tile-hint">Entregas liberadas y registro de entrega (touch)</span>
        </button>
      </nav>
    </div>
  );

  const renderCashExpressPanel = () => (
    <div className="online-store-cash-panel online-store-cash-panel--native">
      <CashExpressCajeroPanel publicPortalUrl={cashExpressUrl} />
    </div>
  );

  const renderAuthenticatedBody = () => {
    if (panel === 'hub') return renderHubPanel();
    if (panel === 'cash-express') return renderCashExpressPanel();
    return <OnlineStoreCajeroPanel />;
  };
  return (
    <div className="online-store-modal-overlay" onClick={onClose}>
      <div className="online-store-modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="online-store-modal-card">
          <div className="online-store-modal-header">
            <div className="online-store-modal-header-main">
              {showBack && (
                <button
                  type="button"
                  className="online-store-modal-back"
                  onClick={() => setPanel('hub')}
                  aria-label="Volver al menú principal"
                >
                  <span className="online-store-modal-back-icon" aria-hidden>
                    ‹
                  </span>
                  <span className="online-store-modal-back-text">Menú</span>
                </button>
              )}
              <h2 className="online-store-modal-title">
                <span className="online-store-modal-icon" aria-hidden>
                  {headerIcon}
                </span>
                {headerTitle}
              </h2>
            </div>
            <button type="button" className="online-store-modal-close" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div className="online-store-modal-body">
            {isAuthenticated ? (
              renderAuthenticatedBody()
            ) : (
              <div className="online-store-login-container">
                <div className="online-store-login-header">
                  <h3>Iniciar sesión</h3>
                  <p>Credenciales de administrador cargadas; pulsa «Iniciar sesión» para continuar.</p>
                </div>

                {!browserOnline && (
                  <div className="online-store-offline-banner" role="alert">
                    {OFFLINE_LOGIN_MESSAGE}
                  </div>
                )}

                {loginError && <div className="online-store-error">⚠️ {loginError}</div>}

                <form onSubmit={handleLogin} className="online-store-login-form">
                  <div className="online-store-form-group">
                    <label htmlFor="login-email" className="online-store-form-label">
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="online-store-form-input online-store-form-input--touch"
                      autoComplete="username"
                      required
                      disabled={loginLoading}
                    />
                  </div>

                  <div className="online-store-form-group">
                    <label htmlFor="login-password" className="online-store-form-label">
                      Contraseña
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="online-store-form-input online-store-form-input--touch"
                      autoComplete="current-password"
                      required
                      disabled={loginLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loginLoading || !browserOnline}
                    className="online-store-login-button online-store-login-button--touch"
                  >
                    {loginSubmitLabel}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div className="online-store-modal-footer">
            <Button variant="secondary" onClick={onClose} className="online-store-footer-close--touch">
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnlineStoreModal;
