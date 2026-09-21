import React from 'react';
import Card from './Card';
import Button from './Button';
import { useOnlineStoreAuth, OFFLINE_LOGIN_MESSAGE } from '../hooks/useOnlineStoreAuth';
import CajeroTransacciones from './CajeroTransacciones';
import '../styles/components/onlineStoreModal.css';

interface RechargesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RechargesModal: React.FC<RechargesModalProps> = ({ isOpen, onClose }) => {
  const {
    isAuthenticated,
    email,
    password,
    setEmail,
    setPassword,
    loginLoading,
    loginError,
    browserOnline,
    login,
  } = useOnlineStoreAuth();

  if (!isOpen) return null;

  const loginSubmitLabel = loginLoading ? 'Iniciando sesión…' : 'Iniciar sesión';

  const renderContent = () => (
    <div className="online-store-hub">
      <CajeroTransacciones />
    </div>
  );

  const renderLogin = () => (
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

      <form onSubmit={login} className="online-store-login-form">
        <div className="online-store-form-group">
          <label htmlFor="recharges-login-email" className="online-store-form-label">
            Correo electrónico
          </label>
          <input
            id="recharges-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="online-store-form-input online-store-form-input--touch"
            autoComplete="username"
            required
            disabled={loginLoading}
          />
        </div>

        <div className="online-store-form-group">
          <label htmlFor="recharges-login-password" className="online-store-form-label">
            Contraseña
          </label>
          <input
            id="recharges-login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
  );

  return (
    <div className="online-store-modal-overlay" onClick={onClose}>
      <div className="online-store-modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="online-store-modal-card">
          <div className="online-store-modal-header">
            <div className="online-store-modal-header-main">
              <h2 className="online-store-modal-title">
                <span className="online-store-modal-icon" aria-hidden>
                  📱
                </span>
                Recargas y Pines
              </h2>
            </div>
            <button
              type="button"
              className="online-store-modal-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="online-store-modal-body">
            {isAuthenticated ? renderContent() : renderLogin()}
          </div>

          <div className="online-store-modal-footer">
            <Button
              variant="secondary"
              onClick={onClose}
              className="online-store-footer-close--touch"
            >
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RechargesModal;
