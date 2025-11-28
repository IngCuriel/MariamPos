/**
 * Utilidad para reproducir sonidos en el punto de venta
 * Usa Web Audio API para generar sonidos sin necesidad de archivos externos
 */

/**
 * Reproduce un beep corto y profesional para confirmar que se agregó un producto
 * Similar a los sistemas POS tradicionales
 */
export const playAddProductSound = (): void => {
  try {
    // Crear contexto de audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Frecuencia del beep (800Hz - tono agradable y profesional)
    const frequency = 800;
    // Duración del beep (100ms - corto y no molesto)
    const duration = 100;
    // Volumen (0.3 - suave pero audible)
    const volume = 0.3;
    
    // Crear oscilador (genera la onda de sonido)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Configurar el oscilador
    oscillator.type = 'sine'; // Onda sinusoidal (sonido suave)
    oscillator.frequency.value = frequency;
    
    // Configurar el volumen (envelope para que suene suave)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    // Conectar los nodos
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Reproducir el sonido
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
    
    // Limpiar recursos después de reproducir
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    // Si hay algún error (por ejemplo, el usuario no ha interactuado con la página),
    // simplemente no reproducir el sonido (fail silently)
    console.debug('No se pudo reproducir el sonido:', error);
  }
};

/**
 * Reproduce un sonido de error (más grave y más largo)
 */
export const playErrorSound = (): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const frequency = 400; // Tono más grave
    const duration = 200; // Más largo
    const volume = 0.3;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
    
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    console.debug('No se pudo reproducir el sonido de error:', error);
  }
};

/**
 * Reproduce un sonido de éxito (dos beeps rápidos)
 */
export const playSuccessSound = (): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const frequency = 1000; // Tono más agudo
    const duration = 80;
    const volume = 0.3;
    
    // Primer beep
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    
    oscillator1.type = 'sine';
    oscillator1.frequency.value = frequency;
    
    gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode1.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + duration / 1000);
    
    // Segundo beep (después de 50ms)
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.type = 'sine';
      oscillator2.frequency.value = frequency * 1.2; // Tono ligeramente más agudo
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode2.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + duration / 1000);
      
      oscillator2.onended = () => {
        oscillator2.disconnect();
        gainNode2.disconnect();
      };
    }, 50);
    
    oscillator1.onended = () => {
      oscillator1.disconnect();
      gainNode1.disconnect();
    };
  } catch (error) {
    console.debug('No se pudo reproducir el sonido de éxito:', error);
  }
};

