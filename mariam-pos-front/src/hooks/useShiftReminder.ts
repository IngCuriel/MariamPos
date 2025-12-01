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

export const useShiftReminder = () => {
  const [openShifts, setOpenShifts] = useState<CashRegisterShift[]>([]);
  const [isChecking, setIsChecking] = useState(false);

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
    const shiftsList = shifts
      .map(shift => `• ${shift.branch} - ${shift.cashRegister} (Turno #${shift.shiftNumber})`)
      .join('\n');

    Swal.fire({
      icon: 'warning',
      title: '⚠️ Turnos Abiertos Detectados',
      html: `
        <p style="text-align: left; margin-bottom: 15px;">
          Se encontraron <strong>${shifts.length}</strong> turno(s) abierto(s):
        </p>
        <pre style="text-align: left; background: #f3f4f6; padding: 10px; border-radius: 8px; font-size: 0.9rem;">${shiftsList}</pre>
        <p style="margin-top: 15px; color: #dc2626; font-weight: bold;">
          ⚠️ Recuerda cerrar estos turnos al final del día.
        </p>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#667eea',
      allowOutsideClick: false,
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

      const shiftsList = shifts
        .map(shift => `• ${shift.branch} - ${shift.cashRegister} (Turno #${shift.shiftNumber})`)
        .join('\n');

      const result = await Swal.fire({
        icon: 'question',
        title: '🚪 ¿Cerrar Turno(s) Antes de Salir?',
        html: `
          <p style="text-align: left; margin-bottom: 15px;">
            Tienes <strong>${shifts.length}</strong> turno(s) abierto(s):
          </p>
          <pre style="text-align: left; background: #f3f4f6; padding: 10px; border-radius: 8px; font-size: 0.9rem; max-height: 200px; overflow-y: auto;">${shiftsList}</pre>
          <p style="margin-top: 15px; color: #dc2626; font-weight: bold;">
            ⚠️ Si sales a comer o apagas la máquina temporalmente, puedes dejar el turno abierto.
          </p>
          <p style="margin-top: 10px; color: #059669; font-weight: bold;">
            ✅ Si es fin de día, debes cerrar el turno ahora.
          </p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Cerrar Turno(s) y Salir',
        cancelButtonText: 'Dejar Abierto y Salir',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        allowOutsideClick: false,
        allowEscapeKey: false,
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        // Usuario quiere cerrar los turnos
        await handleCloseAllShifts(shifts);
        window.electronAPI?.notifyAppClose(true);
      } else {
        // Usuario quiere dejar los turnos abiertos
        Swal.fire({
          icon: 'info',
          title: 'Turnos Dejados Abiertos',
          html: `
            <p>Los turnos permanecerán abiertos.</p>
            <p style="margin-top: 10px; color: #dc2626; font-weight: bold;">
              ⚠️ <strong>IMPORTANTE:</strong> Recuerda cerrarlos al final del día.
            </p>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#667eea',
          timer: 3000,
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

