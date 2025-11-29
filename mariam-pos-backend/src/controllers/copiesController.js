import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import pdfToPrinter from 'pdf-to-printer';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

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
    const platform = os.platform();

    // Opciones de impresión
    const printOptions = {
      printer: printerName.trim(),
      copies: numCopies,
      pages: '1-', // Imprimir todas las páginas
      color: isColor,
      silent: false, // Mostrar diálogo de impresión (opcional)
    };

    // Si es una imagen (JPG/PNG), convertir a PDF antes de imprimir
    // pdf-to-printer funciona mejor con PDFs que con imágenes directamente
    let fileToPrint = req.file.path;
    let tempPdfPath = null;
    
    if (req.file.mimetype.startsWith('image/')) {
      try {
        console.log('Convirtiendo imagen a PDF para impresión...');
        const imageBuffer = fs.readFileSync(req.file.path);
        
        // Procesar imagen según el modo de color
        let processedImageBuffer = imageBuffer;
        if (!isColor) {
          // Convertir a escala de grises si es blanco y negro
          processedImageBuffer = await sharp(imageBuffer)
            .greyscale()
            .toBuffer();
          printOptions.color = false;
        }
        
        // Crear PDF con la imagen manteniendo el tamaño original
        const pdfDoc = await PDFDocument.create();
        
        // Obtener dimensiones reales de la imagen usando sharp
        const imageMetadata = await sharp(processedImageBuffer).metadata();
        const imageWidth = imageMetadata.width || 0;
        const imageHeight = imageMetadata.height || 0;
        const imageDpi = imageMetadata.density || 72; // DPI de la imagen, default 72
        
        // Convertir dimensiones de píxeles a puntos PDF
        // 1 punto = 1/72 pulgada, así que: puntos = (píxeles / DPI) * 72
        const pdfWidth = (imageWidth / imageDpi) * 72;
        const pdfHeight = (imageHeight / imageDpi) * 72;
        
        console.log('Dimensiones de imagen:', {
          width: imageWidth,
          height: imageHeight,
          dpi: imageDpi,
          pdfWidth: pdfWidth,
          pdfHeight: pdfHeight
        });
        
        // Crear página con las dimensiones exactas
        const page = pdfDoc.addPage([pdfWidth, pdfHeight]);
        
        // Embed la imagen
        let image;
        if (req.file.mimetype === 'image/png') {
          image = await pdfDoc.embedPng(processedImageBuffer);
        } else {
          // JPG o JPEG
          image = await pdfDoc.embedJpg(processedImageBuffer);
        }
        
        // Dibujar la imagen en tamaño completo sin escalar
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pdfWidth,
          height: pdfHeight,
        });
        
        // Guardar PDF temporalmente
        const pdfBytes = await pdfDoc.save();
        tempPdfPath = path.join(os.tmpdir(), `print-${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`);
        fs.writeFileSync(tempPdfPath, pdfBytes);
        fileToPrint = tempPdfPath;
        console.log('Imagen convertida a PDF:', tempPdfPath);
      } catch (conversionError) {
        console.error('Error al convertir imagen a PDF:', conversionError);
        // Si falla la conversión, intentar imprimir la imagen directamente
        console.warn('Intentando imprimir imagen directamente...');
      }
    } else if (!isColor) {
      // Si es PDF y es blanco y negro, forzar color: false
      printOptions.color = false;
    }

    console.log('Enviando trabajo de impresión:', {
      printer: printerName,
      copies: numCopies,
      color: isColor,
      colorMode: colorMode,
      file: req.file.filename,
      platform: platform,
      printOptions: JSON.stringify(printOptions),
      fileToPrint: fileToPrint,
      isPdf: fileToPrint.endsWith('.pdf'),
    });

    // Imprimir el archivo
    await print(fileToPrint, printOptions);

    // Limpiar archivo temporal de PDF si se creó
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
        console.log('Archivo PDF temporal eliminado:', tempPdfPath);
      } catch (cleanupError) {
        console.warn('No se pudo eliminar archivo PDF temporal:', cleanupError.message);
      }
    }

    // Limpiar archivo temporal original después de imprimir
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('No se pudo eliminar archivo temporal original:', cleanupError.message);
      }
    }

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
    const { scannerName, colorMode = 'bw', format = 'jpg' } = req.body;
    const platform = os.platform();
    const tempDir = os.tmpdir();
    let scanFileName = `scan-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    const scanFilePath = path.join(tempDir, scanFileName);
    
    const isColor = colorMode === 'color';
    let scanSuccess = false;
    let lastError = null;
    
    console.log('Iniciando escaneo...', { platform, scanFilePath, colorMode });
    
    try {
      if (platform === 'win32') {
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
        
        // Método 2: Si Epson Scan falla, intentar con WIA
        if (!scanSuccess) {
          try {
            console.log('Intentando escanear con WIA (Windows Image Acquisition)...');
            const wiaScript = `
              $ErrorActionPreference = "Stop"
              try {
                $deviceManager = New-Object -ComObject WIA.DeviceManager
                if ($deviceManager.DeviceInfos.Count -eq 0) {
                  Write-Error "No se encontraron dispositivos de escaneo"
                  exit 1
                }
                $deviceInfo = $deviceManager.DeviceInfos.Item(1)
                $device = $deviceInfo.Connect()
                if ($device.Items.Count -eq 0) {
                  Write-Error "No se encontraron elementos para escanear"
                  exit 1
                }
                $item = $device.Items.Item(1)
                $colorMode = ${isColor ? '1' : '2'}
                try {
                  $item.Properties.Item("6148").Value = $colorMode
                } catch {}
                $commonDialog = New-Object -ComObject WIA.CommonDialog
                $imageFile = $commonDialog.ShowTransfer($item, "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}", $false)
                if ($imageFile -eq $null) {
                  Write-Error "El escaneo fue cancelado o falló"
                  exit 1
                }
                $imageFile.SaveFile("${scanFilePath.replace(/\\/g, '\\\\')}")
                Write-Host "Escaneo completado"
                exit 0
              } catch {
                Write-Error "Error: $($_.Exception.Message)"
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
              }
            } catch (wiaError) {
              console.warn('Error con WIA:', wiaError.message);
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
      
      // Leer el archivo escaneado
      let scanBuffer = fs.readFileSync(scanFilePath);
      
      // Convertir formato si es necesario
      // Nota: Si format es 'pdf', siempre devolvemos JPG para que el frontend
      // pueda agregar múltiples páginas antes de crear el PDF final
      if (format === 'png') {
        // Convertir JPG a PNG usando sharp
        scanBuffer = await sharp(scanBuffer)
          .png()
          .toBuffer();
        scanFileName = scanFileName.replace('.jpg', '.png');
      }
      // Si format es 'pdf', mantenemos como JPG para que el frontend lo maneje
      
      // Limpiar archivo temporal
      fs.unlinkSync(scanFilePath);
      
      // Enviar el archivo como respuesta
      // Si format es 'pdf', devolvemos como JPG para que el frontend lo agregue a la lista
      const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${scanFileName}"`);
      res.send(scanBuffer);
      
    } catch (scanError) {
      console.error('Error al escanear:', scanError);
      
      // Limpiar archivo temporal si existe
      if (fs.existsSync(scanFilePath)) {
        try {
          fs.unlinkSync(scanFilePath);
        } catch (unlinkError) {
          console.warn('No se pudo eliminar archivo temporal:', unlinkError.message);
        }
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
      const platform = os.platform();
      let fileToPrint = scanFilePath;
      let tempPdfPath = null;
      
      // Convertir imagen escaneada a PDF antes de imprimir
      // pdf-to-printer funciona mejor con PDFs que con imágenes directamente
      try {
        console.log('Convirtiendo imagen escaneada a PDF para impresión...');
        const imageBuffer = fs.readFileSync(scanFilePath);
        
        // Procesar imagen según el modo de color
        let processedImageBuffer = imageBuffer;
        if (!isColor) {
          // Convertir a escala de grises si es blanco y negro
          processedImageBuffer = await sharp(imageBuffer)
            .greyscale()
            .toBuffer();
        }
        
        // Crear PDF con la imagen manteniendo el tamaño original
        const pdfDoc = await PDFDocument.create();
        
        // Obtener dimensiones reales de la imagen usando sharp
        const imageMetadata = await sharp(processedImageBuffer).metadata();
        const imageWidth = imageMetadata.width || 0;
        const imageHeight = imageMetadata.height || 0;
        const imageDpi = imageMetadata.density || 72; // DPI de la imagen, default 72
        
        // Convertir dimensiones de píxeles a puntos PDF
        // 1 punto = 1/72 pulgada, así que: puntos = (píxeles / DPI) * 72
        const pdfWidth = (imageWidth / imageDpi) * 72;
        const pdfHeight = (imageHeight / imageDpi) * 72;
        
        console.log('Dimensiones de imagen escaneada:', {
          width: imageWidth,
          height: imageHeight,
          dpi: imageDpi,
          pdfWidth: pdfWidth,
          pdfHeight: pdfHeight
        });
        
        // Crear página con las dimensiones exactas
        const page = pdfDoc.addPage([pdfWidth, pdfHeight]);
        
        // Embed la imagen
        const image = await pdfDoc.embedJpg(processedImageBuffer);
        
        // Dibujar la imagen en tamaño completo sin escalar
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pdfWidth,
          height: pdfHeight,
        });
        
        // Guardar PDF temporalmente
        const pdfBytes = await pdfDoc.save();
        tempPdfPath = path.join(os.tmpdir(), `photocopy-${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`);
        fs.writeFileSync(tempPdfPath, pdfBytes);
        fileToPrint = tempPdfPath;
        console.log('Imagen escaneada convertida a PDF:', tempPdfPath);
      } catch (conversionError) {
        console.error('Error al convertir imagen a PDF:', conversionError);
        // Si falla la conversión, intentar imprimir la imagen directamente
        console.warn('Intentando imprimir imagen directamente...');
      }

      const printOptions = {
        printer: printerName.trim(),
        copies: numCopies,
        color: isColor,
        silent: false,
      };

      console.log('Opciones de impresión para fotocopia:', {
        printer: printerName,
        copies: numCopies,
        color: isColor,
        colorMode: colorMode,
        platform: platform,
        printOptions: JSON.stringify(printOptions),
        fileToPrint: fileToPrint,
        isPdf: fileToPrint.endsWith('.pdf'),
      });
      
      await print(fileToPrint, printOptions);

      // Limpiar archivo temporal de PDF si se creó
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
          console.log('Archivo PDF temporal eliminado:', tempPdfPath);
        } catch (cleanupError) {
          console.warn('No se pudo eliminar archivo PDF temporal:', cleanupError.message);
        }
      }
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
 * Crear PDF a partir de múltiples imágenes
 */
export const createPdfFromImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron imágenes' });
    }

    const pdfDoc = await PDFDocument.create();
    const tempDir = os.tmpdir();
    const tempFiles = [];

    try {
      // Procesar cada imagen y agregarla al PDF
      for (const file of req.files) {
        const imageBuffer = fs.readFileSync(file.path);
        let image;

        try {
          // Intentar como JPG
          image = await pdfDoc.embedJpg(imageBuffer);
        } catch {
          try {
            // Si falla, intentar como PNG
            image = await pdfDoc.embedPng(imageBuffer);
          } catch {
            // Si ambos fallan, convertir a PNG primero
            const pngBuffer = await sharp(imageBuffer).png().toBuffer();
            image = await pdfDoc.embedPng(pngBuffer);
          }
        }

        // Agregar página con la imagen
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });

        tempFiles.push(file.path);
      }

      // Generar el PDF
      const pdfBytes = await pdfDoc.save();

      // Limpiar archivos temporales
      tempFiles.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.warn('No se pudo eliminar archivo temporal:', filePath);
        }
      });

      // Enviar el PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="escaneo-${Date.now()}.pdf"`);
      res.send(pdfBytes);

    } catch (error) {
      // Limpiar archivos temporales en caso de error
      tempFiles.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          // Ignorar errores de limpieza
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Error al crear PDF desde imágenes:', error);
    res.status(500).json({
      error: 'Error al crear PDF',
      message: error.message || 'No se pudo crear el PDF desde las imágenes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Combinar dos imágenes en una sola (lado a lado o vertical)
 */
export const combineImages = async (req, res) => {
  try {
    if (!req.files || req.files.length !== 2) {
      return res.status(400).json({ error: 'Se requieren exactamente 2 imágenes para combinar' });
    }

    // Leer layout del body (puede venir como string en FormData)
    const layout = (req.body.layout || 'horizontal').toString().toLowerCase();
    const tempDir = os.tmpdir();
    const tempFiles = [];

    try {
      // Leer ambas imágenes
      const image1Buffer = fs.readFileSync(req.files[0].path);
      const image2Buffer = fs.readFileSync(req.files[1].path);

      // Obtener dimensiones de ambas imágenes
      const image1 = sharp(image1Buffer);
      const image2 = sharp(image2Buffer);
      
      const image1Metadata = await image1.metadata();
      const image2Metadata = await image2.metadata();

      let combinedImage;

      if (layout === 'horizontal') {
        // Combinar lado a lado (horizontal)
        const totalWidth = image1Metadata.width + image2Metadata.width;
        const maxHeight = Math.max(image1Metadata.height, image2Metadata.height);
        
        // Crear imagen combinada
        combinedImage = sharp({
          create: {
            width: totalWidth,
            height: maxHeight,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        })
        .composite([
          { input: image1Buffer, left: 0, top: 0 },
          { input: image2Buffer, left: image1Metadata.width, top: 0 }
        ]);
      } else {
        // Combinar verticalmente (una arriba de la otra)
        const maxWidth = Math.max(image1Metadata.width, image2Metadata.width);
        const totalHeight = image1Metadata.height + image2Metadata.height;
        
        combinedImage = sharp({
          create: {
            width: maxWidth,
            height: totalHeight,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        })
        .composite([
          { input: image1Buffer, left: 0, top: 0 },
          { input: image2Buffer, left: 0, top: image1Metadata.height }
        ]);
      }

      // Convertir a JPG y guardar
      const combinedBuffer = await combinedImage.jpeg({ quality: 95 }).toBuffer();
      const combinedFileName = `combined-${Date.now()}.jpg`;
      const combinedPath = path.join(tempDir, combinedFileName);
      fs.writeFileSync(combinedPath, combinedBuffer);

      // Limpiar archivos temporales originales
      req.files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (error) {
          console.warn('No se pudo eliminar archivo temporal:', file.path);
        }
      });

      // Enviar la imagen combinada
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${combinedFileName}"`);
      res.send(combinedBuffer);

      // Limpiar archivo combinado después de enviarlo
      setTimeout(() => {
        try {
          if (fs.existsSync(combinedPath)) {
            fs.unlinkSync(combinedPath);
          }
        } catch (error) {
          console.warn('No se pudo eliminar archivo combinado:', error.message);
        }
      }, 5000);

    } catch (error) {
      // Limpiar archivos temporales en caso de error
      req.files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (e) {
          // Ignorar errores de limpieza
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Error al combinar imágenes:', error);
    res.status(500).json({
      error: 'Error al combinar imágenes',
      message: error.message || 'No se pudieron combinar las imágenes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
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

