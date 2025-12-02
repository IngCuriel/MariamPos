import { useEffect, useState } from 'react';
import { getAllOpenShifts, closeShift } from '../api/cashRegister';
import type { CashRegisterShift } from '../types';
import Swal from 'sweetalert2';

// Declarar tipos para window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      onCheckOpenShifts: (callback: () => void) => void;
      respondOpenShifts: (hasShifts: boolean) => void;
      onShowShiftReminderOnClose: (callback: () => void) => void;
      notifyAppClose: (shouldClose: boolean) => void;
    };
  }
}

interface UseShiftReminderOptions {
  onGoToSales?: () => void;
}

export const useShiftReminder = (options?: UseShiftReminderOptions) => {
  const [openShifts, setOpenShifts] = useState<CashRegisterShift[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const { onGoToSales } = options || {};

  // Obtener caja y sucursal del localStorage
  const getCashRegisterAndBranch = () => {
    const cashRegister = localStorage.getItem('caja') || 'Caja 1';
    const branch = localStorage.getItem('sucursal') || undefined;
    return { cashRegister, branch };
  };

  // Verificar turnos abiertos al iniciar
  useEffect(() => {
    checkOpenShifts();
  }, []);

  // Configurar listeners de Electron para el cierre de aplicación
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Escuchar cuando Electron quiere verificar turnos abiertos
      window.electronAPI.onCheckOpenShifts(async () => {
        const { cashRegister, branch } = getCashRegisterAndBranch();
        const shifts = await getAllOpenShifts(cashRegister, branch);
        const hasShifts = shifts.length > 0;
        window.electronAPI?.respondOpenShifts(hasShifts);
      });

      // Escuchar cuando Electron quiere mostrar recordatorio al cerrar
      window.electronAPI.onShowShiftReminderOnClose(() => {
        showCloseReminder();
      });
    }
  }, []);

  const checkOpenShifts = async () => {
    try {
      setIsChecking(true);
      const { cashRegister, branch } = getCashRegisterAndBranch();
      const shifts = await getAllOpenShifts(cashRegister, branch);
      setOpenShifts(shifts);
      
      // Si hay turnos abiertos, mostrar recordatorio al iniciar
      if (shifts.length > 0) {
        showStartupReminder(shifts);
      }
    } catch (error) {
      console.error('Error al verificar turnos abiertos:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const showStartupReminder = (shifts: CashRegisterShift[]) => {
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return 'Fecha no disponible';
      try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Fecha inválida';
        return dateObj.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (error) {
        return 'Fecha inválida';
      }
    };

    const shiftsList = shifts
      .map(shift => {
        const openDate = formatDate(shift.startTime);
        return `
          <div style="
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-left: 4px solid #667eea;
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          ">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="font-size: 20px;">🏪</span>
              <strong style="font-size: 16px; color: #1e293b;">${shift.branch || 'Sin Sucursal'}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <span style="font-size: 18px;">💰</span>
              <span style="font-size: 15px; color: #475569;">${shift.cashRegister}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 16px;">🔢</span>
              <span style="font-size: 14px; color: #64748b;">Turno #${shift.shiftNumber}</span>
              <span style="font-size: 14px; color: #94a3b8; margin-left: auto;">${openDate}</span>
            </div>
          </div>
        `;
      })
      .join('');

    Swal.fire({
      icon: 'warning',
      title: '<div style="font-size: 28px; margin-bottom: 8px;">⚠️ Turno Abierto</div>',
      html: `
        <div style="
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 24px;
          padding-right: 8px;
        ">
          ${shiftsList}
        </div>
        <div style="
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          border: 3px solid #991b1b;
          padding: 20px 24px;
          border-radius: 12px;
          margin-top: 24px;
          box-shadow: 0 8px 16px rgba(220, 38, 38, 0.3);
          animation: pulse 2s infinite;
        ">
          <div style="display: flex; align-items: start; gap: 16px;">
            <div style="
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              width: 48px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <span style="font-size: 28px;">⏰</span>
            </div>
            <div style="flex: 1;">
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
              ">
                <strong style="
                  color: #ffffff;
                  font-size: 20px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">⚠️ Importante</strong>
              </div>
              <p style="
                color: #ffffff;
                margin: 0 0 16px 0;
                font-size: 16px;
                font-weight: 500;
                line-height: 1.5;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
              ">
                Recuerda cerrar este turno al final del día para mantener los registros correctos.
              </p>
              ${onGoToSales ? `
                <button 
                  id="go-to-sales-button"
                  style="
                    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                    color: #dc2626;
                    border: 2px solid #ffffff;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 48px;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(0, 0, 0, 0.3)';"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.2)';"
                >
                  <span style="font-size: 20px;">💰</span>
                  Ir al Módulo de Ventas
                </button>
              ` : ''}
            </div>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 8px 16px rgba(220, 38, 38, 0.3);
            }
            50% {
              box-shadow: 0 8px 24px rgba(220, 38, 38, 0.5);
            }
          }
        </style>
      `,
      confirmButtonText: '<span style="font-size: 16px; padding: 8px 24px;">✓ Entendido</span>',
      confirmButtonColor: '#667eea',
      buttonsStyling: true,
      customClass: {
        confirmButton: 'swal2-confirm-touch',
        popup: 'swal2-popup-touch',
      },
      allowOutsideClick: false,
      width: '600px',
      didOpen: () => {
        // Agregar event listener al botón de ventas
        if (onGoToSales) {
          const salesButton = document.querySelector('#go-to-sales-button');
          if (salesButton) {
            salesButton.addEventListener('click', () => {
              Swal.close();
              setTimeout(() => {
                onGoToSales();
              }, 300);
            });
          }
        }
      },
    });
  };

  const showCloseReminder = async () => {
    try {
      const { cashRegister, branch } = getCashRegisterAndBranch();
      const shifts = await getAllOpenShifts(cashRegister, branch);
      
      if (shifts.length === 0) {
        // No hay turnos abiertos, permitir cierre
        window.electronAPI?.notifyAppClose(true);
        return;
      }

      const formatDate = (date: Date | string | null | undefined): string => {
        if (!date) return 'Fecha no disponible';
        try {
          const dateObj = typeof date === 'string' ? new Date(date) : date;
          if (isNaN(dateObj.getTime())) return 'Fecha inválida';
          return dateObj.toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (error) {
          return 'Fecha inválida';
        }
      };

      const shiftsList = shifts
        .map(shift => {
          const openDate = formatDate(shift.startTime);
          return `
            <div style="
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border-left: 4px solid #667eea;
              padding: 12px 16px;
              margin-bottom: 10px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            ">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <span style="font-size: 20px;">🏪</span>
                <strong style="font-size: 16px; color: #1e293b;">${shift.branch || 'Sin Sucursal'}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <span style="font-size: 18px;">💰</span>
                <span style="font-size: 15px; color: #475569;">${shift.cashRegister}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🔢</span>
                <span style="font-size: 14px; color: #64748b;">Turno #${shift.shiftNumber}</span>
                <span style="font-size: 14px; color: #94a3b8; margin-left: auto;">${openDate}</span>
              </div>
            </div>
          `;
        })
        .join('');

      const result = await Swal.fire({
        icon: 'question',
        title: '<div style="font-size: 28px; margin-bottom: 8px;">🚪 ¿Qué Deseas Hacer?</div>',
        html: `
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="
              display: inline-block;
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              padding: 12px 24px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              margin-bottom: 16px;
            ">
              <div style="font-size: 32px; font-weight: bold; color: #1e40af;">
                ${shifts.length} ${shifts.length === 1 ? 'Turno Abierto' : 'Turnos Abiertos'}
              </div>
            </div>
          </div>
          <div style="
            max-height: 250px;
            overflow-y: auto;
            margin-bottom: 20px;
            padding-right: 8px;
          ">
            ${shiftsList}
          </div>
          <div style="
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            padding: 14px 16px;
            border-radius: 8px;
            margin-bottom: 12px;
          ">
            <div style="display: flex; align-items: start; gap: 10px;">
              <span style="font-size: 24px;">🍽️</span>
              <div>
                <strong style="color: #92400e; font-size: 15px;">¿Sales a comer o descansar?</strong>
                <p style="color: #78350f; margin: 4px 0 0 0; font-size: 14px;">
                  Puedes dejar el turno abierto y cerrarlo cuando regreses.
                </p>
              </div>
            </div>
          </div>
          <div style="
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            border-left: 4px solid #059669;
            padding: 14px 16px;
            border-radius: 8px;
          ">
            <div style="display: flex; align-items: start; gap: 10px;">
              <span style="font-size: 24px;">🌙</span>
              <div>
                <strong style="color: #065f46; font-size: 15px;">¿Es fin de día?</strong>
                <p style="color: #047857; margin: 4px 0 0 0; font-size: 14px;">
                  Debes cerrar el turno ahora para mantener los registros correctos.
                </p>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<span style="font-size: 16px; padding: 8px 24px;">✓ Cerrar Turno(s) y Salir</span>',
        cancelButtonText: '<span style="font-size: 16px; padding: 8px 24px;">→ Dejar Abierto y Salir</span>',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        buttonsStyling: true,
        customClass: {
          confirmButton: 'swal2-confirm-touch',
          cancelButton: 'swal2-cancel-touch',
          popup: 'swal2-popup-touch',
        },
        allowOutsideClick: false,
        allowEscapeKey: false,
        reverseButtons: true,
        width: '650px',
      });

      if (result.isConfirmed) {
        // Usuario quiere cerrar los turnos
        await handleCloseAllShifts(shifts);
        window.electronAPI?.notifyAppClose(true);
      } else {
        // Usuario quiere dejar los turnos abiertos
        Swal.fire({
          icon: 'info',
          title: '<div style="font-size: 24px; margin-bottom: 8px;">ℹ️ Turnos Dejados Abiertos</div>',
          html: `
            <div style="text-align: center; margin-bottom: 16px;">
              <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
              <p style="font-size: 16px; color: #475569; margin-bottom: 16px;">
                Los turnos permanecerán abiertos y podrás continuar trabajando cuando regreses.
              </p>
            </div>
            <div style="
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              border-left: 4px solid #dc2626;
              padding: 14px 16px;
              border-radius: 8px;
            ">
              <div style="display: flex; align-items: start; gap: 10px;">
                <span style="font-size: 24px;">⏰</span>
                <div>
                  <strong style="color: #991b1b; font-size: 15px;">Recordatorio Importante:</strong>
                  <p style="color: #7f1d1d; margin: 4px 0 0 0; font-size: 14px;">
                    No olvides cerrar estos turnos al final del día para mantener los registros correctos.
                  </p>
                </div>
              </div>
            </div>
          `,
          confirmButtonText: '<span style="font-size: 16px; padding: 8px 24px;">✓ Entendido</span>',
          confirmButtonColor: '#667eea',
          buttonsStyling: true,
          customClass: {
            confirmButton: 'swal2-confirm-touch',
            popup: 'swal2-popup-touch',
          },
          timer: 4000,
          width: '550px',
        }).then(() => {
          window.electronAPI?.notifyAppClose(true);
        });
      }
    } catch (error) {
      console.error('Error al mostrar recordatorio de cierre:', error);
      // En caso de error, permitir el cierre
      window.electronAPI?.notifyAppClose(true);
    }
  };

  const handleCloseAllShifts = async (shifts: CashRegisterShift[]) => {
    for (const shift of shifts) {
      try {
        // Calcular efectivo final (usar el esperado como base)
        const finalCash = shift.expectedCash || shift.initialCash || 0;
        
        await closeShift(shift.id, {
          finalCash,
          notes: 'Turno cerrado automáticamente al salir de la aplicación',
        });
      } catch (error: any) {
        console.error(`Error al cerrar turno ${shift.id}:`, error);
        Swal.fire({
          icon: 'error',
          title: 'Error al Cerrar Turno',
          text: `No se pudo cerrar el turno ${shift.shiftNumber}. ${error.response?.data?.error || error.message}`,
          confirmButtonText: 'Continuar',
        });
      }
    }
  };

  return {
    openShifts,
    isChecking,
    checkOpenShifts,
  };
};

