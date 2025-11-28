import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import pdfToPrinter from 'pdf-to-printer';

const execAsync = promisify(exec);
const { print } = pdfToPrinter;

// Configurar multer para almacenar archivos temporalmente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = os.tmpdir();
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `copy-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten PDF, JPG y PNG.'));
    }
  }
});

// Middleware para manejar la carga de archivos
export const uploadMiddleware = upload.single('file');

/**
 * Imprimir copias de un archivo
 */
export const printCopies = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { copies, colorMode, printerName } = req.body;

    if (!copies || !printerName) {
      // Limpiar archivo temporal
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Faltan parámetros requeridos: copies, printerName' });
    }

    const numCopies = parseInt(copies, 10);
    if (isNaN(numCopies) || numCopies < 1 || numCopies > 100) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'La cantidad de copias debe estar entre 1 y 100' });
    }

    const isColor = colorMode === 'color';

    // Opciones de impresión
    const printOptions = {
      printer: printerName.trim(),
      copies: numCopies,
      pages: '1-', // Imprimir todas las páginas
      color: isColor,
      silent: false, // Mostrar diálogo de impresión (opcional)
    };

    console.log('Enviando trabajo de impresión:', {
      printer: printerName,
      copies: numCopies,
      color: isColor,
      file: req.file.filename,
    });

    // Imprimir el archivo
    await print(req.file.path, printOptions);

    // Limpiar archivo temporal después de imprimir
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Se enviaron ${numCopies} copia(s) en modo ${isColor ? 'color' : 'blanco y negro'} a la impresora ${printerName}`,
      details: {
        printer: printerName,
        copies: numCopies,
        colorMode: isColor ? 'color' : 'bw',
      }
    });

  } catch (error) {
    console.error('Error al imprimir copias:', error);

    // Limpiar archivo temporal en caso de error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Mensajes de error más descriptivos
    let errorMessage = 'Error al enviar el trabajo de impresión';
    
    if (error.message.includes('printer')) {
      errorMessage = `No se encontró la impresora "${req.body.printerName}". Verifica que el nombre sea correcto y que la impresora esté conectada.`;
    } else if (error.message.includes('permission')) {
      errorMessage = 'No tienes permisos para acceder a la impresora. Verifica la configuración del sistema.';
    } else if (error.message.includes('file')) {
      errorMessage = 'Error al procesar el archivo. Verifica que el archivo no esté corrupto.';
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Escanear documento desde la impresora y devolver la imagen
 */
export const scanDocument = async (req, res) => {
  try {
    const { scannerName, colorMode } = req.body;
    const platform = os.platform();
    const tempDir = os.tmpdir();
    const scanFileName = `scan-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    const scanFilePath = path.join(tempDir, scanFileName);
    
    let scanCommand = '';
    
    try {
      if (platform === 'win32') {
        // Windows: usar PowerShell con WIA (Windows Image Acquisition)
        // Primero intentar con WIA
        const wiaScript = `
          $deviceManager = New-Object -ComObject WIA.DeviceManager
          $device = $deviceManager.DeviceInfos.Item(1).Connect()
          $item = $device.Items.Item(1)
          $imageFile = $device.Transfer($item)
          $imageFile.SaveFile("${scanFilePath.replace(/\\/g, '\\\\')}")
        `;
        
        // Guardar script temporal
        const scriptPath = path.join(tempDir, `scan-${Date.now()}.ps1`);
        fs.writeFileSync(scriptPath, wiaScript);
        
        // Ejecutar PowerShell
        scanCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
        
        try {
          await execAsync(scanCommand, { timeout: 30000 });
          // Limpiar script temporal
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch (wiaError) {
          // Si WIA falla, intentar con comandos de Epson si están instalados
          console.warn('WIA falló, intentando con Epson Scan:', wiaError.message);
          
          // Buscar Epson Scan en ubicaciones comunes
          const epsonScanPaths = [
            'C:\\Program Files\\EPSON\\Epson Scan\\escan.exe',
            'C:\\Program Files (x86)\\EPSON\\Epson Scan\\escan.exe',
          ];
          
          let epsonScanPath = null;
          for (const scanPath of epsonScanPaths) {
            if (fs.existsSync(scanPath)) {
              epsonScanPath = scanPath;
              break;
            }
          }
          
          if (epsonScanPath) {
            // Usar Epson Scan con parámetros de línea de comandos
            scanCommand = `"${epsonScanPath}" /scan /dest:"${scanFilePath}" /format:jpg`;
            await execAsync(scanCommand, { timeout: 60000 });
          } else {
            throw new Error('No se encontró software de escaneo. Asegúrate de tener instalado Epson Scan o que el escáner esté configurado en Windows.');
          }
        }
      } else if (platform === 'linux') {
        // Linux: usar scanimage (SANE)
        const colorOption = colorMode === 'color' ? '--mode=Color' : '--mode=Gray';
        scanCommand = `scanimage ${colorOption} --format=jpeg --resolution=300 > "${scanFilePath}"`;
        await execAsync(scanCommand, { timeout: 60000 });
      } else if (platform === 'darwin') {
        // macOS: usar scanimage o comandos nativos
        const colorOption = colorMode === 'color' ? '--mode=Color' : '--mode=Gray';
        scanCommand = `scanimage ${colorOption} --format=jpeg --resolution=300 > "${scanFilePath}"`;
        await execAsync(scanCommand, { timeout: 60000 });
      } else {
        throw new Error(`Plataforma no soportada: ${platform}`);
      }
      
      // Verificar que el archivo se creó
      if (!fs.existsSync(scanFilePath)) {
        throw new Error('El escaneo no generó ningún archivo. Verifica que el documento esté en la cama del escáner.');
      }
      
      // Leer el archivo escaneado
      const scanBuffer = fs.readFileSync(scanFilePath);
      
      // Limpiar archivo temporal
      fs.unlinkSync(scanFilePath);
      
      // Enviar la imagen como respuesta
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${scanFileName}"`);
      res.send(scanBuffer);
      
    } catch (scanError) {
      console.error('Error al escanear:', scanError);
      
      // Limpiar archivo temporal si existe
      if (fs.existsSync(scanFilePath)) {
        fs.unlinkSync(scanFilePath);
      }
      
      throw scanError;
    }
    
  } catch (error) {
    console.error('Error al escanear documento:', error);
    res.status(500).json({
      error: 'Error al escanear el documento',
      message: error.message || 'No se pudo escanear el documento. Verifica que el escáner esté conectado y que haya un documento en la cama del escáner.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Fotocopiar: escanear y imprimir en un solo paso
 */
export const photocopy = async (req, res) => {
  try {
    const { copies, colorMode, printerName, scannerName } = req.body;
    
    if (!copies || !printerName) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: copies, printerName' });
    }
    
    const numCopies = parseInt(copies, 10);
    if (isNaN(numCopies) || numCopies < 1 || numCopies > 100) {
      return res.status(400).json({ error: 'La cantidad de copias debe estar entre 1 y 100' });
    }
    
    const isColor = colorMode === 'color';
    const platform = os.platform();
    const tempDir = os.tmpdir();
    const scanFileName = `photocopy-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    const scanFilePath = path.join(tempDir, scanFileName);
    
    console.log('Iniciando fotocopia:', {
      printer: printerName,
      copies: numCopies,
      color: isColor,
    });
    
    // Paso 1: Escanear
    try {
      console.log('Iniciando escaneo...', { platform, scanFilePath });
      
      if (platform === 'win32') {
        let scanSuccess = false;
        let lastError = null;
        
        // Método 1: Intentar con Epson Scan primero (más confiable)
        const epsonScanPaths = [
          'C:\\Program Files\\EPSON\\Epson Scan\\escan.exe',
          'C:\\Program Files (x86)\\EPSON\\Epson Scan\\escan.exe',
        ];
        
        let epsonScanPath = null;
        for (const scanPath of epsonScanPaths) {
          if (fs.existsSync(scanPath)) {
            epsonScanPath = scanPath;
            console.log('Epson Scan encontrado en:', scanPath);
            break;
          }
        }
        
        if (epsonScanPath) {
          try {
            console.log('Intentando escanear con Epson Scan...');
            // Epson Scan puede requerir parámetros diferentes según el modelo
            // Intentar primero sin parámetros adicionales
            const epsonCommand = `"${epsonScanPath}" /scan /dest:"${scanFilePath}" /format:jpg /resolution:300`;
            await execAsync(epsonCommand, { timeout: 90000 });
            
            // Esperar un momento para que el archivo se escriba
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (fs.existsSync(scanFilePath) && fs.statSync(scanFilePath).size > 0) {
              scanSuccess = true;
              console.log('Escaneo exitoso con Epson Scan');
            }
          } catch (epsonError) {
            console.warn('Error con Epson Scan:', epsonError.message);
            lastError = epsonError;
          }
        }
        
        // Método 2: Si Epson Scan falla, intentar con WIA (versión mejorada)
        if (!scanSuccess) {
          try {
            console.log('Intentando escanear con WIA (Windows Image Acquisition)...');
            const wiaScript = `
              $ErrorActionPreference = "Stop"
              try {
                # Crear el DeviceManager
                $deviceManager = New-Object -ComObject WIA.DeviceManager
                
                # Verificar que hay dispositivos disponibles
                if ($deviceManager.DeviceInfos.Count -eq 0) {
                  Write-Error "No se encontraron dispositivos de escaneo conectados"
                  exit 1
                }
                
                Write-Host "Dispositivos encontrados: $($deviceManager.DeviceInfos.Count)"
                
                # Conectar al primer dispositivo
                $deviceInfo = $deviceManager.DeviceInfos.Item(1)
                Write-Host "Conectando a: $($deviceInfo.Properties.Item('Name').Value)"
                $device = $deviceInfo.Connect()
                
                # Verificar que hay elementos para escanear
                if ($device.Items.Count -eq 0) {
                  Write-Error "No se encontraron elementos para escanear en el dispositivo"
                  exit 1
                }
                
                Write-Host "Elementos disponibles: $($device.Items.Count)"
                
                # Obtener el primer elemento (normalmente el escáner plano)
                $item = $device.Items.Item(1)
                
                # Configurar resolución y modo de color
                $resolution = 300
                $colorMode = ${isColor ? '1' : '2'}  # 1=Color, 2=Escala de grises
                
                try {
                  $item.Properties.Item("6146").Value = $resolution  # Horizontal Resolution
                  $item.Properties.Item("6147").Value = $resolution  # Vertical Resolution
                  $item.Properties.Item("6148").Value = $colorMode   # Current Intent
                } catch {
                  Write-Host "No se pudieron configurar todas las propiedades, continuando..."
                }
                
                # Realizar el escaneo usando CommonDialog (más confiable)
                $commonDialog = New-Object -ComObject WIA.CommonDialog
                Write-Host "Iniciando escaneo..."
                $imageFile = $commonDialog.ShowTransfer($item, "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}", $false)
                
                if ($imageFile -eq $null) {
                  Write-Error "El escaneo fue cancelado o falló"
                  exit 1
                }
                
                # Guardar el archivo
                $imageFile.SaveFile("${scanFilePath.replace(/\\/g, '\\\\')}")
                Write-Host "Escaneo completado exitosamente: ${scanFilePath.replace(/\\/g, '\\\\')}"
                exit 0
              } catch {
                Write-Error "Error en WIA: $($_.Exception.Message)"
                Write-Error "Tipo de error: $($_.Exception.GetType().FullName)"
                if ($_.Exception.InnerException) {
                  Write-Error "Error interno: $($_.Exception.InnerException.Message)"
                }
                exit 1
              }
            `;
            const scriptPath = path.join(tempDir, `scan-${Date.now()}.ps1`);
            fs.writeFileSync(scriptPath, wiaScript, 'utf8');
            
            try {
              const { stdout, stderr } = await execAsync(
                `powershell -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}"`,
                { timeout: 60000, encoding: 'utf8' }
              );
              
              console.log('WIA stdout:', stdout);
              if (stderr) console.warn('WIA stderr:', stderr);
              
              // Esperar un momento para que el archivo se escriba
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              if (fs.existsSync(scanFilePath) && fs.statSync(scanFilePath).size > 0) {
                scanSuccess = true;
                console.log('Escaneo exitoso con WIA');
              } else {
                console.warn('WIA no generó archivo o está vacío');
              }
            } catch (wiaError) {
              console.warn('Error con WIA:', wiaError.message);
              if (wiaError.stdout) console.log('WIA stdout:', wiaError.stdout);
              if (wiaError.stderr) console.log('WIA stderr:', wiaError.stderr);
              lastError = wiaError;
            } finally {
              if (fs.existsSync(scriptPath)) {
                try {
                  fs.unlinkSync(scriptPath);
                } catch (e) {
                  console.warn('No se pudo eliminar script temporal:', e.message);
                }
              }
            }
          } catch (wiaError) {
            console.warn('Error al intentar WIA:', wiaError.message);
            lastError = wiaError;
          }
        }
        
        if (!scanSuccess) {
          const errorMsg = lastError 
            ? `No se pudo escanear. ${lastError.message}. Verifica que el escáner esté conectado y que haya un documento en la cama del escáner.`
            : 'No se encontró software de escaneo. Instala Epson Scan o verifica que el escáner esté configurado en Windows.';
          throw new Error(errorMsg);
        }
        
      } else if (platform === 'linux' || platform === 'darwin') {
        const colorOption = isColor ? '--mode=Color' : '--mode=Gray';
        const scanCommand = `scanimage ${colorOption} --format=jpeg --resolution=300 > "${scanFilePath}"`;
        console.log('Ejecutando comando:', scanCommand);
        
        try {
          await execAsync(scanCommand, { timeout: 60000 });
          // Esperar un momento para que el archivo se escriba
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (scanError) {
          console.error('Error con scanimage:', scanError.message);
          throw new Error(`Error al escanear: ${scanError.message}. Verifica que SANE esté instalado y que el escáner esté conectado.`);
        }
      }
      
      // Verificar que el archivo se creó y tiene contenido
      if (!fs.existsSync(scanFilePath)) {
        throw new Error('El escaneo no generó ningún archivo. Verifica que el documento esté en la cama del escáner y que el escáner esté funcionando.');
      }
      
      const fileStats = fs.statSync(scanFilePath);
      if (fileStats.size === 0) {
        fs.unlinkSync(scanFilePath);
        throw new Error('El archivo escaneado está vacío. Verifica que el documento esté bien colocado en la cama del escáner.');
      }
      
      console.log('Archivo escaneado creado exitosamente:', scanFilePath, 'Tamaño:', fileStats.size, 'bytes');
      
    } catch (scanError) {
      console.error('Error al escanear para fotocopia:', scanError);
      // Limpiar archivo si existe pero está vacío o corrupto
      if (fs.existsSync(scanFilePath)) {
        try {
          fs.unlinkSync(scanFilePath);
        } catch (unlinkError) {
          console.warn('No se pudo eliminar archivo temporal:', unlinkError.message);
        }
      }
      throw new Error(`Error al escanear: ${scanError.message}`);
    }
    
    // Paso 2: Imprimir
    try {
      const printOptions = {
        printer: printerName.trim(),
        copies: numCopies,
        color: isColor,
        silent: false,
      };
      
      await print(scanFilePath, printOptions);
    } catch (printError) {
      console.error('Error al imprimir fotocopia:', printError);
      // Limpiar archivo escaneado
      if (fs.existsSync(scanFilePath)) fs.unlinkSync(scanFilePath);
      throw new Error(`Error al imprimir: ${printError.message}`);
    }
    
    // Limpiar archivo temporal
    if (fs.existsSync(scanFilePath)) {
      fs.unlinkSync(scanFilePath);
    }
    
    res.json({
      success: true,
      message: `Se fotocopiaron ${numCopies} copia(s) en modo ${isColor ? 'color' : 'blanco y negro'}`,
      details: {
        printer: printerName,
        copies: numCopies,
        colorMode: isColor ? 'color' : 'bw',
      }
    });
    
  } catch (error) {
    console.error('Error en fotocopia:', error);
    
    // Mensaje de error más descriptivo
    let errorMessage = error.message || 'No se pudo completar la fotocopia.';
    let suggestions = [];
    
    if (error.message.includes('escaneo') || error.message.includes('escanear')) {
      suggestions.push('1. Verifica que el escáner esté encendido y conectado');
      suggestions.push('2. Asegúrate de que haya un documento colocado en la cama del escáner');
      suggestions.push('3. En Windows, instala "Epson Scan" desde el sitio web de Epson');
      suggestions.push('4. Verifica que el escáner esté configurado en Windows (Configuración → Dispositivos → Escáneres)');
    } else if (error.message.includes('imprimir')) {
      suggestions.push('1. Verifica que la impresora esté encendida y conectada');
      suggestions.push('2. Asegúrate de tener papel y tinta suficiente');
      suggestions.push('3. Verifica que el nombre de la impresora sea correcto');
    }
    
    res.status(500).json({
      error: 'Error al realizar la fotocopia',
      message: errorMessage,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        platform: os.platform(),
      } : undefined,
    });
  }
};

/**
 * Obtener lista de impresoras disponibles
 */
export const getAvailablePrinters = async (req, res) => {
  try {
    // pdf-to-printer no tiene una función getPrinters directa en todas las versiones
    // En Windows, podemos usar el comando wmic, en Linux/Mac usar lpstat o lpinfo
    let printers = [];
    const platform = os.platform();
    
    try {
      if (platform === 'win32') {
        // Windows: usar wmic para obtener impresoras
        const { stdout } = await execAsync('wmic printer get name');
        printers = stdout
          .split('\n')
          .filter(line => line.trim() && !line.includes('Name'))
          .map(line => line.trim())
          .filter(Boolean);
      } else if (platform === 'linux') {
        // Linux: usar lpstat
        const { stdout } = await execAsync('lpstat -p 2>/dev/null | cut -d" " -f2 || lpinfo -v 2>/dev/null | grep -i "usb\|network" || echo ""');
        printers = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.trim())
          .filter(Boolean);
      } else if (platform === 'darwin') {
        // macOS: usar lpstat
        const { stdout } = await execAsync('lpstat -p 2>/dev/null | cut -d" " -f2 || echo ""');
        printers = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.trim())
          .filter(Boolean);
      }
    } catch (execError) {
      console.warn('No se pudieron obtener impresoras automáticamente:', execError.message);
      // Continuar con lista vacía
    }
    
    res.json({
      success: true,
      printers: printers || [],
      message: printers.length === 0 
        ? 'No se encontraron impresoras. Asegúrate de que la impresora esté instalada y conectada.'
        : `${printers.length} impresora(s) encontrada(s)`,
    });
  } catch (error) {
    console.error('Error al obtener impresoras:', error);
    res.status(500).json({
      error: 'Error al obtener la lista de impresoras',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      printers: [], // Devolver lista vacía en caso de error
    });
  }
};

