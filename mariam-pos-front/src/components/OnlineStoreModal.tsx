import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import {
  getOnlineStoreOrders,
  loginOnlineStore,
  removeOnlineStoreToken,
  getOnlineStoreUser,
  isOnlineStoreAuthenticated,
  type Order,
} from '../api/onlineStoreOrders';
import '../styles/components/onlineStoreModal.css';

interface OnlineStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: '#f39c12',
  CONFIRMADO: '#3498db',
  EN_PREPARACION: '#9b59b6',
  LISTO: '#2ecc71',
  ENTREGADO: '#27ae60',
  CANCELADO: '#e74c3c',
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En Preparación',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const OnlineStoreModal: React.FC<OnlineStoreModalProps> = ({ isOpen, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Estados del formulario de login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkAuthentication();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadOrders();
    }
  }, [isOpen, isAuthenticated, selectedStatus]);

  const checkAuthentication = () => {
    const authenticated = isOnlineStoreAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      setUser(getOnlineStoreUser());
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const response = await loginOnlineStore(loginEmail, loginPassword);
      setUser(response.user);
      setIsAuthenticated(true);
      setLoginEmail('');
      setLoginPassword('');
      // Cargar órdenes después del login
      await loadOrders();
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    removeOnlineStoreToken();
    setIsAuthenticated(false);
    setUser(null);
    setOrders([]);
    setLoginEmail('');
    setLoginPassword('');
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOnlineStoreOrders(selectedStatus || undefined);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las órdenes');
      console.error('Error cargando órdenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="online-store-modal-overlay" onClick={onClose}>
      <div className="online-store-modal-content" onClick={(e) => e.stopPropagation()}>
        <Card className="online-store-modal-card">
          <div className="online-store-modal-header">
            <h2 className="online-store-modal-title">
              <span className="online-store-modal-icon">🛒</span>
              Tienda Online - Pedidos
            </h2>
            <button 
              className="online-store-modal-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="online-store-modal-body">
            {/* Mostrar formulario de login si no está autenticado */}
            {!isAuthenticated ? (
              <div className="online-store-login-container">
                <div className="online-store-login-header">
                  <h3>Iniciar Sesión</h3>
                  <p>Ingresa tus credenciales de administrador para ver las órdenes</p>
                </div>
                
                {loginError && (
                  <div className="online-store-error">
                    ⚠️ {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="online-store-login-form">
                  <div className="online-store-form-group">
                    <label htmlFor="login-email" className="online-store-form-label">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="online-store-form-input"
                      placeholder="admin@mariamstore.com"
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
                      className="online-store-form-input"
                      placeholder="••••••••"
                      required
                      disabled={loginLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loginLoading}
                    className="online-store-login-button"
                  >
                    {loginLoading ? 'Iniciando sesión...' : '🔐 Iniciar Sesión'}
                  </Button>
                </form>

                <div className="online-store-login-hint">
                  <p>💡 Credenciales por defecto:</p>
                  <p><strong>Email:</strong> admin@mariamstore.com</p>
                  <p><strong>Contraseña:</strong> admin123</p>
                </div>
              </div>
            ) : (
              <>
                {/* Información del usuario */}
                <div className="online-store-user-info">
                  <div className="online-store-user-details">
                    <span className="online-store-user-icon">👤</span>
                    <div>
                      <div className="online-store-user-name">{user?.name || 'Usuario'}</div>
                      <div className="online-store-user-email">{user?.email || ''}</div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleLogout}
                    className="online-store-logout-button"
                  >
                    Cerrar Sesión
                  </Button>
                </div>

                {/* Filtro de estado */}
                <div className="online-store-filters">
              <label htmlFor="status-filter" className="online-store-filter-label">
                Filtrar por estado:
              </label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="online-store-filter-select"
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="CONFIRMADO">Confirmado</option>
                <option value="EN_PREPARACION">En Preparación</option>
                <option value="LISTO">Listo</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <Button
                variant="secondary"
                onClick={loadOrders}
                disabled={loading}
                className="online-store-refresh-btn"
              >
                🔄 Actualizar
              </Button>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="online-store-error">
                ⚠️ {error}
              </div>
            )}

            {/* Tabla de órdenes */}
            {loading ? (
              <div className="online-store-loading">
                <p>Cargando órdenes...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="online-store-empty">
                <p>No hay órdenes disponibles</p>
              </div>
            ) : (
              <div className="online-store-table-container">
                <table className="online-store-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Sucursal</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="online-store-folio">{order.folio}</td>
                        <td>
                          <div className="online-store-customer">
                            <div className="customer-name">{order.user?.name || 'N/A'}</div>
                            <div className="customer-email">{order.user?.email || ''}</div>
                          </div>
                        </td>
                        <td>{order.branch?.name || 'N/A'}</td>
                        <td className="online-store-items-count">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </td>
                        <td className="online-store-total">{formatPrice(order.total)}</td>
                        <td>
                          <span
                            className="online-store-status-badge"
                            style={{ backgroundColor: STATUS_COLORS[order.status] || '#95a5a6' }}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="online-store-date">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resumen */}
            {orders.length > 0 && (
              <div className="online-store-summary">
                <p>
                  <strong>Total de órdenes:</strong> {orders.length}
                </p>
                <p>
                  <strong>Total general:</strong>{' '}
                  {formatPrice(orders.reduce((sum, order) => sum + order.total, 0))}
                </p>
              </div>
            )}
              </>
            )}
          </div>

          <div className="online-store-modal-footer">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OnlineStoreModal;

