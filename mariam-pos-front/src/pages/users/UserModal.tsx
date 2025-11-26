import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import type { User, UserRole, UserStatus } from '../../types';
import { createUser, updateUser } from '../../api/users';
import Swal from 'sweetalert2';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  user?: User | null;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, user }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    role: 'CASHIER' as UserRole,
    status: 'ACTIVE' as UserStatus,
    branch: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        username: user.username || '',
        role: user.role || 'CASHIER',
        status: user.status || 'ACTIVE',
        branch: user.branch || '',
        notes: user.notes || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        username: '',
        role: 'CASHIER',
        status: 'ACTIVE',
        branch: '',
        notes: '',
      });
    }
    setErrors({});
  }, [isOpen, user]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Validar email si se proporciona
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        username: formData.username.trim() || undefined,
        role: formData.role,
        status: formData.status,
        branch: formData.branch.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (user) {
        await updateUser(user.id, userData);
        Swal.fire({
          icon: 'success',
          title: 'Usuario actualizado',
          text: 'El usuario ha sido actualizado correctamente',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await createUser(userData);
        Swal.fire({
          icon: 'success',
          title: 'Usuario creado',
          text: 'El usuario ha sido creado correctamente',
          timer: 2000,
          showConfirmButton: false,
        });
      }

      onSave();
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo guardar el usuario',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <Card className="modal-card">
          <div className="modal-header">
            <h1>{user ? 'Editar Cajero' : 'Nuevo Cajero'}</h1>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">
                  Nombre completo <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={errors.name ? 'error' : ''}
                  placeholder="Ej: Juan Pérez García"
                  required
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="Ej: juan@ejemplo.com"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">Nombre de usuario</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Ej: jperez"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Teléfono</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Ej: 5551234567"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="role">Rol <span className="required">*</span></label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="CASHIER">Cajero</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="branch">Sucursal</label>
                <input
                  type="text"
                  id="branch"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  placeholder="Ej: Sucursal Centro"
                />
              </div>
            </div>

            {user && (
              <div className="form-group">
                <label htmlFor="status">Estado</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="notes">Notas</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Notas adicionales sobre el usuario..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="cancel-btn"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="success"
                className="save-btn"
                disabled={loading}
              >
                {loading ? 'Guardando...' : user ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default UserModal;

