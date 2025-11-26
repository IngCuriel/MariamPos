import React, { useState, useEffect } from 'react';
import '../../styles/pages/users.css';
import Header from '../../components/Header';
import type { User } from '../../types/index';
import { getUsers, deleteUser, toggleUserStatus } from "../../api/users";
import Card from '../../components/Card';
import Button from '../../components/Button';
import UserModal from './UserModal';
import Swal from 'sweetalert2';

interface UsersPageProps {
  onBack: () => void;
}

const UsersPage: React.FC<UsersPageProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los usuarios',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSave = async () => {
    await fetchUsers();
    handleCloseModal();
  };

  const handleDelete = async (user: User) => {
    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
      html: `¿Estás seguro de que deseas eliminar a <strong>${user.name}</strong>?<br/>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await deleteUser(user.id);
        Swal.fire({
          icon: 'success',
          title: 'Usuario eliminado',
          text: `${user.name} ha sido eliminado correctamente`,
          timer: 2000,
          showConfirmButton: false,
        });
        await fetchUsers();
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo eliminar el usuario',
        });
      }
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await toggleUserStatus(user.id);
      Swal.fire({
        icon: 'success',
        title: user.status === 'ACTIVE' ? 'Usuario inactivado' : 'Usuario activado',
        text: `${user.name} ha sido ${user.status === 'ACTIVE' ? 'inactivado' : 'activado'} correctamente`,
        timer: 2000,
        showConfirmButton: false,
      });
      await fetchUsers();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo cambiar el estado del usuario',
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: User['role']) => {
    const roleConfig: Record<User['role'], { label: string; color: string }> = {
      ADMIN: { label: 'Administrador', color: '#dc2626' },
      MANAGER: { label: 'Gerente', color: '#2563eb' },
      CASHIER: { label: 'Cajero', color: '#059669' },
      SUPERVISOR: { label: 'Supervisor', color: '#7c3aed' },
    };
    const config = roleConfig[role] || { label: role, color: '#6b7280' };
    return (
      <span
        className="role-badge"
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="app-users">
      <div className="users-container">
        <Header
          title="Gestión de Cajeros"
          onBack={onBack}
          backText="← Volver"
          className="catalog-header"
        />
        <div className="users-content">
          {/* Barra de búsqueda y acciones */}
          <Card className="search-card">
            <div className="search-section">
              <div className="search-group">
                <label htmlFor="search">Buscar Cajero:</label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre, email o usuario..."
                  className="search-input"
                />
              </div>
              <Button
                variant="success"
                onClick={handleAddNew}
                className="add-user-btn"
              >
                ➕ Nuevo Cajero
              </Button>
            </div>
          </Card>

          {/* Tabla de usuarios */}
          {loading ? (
            <Card className="loading-card">
              <p>Cargando usuarios...</p>
            </Card>
          ) : (
            <div className="table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Usuario</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Sucursal</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="no-data">
                        {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className={user.status === 'INACTIVE' ? 'inactive-row' : ''}>
                        <td>
                          <strong>{user.name}</strong>
                        </td>
                        <td>{user.email || '-'}</td>
                        <td>{user.username || '-'}</td>
                        <td>{user.phone || '-'}</td>
                        <td>{getRoleBadge(user.role)}</td>
                        <td>{user.branch || '-'}</td>
                        <td>
                          <span
                            className={`status-badge ${user.status === 'ACTIVE' ? 'active' : 'inactive'}`}
                          >
                            {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <Button
                              variant="primary"
                              onClick={() => handleEdit(user)}
                              className="edit-btn"
                             >
                              Editar ✏️
                            </Button>
                            <Button
                              variant={user.status === 'ACTIVE' ? 'warning' : 'success'}
                              onClick={() => handleToggleStatus(user)}
                              className="toggle-btn"
                             >
                             {user.status === 'ACTIVE' ? 'Inactivar' : 'Activar'} {user.status === 'ACTIVE' ? '🚫' : '✅'}
                            </Button>
                            <Button
                              variant="warning"
                              onClick={() => handleDelete(user)}
                              className="delete-btn"
                             >
                             Eliminar 🗑️
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal para agregar/editar */}
        <UserModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSave={handleSave}
          user={editingUser}
        />
      </div>
    </div>
  );
};

export default UsersPage;

