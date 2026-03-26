import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import {
  loginOnlineStore,
  removeOnlineStoreToken,
  getOnlineStoreUser,
  isOnlineStoreAuthenticated,
} from '../api/onlineStoreOrders';
import OnlineStoreCajeroPanel from './onlineStore/OnlineStoreCajeroPanel';
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

function getOnlineStoreHeaderTitle(panel: AuthPanel): string {
  switch (panel) {
    case 'hub':
      return 'Tienda online';
    case 'orders':
      return 'Pedidos tienda online';    case 'cash-express':
      return 'Efectivo Express';
    default:
      return 'Tienda online';
  }
}

const OnlineStoreModal: React.FC<OnlineStoreModalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [panel, setPanel] = useState<AuthPanel>('hub');
  const [remoteConfig, setRemoteConfig] = useState<AppConfigJson | null>(null);
  const [cashIframeLoaded, setCashIframeLoaded] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  const handleLogin = async (e: React.FormEvent) => {    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const response = await loginOnlineStore(loginEmail, loginPassword);
      setUser(response.user as Record<string, unknown>);
      setIsAuthenticated(true);
      setLoginEmail('');
      setLoginPassword('');
      setPanel('hub');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    removeOnlineStoreToken();
    setIsAuthenticated(false);
    setUser(null);
    setLoginEmail('');    setLoginPassword('');
    setPanel('hub');
  };

  const openCashExpressExternal = () => {    if (cashExpressUrl) {
      globalThis.open(cashExpressUrl, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (panel !== 'cash-express') {
      setCashIframeLoaded(false);
    }
  }, [panel]);

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
          <span className="online-store-hub-tile-hint">Acceso al portal de efectivo</span>
        </button>
      </nav>
    </div>
  );

  const renderCashExpressPanel = () => {
    if (!cashExpressUrl) {
      return (
        <div className="online-store-cash-panel">
          <div className="online-store-cash-placeholder">
            <p className="online-store-cash-placeholder-title">URL no configurada</p>
            <p className="online-store-cash-placeholder-text">
              Agrega en <code className="online-store-code">public/config.json</code> el campo{' '}
              <code className="online-store-code">cashExpressUrl</code> (URL completa) o{' '}
              <code className="online-store-code">storeClientUrl</code> (base del sitio; se usará{' '}
              <code className="online-store-code">/cash-express</code>).
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="online-store-cash-panel">
        <div className="online-store-cash-toolbar">
          <Button
            type="button"
            variant="secondary"
            onClick={openCashExpressExternal}
            className="online-store-cash-external-btn"
          >
            Abrir en navegador
          </Button>
        </div>
        {!cashIframeLoaded && (
          <div className="online-store-cash-loading" role="status" aria-live="polite">
            Cargando Efectivo Express…
          </div>
        )}
        <div className="online-store-cash-iframe-wrap">
          <iframe
            title="Efectivo Express"
            src={cashExpressUrl}
            className="online-store-cash-iframe"
            onLoad={() => setCashIframeLoaded(true)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    );
  };

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
                  <p>Ingresa tus credenciales de administrador de la tienda en línea</p>
                </div>

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
                    disabled={loginLoading}
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
