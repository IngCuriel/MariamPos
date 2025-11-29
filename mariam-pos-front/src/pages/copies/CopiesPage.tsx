import React, { useState, useRef } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { printCopies, photocopy, scanDocument, createPdfFromImages, combineImages } from '../../api/copies';
import Swal from 'sweetalert2';
import { PDFDocument } from 'pdf-lib';
import '../../styles/pages/copies/copiesPage.css';

interface CopiesPageProps {
  onBack: () => void;
}

interface Printer {
  id: string;
  name: string;
  isDefault: boolean;
}

const STORAGE_KEY_PRINTERS = 'mariam_pos_printers';
const STORAGE_KEY_DEFAULT_PRINTER = 'mariam_pos_default_printer';

const CopiesPage: React.FC<CopiesPageProps> = ({ onBack }) => {
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('bw');
  const [printerName, setPrinterName] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPhotocopying, setIsPhotocopying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [mode, setMode] = useState<'print' | 'photocopy' | 'scan'>('print');
  const [doubleSided, setDoubleSided] = useState<boolean>(false); // Opción de doble cara
  const [photocopySide, setPhotocopySide] = useState<'first' | 'second' | null>(null); // Estado del escaneo de doble cara
  const [, setFirstSideBlob] = useState<Blob | null>(null); // Primera cara escaneada (solo para limpiar estado)
  const [pdfPageCount, setPdfPageCount] = useState<number>(0); // Número de páginas del PDF
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [newPrinterName, setNewPrinterName] = useState<string>('');
  const [scanFormat, setScanFormat] = useState<'jpg' | 'png' | 'pdf'>('jpg');
  const [pdfPages, setPdfPages] = useState<Blob[]>([]); // Páginas escaneadas para PDF
  const pdfPagesRef = React.useRef<Blob[]>([]); // Ref para mantener referencia actualizada
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar impresoras y predeterminada al iniciar
  React.useEffect(() => {
    loadPrinters();
    loadDefaultPrinter();
  }, []);

  // Limpiar páginas PDF cuando se cambia de modo
  React.useEffect(() => {
    if (mode !== 'scan') {
      setPdfPages([]);
      pdfPagesRef.current = [];
    }
    // Limpiar estados de doble cara cuando se cambia de modo
    if (mode !== 'photocopy') {
      setDoubleSided(false);
      setPhotocopySide(null);
      setFirstSideBlob(null);
    }
  }, [mode]);


  const loadPrinters = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRINTERS);
      if (saved) {
        const parsed = JSON.parse(saved) as Printer[];
        setPrinters(parsed);
      }
    } catch (error) {
      console.error('Error al cargar impresoras:', error);
    }
  };

  const loadDefaultPrinter = () => {
    try {
      const defaultName = localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER);
      if (defaultName) {
        setPrinterName(defaultName);
      }
    } catch (error) {
      console.error('Error al cargar impresora predeterminada:', error);
    }
  };


  const savePrinters = (printerList: Printer[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(printerList));
      setPrinters(printerList);
    } catch (error) {
      console.error('Error al guardar impresoras:', error);
    }
  };

  const saveDefaultPrinter = (name: string) => {
    try {
      localStorage.setItem(STORAGE_KEY_DEFAULT_PRINTER, name);
      setPrinterName(name);
    } catch (error) {
      console.error('Error al guardar impresora predeterminada:', error);
    }
  };

  const handleCopiesChange = (value: number) => {
    if (value < 1) value = 1;
    if (value > 100) value = 100;
    setCopies(value);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Función para detectar páginas del PDF
  const detectPdfPages = async (file: File) => {
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        setPdfPageCount(pageCount);
        console.log(`PDF detectado con ${pageCount} página(s)`);
      } catch (error) {
        console.error('Error al leer PDF:', error);
        setPdfPageCount(1);
      }
    } else {
      setPdfPageCount(1);
    }
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Detectar páginas del PDF
    await detectPdfPages(file);
  };


  const handleScan = async () => {
    setIsScanning(true);

    try {
      const format = scanFormat === 'pdf' ? 'jpg' : scanFormat; // Siempre escanear como JPG, luego convertir si es necesario
      // En modo escanear, siempre usar color por defecto
      const blob = await scanDocument({
        colorMode: 'color', // Siempre color por defecto en escaneo
        format,
      });

      if (scanFormat === 'pdf') {
        // Si es PDF, agregar a la lista de páginas usando función de actualización
        let updatedPages: Blob[] = [];
        setPdfPages((prevPages) => {
          updatedPages = [...prevPages, blob];
          pdfPagesRef.current = updatedPages; // Actualizar ref también
          return updatedPages;
        });

        const pagesCount = updatedPages.length;
        
        // Mostrar alerta con el conteo actualizado - SIN timer para que el usuario pueda decidir
        Swal.fire({
          icon: 'success',
          title: '¡Página escaneada!',
          html: `
            <p>Página agregada al PDF</p>
            <p style="margin-top: 10px; font-weight: bold;">Total de páginas: ${pagesCount}</p>
            <p style="margin-top: 10px; font-size: 14px;">¿Deseas agregar más páginas?</p>
          `,
          showCancelButton: true,
          confirmButtonText: 'Agregar otra página',
          cancelButtonText: 'Finalizar PDF y Agregar al Carrito',
          allowOutsideClick: false,
          allowEscapeKey: true,
          timer: undefined, // Sin timer automático
        }).then((result) => {
          if (result.isConfirmed) {
            // Si confirmó "Agregar otra página", no hacer nada
            // El usuario puede hacer clic en "Escanear" de nuevo para agregar otra página
          } else if (result.isDismissed || result.dismiss) {
            // Si canceló o cerró, finalizar PDF y agregar al carrito
            // Usar el ref que tiene el valor más actualizado
            const finalPages = pdfPagesRef.current.length > 0 ? pdfPagesRef.current : updatedPages;
            handleFinalizePdfWithPages(finalPages);
          }
        });
      } else {
        // Si es JPG o PNG, descargar y agregar al carrito
        const extension = scanFormat;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `escaneo-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        Swal.fire({
          icon: 'success',
          title: '¡Escaneo completado!',
          text: 'El documento se ha escaneado y descargado correctamente',
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error: any) {
      console.error('Error al escanear:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al escanear',
        text: error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo escanear el documento. Asegúrate de que haya un documento en la cama del escáner.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFinalizePdf = async () => {
    // Usar el ref para obtener el estado más actualizado
    const currentPages = pdfPagesRef.current.length > 0 ? pdfPagesRef.current : pdfPages;
    await handleFinalizePdfWithPages(currentPages);
  };

  const handleFinalizePdfWithPages = async (pages: Blob[]) => {
    if (pages.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay páginas',
        text: 'No hay páginas escaneadas para crear el PDF',
      });
      return;
    }

    const pagesCount = pages.length;

    try {
      setIsScanning(true);
      console.log(`Creando PDF con ${pagesCount} página(s)`);
      
      // Verificar que todas las páginas sean válidas
      if (!pages || pages.length === 0) {
        throw new Error('No hay páginas válidas para crear el PDF');
      }

      const pdfBlob = await createPdfFromImages(pages);

      // Verificar que el PDF se creó correctamente
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('El PDF generado está vacío');
      }

      // Descargar el PDF
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `escaneo-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Limpiar páginas
      setPdfPages([]);
      pdfPagesRef.current = []; // Limpiar ref también

      Swal.fire({
        icon: 'success',
        title: '¡PDF creado y descargado!',
        text: `Se creó un PDF con ${pagesCount} página${pagesCount > 1 ? 's' : ''}`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Error al crear PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al crear PDF',
        text: error.response?.data?.error || error.message || 'No se pudo crear el PDF',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearPdfPages = () => {
    Swal.fire({
      title: '¿Limpiar páginas?',
      text: `¿Estás seguro de eliminar las ${pdfPages.length} página(s) escaneadas?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        setPdfPages([]);
        pdfPagesRef.current = [];
        Swal.fire({
          icon: 'success',
          title: 'Páginas limpiadas',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  };

  const handlePhotocopy = async () => {
    // Usar la impresora por defecto automáticamente
    const defaultPrinter = printerName.trim() || localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER) || '';
    
    if (!defaultPrinter) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay impresora configurada',
        text: 'Por favor, configura una impresora por defecto en la configuración',
        confirmButtonText: 'Ir a Configuración',
      }).then((result) => {
        if (result.isConfirmed) {
          setShowConfigModal(true);
        }
      });
      return;
    }

    // Si es doble cara y aún no se ha escaneado la primera cara
    if (doubleSided && photocopySide === null) {
      // Escanear primera cara
      setIsPhotocopying(true);
      setPhotocopySide('first');
      
      try {
        const scannedFirstSide = await scanDocument({
          colorMode: 'color', // Siempre escanear en color para doble cara
          format: 'jpg',
        });
        
        setFirstSideBlob(scannedFirstSide);
        setIsPhotocopying(false);
        
        // Guardar referencia local para usar en el closure
        const firstSideForCombining = scannedFirstSide;
        
        // Pedir al usuario que voltee el documento
        await Swal.fire({
          icon: 'info',
          title: 'Frente escaneado',
          html: `
            <p>El frente de la credencial se ha escaneado correctamente.</p>
            <p style="margin-top: 15px; font-weight: bold;">Por favor:</p>
            <ol style="text-align: left; margin-top: 10px;">
              <li>Voltea la credencial</li>
              <li>Coloca el reverso en la cama del escáner</li>
              <li>Haz clic en "Continuar" para escanear el reverso</li>
            </ol>
            <p style="margin-top: 15px; font-size: 12px; color: #666;">
              Ambas caras se combinarán en una sola hoja para imprimir
            </p>
          `,
          confirmButtonText: 'Continuar con reverso',
          cancelButtonText: 'Cancelar',
          showCancelButton: true,
        }).then(async (result) => {
          if (result.isConfirmed) {
            // Escanear segunda cara
            setIsPhotocopying(true);
            setPhotocopySide('second');
            
            try {
              const secondSideBlob = await scanDocument({
                colorMode: 'color',
                format: 'jpg',
              });
              
              // Combinar ambas caras en una sola imagen (lado a lado - horizontal)
              // Usar la referencia local que guardamos antes del closure
              const combinedImageBlob = await combineImages([firstSideForCombining, secondSideBlob], 'horizontal');
              
              // Imprimir la imagen combinada
              const formData = new FormData();
              const combinedFile = new File([combinedImageBlob], 'double-sided.jpg', { type: 'image/jpeg' });
              formData.append('file', combinedFile);
              formData.append('copies', copies.toString());
              formData.append('colorMode', colorMode);
              formData.append('printerName', defaultPrinter);
              
              await printCopies(formData);
              
              // Limpiar estados
              setFirstSideBlob(null);
              setPhotocopySide(null);
              
              Swal.fire({
                icon: 'success',
                title: '¡Fotocopia doble cara completada!',
                text: `Se fotocopiaron ${copies} copia(s) a doble cara (frente y reverso combinados en una sola hoja)`,
                timer: 3000,
                showConfirmButton: false,
              });
            } catch (error: any) {
              console.error('Error al escanear segunda cara:', error);
              setFirstSideBlob(null);
              setPhotocopySide(null);
              Swal.fire({
                icon: 'error',
                title: 'Error al escanear reverso',
                text: error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo escanear el reverso de la credencial.',
              });
            } finally {
              setIsPhotocopying(false);
            }
          } else {
            // Cancelar - limpiar estados
            setFirstSideBlob(null);
            setPhotocopySide(null);
          }
        });
      } catch (error: any) {
        console.error('Error al escanear primera cara:', error);
        setPhotocopySide(null);
        Swal.fire({
          icon: 'error',
                title: 'Error al escanear frente',
                text: error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo escanear el frente de la credencial.',
        });
      } finally {
        setIsPhotocopying(false);
      }
      return;
    }

    // Fotocopia simple (una cara)
    setIsPhotocopying(true);

    try {
      await photocopy({
        copies,
        colorMode,
        printerName: defaultPrinter,
      });

      Swal.fire({
        icon: 'success',
        title: '¡Fotocopia completada!',
        text: `Se fotocopiaron ${copies} copia(s) correctamente`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Error al fotocopiar:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al fotocopiar',
        text: error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo completar la fotocopia.',
      });
    } finally {
      setIsPhotocopying(false);
    }
  };

  const handlePrint = async (file?: File) => {
    // Usar la impresora por defecto automáticamente
    const defaultPrinter = printerName.trim() || localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER) || '';
    
    if (!defaultPrinter) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay impresora configurada',
        text: 'Por favor, configura una impresora por defecto en la configuración',
        confirmButtonText: 'Ir a Configuración',
      }).then((result) => {
        if (result.isConfirmed) {
          setShowConfigModal(true);
        }
      });
      return;
    }

    if (!file && !fileInputRef.current?.files?.[0]) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay archivo seleccionado',
        text: 'Por favor, selecciona un archivo para imprimir',
      });
      return;
    }

    const fileToPrint = file || fileInputRef.current?.files?.[0];
    if (!fileToPrint) return;

    // Calcular número de páginas si es PDF y aún no se ha detectado
    let pagesToPrint = pdfPageCount || 1;
    if (fileToPrint.type === 'application/pdf' && pdfPageCount === 0) {
      try {
        const arrayBuffer = await fileToPrint.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        pagesToPrint = pdfDoc.getPageCount();
        setPdfPageCount(pagesToPrint);
      } catch (error) {
        console.error('Error al leer PDF:', error);
        pagesToPrint = 1;
      }
    }

    setIsPrinting(true);

    try {
      const formData = new FormData();
      formData.append('file', fileToPrint);
      formData.append('copies', copies.toString());
      formData.append('colorMode', colorMode);
      formData.append('printerName', defaultPrinter);

      await printCopies(formData);

      const totalPages = pagesToPrint * copies;
      Swal.fire({
        icon: 'success',
        title: '¡Copias enviadas!',
        text: `Se enviaron ${copies} copia(s) del archivo (${totalPages} página${totalPages > 1 ? 's' : ''} en total)`,
        timer: 3000,
        showConfirmButton: false,
      });

      // Limpiar formulario
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error al imprimir:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al imprimir',
        text: error.response?.data?.error || error.message || 'No se pudo enviar el trabajo de impresión',
      });
    } finally {
      setIsPrinting(false);
    }
  };


  const handleAddPrinter = () => {
    if (!newPrinterName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Por favor, ingresa el nombre de la impresora',
      });
      return;
    }

    const newPrinter: Printer = {
      id: `printer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newPrinterName.trim(),
      isDefault: printers.length === 0, // Primera impresora es predeterminada
    };

    const updated = [...printers, newPrinter];
    savePrinters(updated);

    if (newPrinter.isDefault) {
      saveDefaultPrinter(newPrinter.name);
    }

    setNewPrinterName('');
    Swal.fire({
      icon: 'success',
      title: 'Impresora agregada',
      text: `La impresora "${newPrinter.name}" ha sido agregada`,
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const handleEditPrinter = (printer: Printer) => {
    setEditingPrinter(printer);
    setNewPrinterName(printer.name);
  };

  const handleUpdatePrinter = () => {
    if (!editingPrinter || !newPrinterName.trim()) {
      return;
    }

    const updated = printers.map(p =>
      p.id === editingPrinter.id
        ? { ...p, name: newPrinterName.trim() }
        : p
    );

    savePrinters(updated);

    // Si era la predeterminada, actualizar también
    if (editingPrinter.isDefault) {
      saveDefaultPrinter(newPrinterName.trim());
    }

    setEditingPrinter(null);
    setNewPrinterName('');
    Swal.fire({
      icon: 'success',
      title: 'Impresora actualizada',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const handleDeletePrinter = (printer: Printer) => {
    Swal.fire({
      title: '¿Eliminar impresora?',
      text: `¿Estás seguro de eliminar "${printer.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        const updated = printers.filter(p => p.id !== printer.id);

        // Si era la predeterminada, limpiar
        if (printer.isDefault) {
          localStorage.removeItem(STORAGE_KEY_DEFAULT_PRINTER);
          setPrinterName('');
        }

        // Si hay impresoras, hacer la primera predeterminada
        if (updated.length > 0 && printer.isDefault) {
          updated[0].isDefault = true;
          saveDefaultPrinter(updated[0].name);
        }

        savePrinters(updated);
        Swal.fire({
          icon: 'success',
          title: 'Impresora eliminada',
          timer: 2000,
          showConfirmButton: false,
        });
      }
    });
  };

  const handleSetDefault = (printer: Printer) => {
    const updated = printers.map(p => ({
      ...p,
      isDefault: p.id === printer.id,
    }));

    savePrinters(updated);
    saveDefaultPrinter(printer.name);
    Swal.fire({
      icon: 'success',
      title: 'Impresora predeterminada',
      text: `"${printer.name}" es ahora la impresora predeterminada`,
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const handleSelectPrinter = (printer: Printer) => {
    setPrinterName(printer.name);
    setShowConfigModal(false);
  };

  return (
    <div className="copies-page-fullscreen">
      <div className="copies-page-container-fullscreen">
        <div className="copies-page-header">
          <div className="copies-header-content">
            <button onClick={onBack} className="copies-back-button">
              ← Volver
            </button>
            <h1 className="copies-header-title">🖨️ Módulo de Copias</h1>
            <button
              onClick={() => setShowConfigModal(true)}
              className="copies-config-button"
              title="Configuración de impresoras"
            >
              ⚙️
            </button>
          </div>
        </div>

        <div className="copies-page-layout">
          {/* Panel izquierdo: Configuración */}
          <div className="copies-config-panel">
            <Card className="copies-config-card">
              <div className="copies-config-header">
                <h2 className="copies-config-title">Configuración</h2>
              </div>

              <div className="copies-form">
                {/* Selector de modo */}
                <div className="copies-form-group">
                  <label className="copies-form-label">
                    <span className="label-icon">📋</span>
                    Modo de operación
                  </label>
                  <div className="copies-mode-selector">
                    <Card
                      className={`copies-mode-option ${mode === 'print' ? 'active' : ''}`}
                      onClick={() => setMode('print')}
                      hoverable
                    >
                      <div className="mode-icon">📄</div>
                      <h3 className="mode-title">Imprimir</h3>
                    </Card>
                    <Card
                      className={`copies-mode-option ${mode === 'photocopy' ? 'active' : ''}`}
                      onClick={() => setMode('photocopy')}
                      hoverable
                    >
                      <div className="mode-icon">📷</div>
                      <h3 className="mode-title">Fotocopiar</h3>
                    </Card>
                    <Card
                      className={`copies-mode-option ${mode === 'scan' ? 'active' : ''}`}
                      onClick={() => setMode('scan')}
                      hoverable
                    >
                      <div className="mode-icon">📥</div>
                      <h3 className="mode-title">Escanear</h3>
                    </Card>
                  </div>
                </div>

                {/* Selector de archivo (solo para modo print) */}
                {mode === 'print' && (
                  <div className="copies-form-group">
                    <label className="copies-form-label">
                      <span className="label-icon">📄</span>
                      Archivo
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="copies-file-input"
                    />
                    <Button
                      onClick={handleFileSelect}
                      variant="secondary"
                      className="copies-file-button"
                    >
                      📁 Seleccionar archivo
                    </Button>
                    {fileInputRef.current?.files?.[0] && (
                      <div className="copies-file-info">
                        <span className="file-name">
                          📎 {fileInputRef.current.files[0].name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Información de páginas detectadas (solo para modo print con PDF) */}
                {mode === 'print' && pdfPageCount > 0 && (
                  <div className="copies-form-group">
                    <div className="copies-pages-info">
                      <span className="pages-icon">📄</span>
                      <span className="pages-text">
                        {pdfPageCount} página{pdfPageCount > 1 ? 's' : ''} detectada{pdfPageCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Cantidad (solo para imprimir y fotocopiar) */}
                {(mode === 'print' || mode === 'photocopy') && (
                  <div className="copies-form-group">
                    <label className="copies-form-label">
                      <span className="label-icon">🔢</span>
                      Cantidad
                    </label>
                    <div className="copies-quantity-controls">
                      <Button
                        onClick={() => handleCopiesChange(copies - 1)}
                        variant="secondary"
                        className="copies-quantity-button"
                        disabled={copies <= 1}
                      >
                        −
                      </Button>
                      <input
                        type="number"
                        value={copies}
                        onChange={(e) => handleCopiesChange(parseInt(e.target.value) || 1)}
                        min={1}
                        max={100}
                        className="copies-quantity-input"
                      />
                      <Button
                        onClick={() => handleCopiesChange(copies + 1)}
                        variant="secondary"
                        className="copies-quantity-button"
                        disabled={copies >= 100}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                {/* Modo de color (solo para impresión y fotocopia, no para escanear) */}
                {mode !== 'scan' && (
                  <div className="copies-form-group">
                    <label className="copies-form-label">
                      <span className="label-icon">🎨</span>
                      Modo
                    </label>
                    <div className="copies-color-options">
                      <Card
                        className={`copies-color-option ${colorMode === 'bw' ? 'active' : ''}`}
                        onClick={() => setColorMode('bw')}
                        hoverable
                      >
                        <div className="color-option-icon">⚫</div>
                        <h3 className="color-option-title">B&N</h3>
                      </Card>
                      <Card
                        className={`copies-color-option ${colorMode === 'color' ? 'active' : ''}`}
                        onClick={() => setColorMode('color')}
                        hoverable
                      >
                        <div className="color-option-icon">🌈</div>
                        <h3 className="color-option-title">Color</h3>
                        <p className="color-option-price">Según %</p>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Opción de doble cara (solo para fotocopia) */}
                {mode === 'photocopy' && (
                  <div className="copies-form-group">
                    <label className="copies-form-label">
                      <span className="label-icon">📄</span>
                      Tipo de fotocopia
                    </label>
                    <div className="copies-double-sided-option">
                      <Card
                        className={`copies-double-sided-card ${!doubleSided ? 'active' : ''}`}
                        onClick={() => {
                          setDoubleSided(false);
                          setPhotocopySide(null);
                          setFirstSideBlob(null);
                        }}
                        hoverable
                      >
                        <div className="double-sided-icon">📄</div>
                        <h3 className="double-sided-title">Una cara</h3>
                      </Card>
                      <Card
                        className={`copies-double-sided-card ${doubleSided ? 'active' : ''}`}
                        onClick={() => {
                          setDoubleSided(true);
                          setPhotocopySide(null);
                          setFirstSideBlob(null);
                        }}
                        hoverable
                      >
                        <div className="double-sided-icon">📄📄</div>
                        <h3 className="double-sided-title">Doble cara</h3>
                      </Card>
                    </div>
                    {doubleSided && (
                      <div className="copies-double-sided-info">
                        <p className="info-text">
                          {photocopySide === 'first' && '✅ Frente escaneado. Voltea la credencial y continúa con el reverso.'}
                          {photocopySide === 'second' && '⏳ Escaneando reverso...'}
                          {photocopySide === null && '📋 Primero se escaneará el frente, luego el reverso, y finalmente se combinarán en una sola hoja para imprimir.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}


                {/* Selector de formato (solo para modo escanear) */}
                {mode === 'scan' && (
                  <div className="copies-form-group">
                    <label className="copies-form-label">
                      <span className="label-icon">📄</span>
                      Formato de guardado
                    </label>
                    <div className="copies-format-options">
                      <Card
                        className={`copies-format-option ${scanFormat === 'jpg' ? 'active' : ''}`}
                        onClick={() => {
                          setScanFormat('jpg');
                          setPdfPages([]);
                          pdfPagesRef.current = []; // Limpiar páginas si cambia de PDF
                        }}
                        hoverable
                      >
                        <div className="format-icon">🖼️</div>
                        <h3 className="format-title">JPG</h3>
                        <p className="format-description">Imagen JPEG</p>
                      </Card>
                      <Card
                        className={`copies-format-option ${scanFormat === 'png' ? 'active' : ''}`}
                        onClick={() => {
                          setScanFormat('png');
                          setPdfPages([]);
                          pdfPagesRef.current = []; // Limpiar páginas si cambia de PDF
                        }}
                        hoverable
                      >
                        <div className="format-icon">🖼️</div>
                        <h3 className="format-title">PNG</h3>
                        <p className="format-description">Imagen PNG</p>
                      </Card>
                      <Card
                        className={`copies-format-option ${scanFormat === 'pdf' ? 'active' : ''}`}
                        onClick={() => setScanFormat('pdf')}
                        hoverable
                      >
                        <div className="format-icon">📕</div>
                        <h3 className="format-title">PDF</h3>
                        <p className="format-description">Múltiples páginas</p>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Información de PDF en progreso */}
                {mode === 'scan' && scanFormat === 'pdf' && pdfPages.length > 0 && (
                  <div className="copies-pdf-info">
                    <div className="pdf-info-header">
                      <span className="pdf-info-icon">📕</span>
                      <span className="pdf-info-text">PDF en progreso: {pdfPages.length} página(s)</span>
                    </div>
                    <div className="pdf-info-actions">
                      <Button
                        onClick={handleFinalizePdf}
                        variant="primary"
                        className="pdf-finalize-btn"
                      >
                        ✅ Finalizar PDF
                      </Button>
                      <Button
                        onClick={handleClearPdfPages}
                        variant="secondary"
                        className="pdf-clear-btn"
                      >
                        🗑️ Limpiar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botón de acción */}
                <div className="copies-form-actions">
                  {mode === 'print' ? (
                    <Button
                      onClick={() => handlePrint()}
                      variant="primary"
                      className="copies-action-button"
                      disabled={isPrinting || !fileInputRef.current?.files?.[0] || (!printerName.trim() && !localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER))}
                    >
                      {isPrinting ? (
                        <>
                          <span className="spinner"></span>
                          Imprimiendo...
                        </>
                      ) : (
                        <>
                          🖨️ Imprimir y Agregar
                        </>
                      )}
                    </Button>
                  ) : mode === 'photocopy' ? (
                    <Button
                      onClick={handlePhotocopy}
                      variant="primary"
                      className="copies-action-button"
                      disabled={isPhotocopying || (!printerName.trim() && !localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER))}
                    >
                      {isPhotocopying ? (
                        <>
                          <span className="spinner"></span>
                          {photocopySide === 'first' ? 'Escaneando frente...' : 
                           photocopySide === 'second' ? 'Escaneando reverso...' : 
                           'Fotocopiando...'}
                        </>
                      ) : (
                        <>
                          {doubleSided && photocopySide === null ? '📷 Escanear Frente' :
                           doubleSided && photocopySide === 'first' ? '📷 Escanear Reverso' :
                           '📷 Fotocopiar'}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleScan}
                      variant="primary"
                      className="copies-action-button"
                      disabled={isScanning}
                    >
                      {isScanning ? (
                        <>
                          <span className="spinner"></span>
                          Escaneando...
                        </>
                      ) : scanFormat === 'pdf' ? (
                        <>
                          📥 Agregar Página al PDF
                        </>
                      ) : (
                        <>
                          📥 Escanear Documento
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

        </div>


        {/* Modal de Configuración */}
        {showConfigModal && (
          <div className="copies-modal-overlay" onClick={() => setShowConfigModal(false)}>
            <div className="copies-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="copies-modal-header">
                <h2>⚙️ Configuración de Impresoras</h2>
                <button className="copies-modal-close" onClick={() => setShowConfigModal(false)}>
                  ✕
                </button>
              </div>

              <div className="copies-modal-content">
                {/* Formulario para agregar/editar */}
                <div className="copies-printer-form">
                  <h3>{editingPrinter ? 'Editar Impresora' : 'Agregar Nueva Impresora'}</h3>
                  <div className="copies-printer-input-group">
                    <input
                      type="text"
                      value={newPrinterName}
                      onChange={(e) => setNewPrinterName(e.target.value)}
                      placeholder="Nombre de la impresora (ej: EPSON L3110)"
                      className="copies-printer-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          if (editingPrinter) {
                            handleUpdatePrinter();
                          } else {
                            handleAddPrinter();
                          }
                        }
                      }}
                    />
                    {editingPrinter ? (
                      <>
                        <Button
                          onClick={handleUpdatePrinter}
                          variant="primary"
                          className="copies-printer-action-btn"
                        >
                          💾 Guardar
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingPrinter(null);
                            setNewPrinterName('');
                          }}
                          variant="secondary"
                          className="copies-printer-action-btn"
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleAddPrinter}
                        variant="primary"
                        className="copies-printer-action-btn"
                      >
                        ➕ Agregar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Lista de impresoras */}
                <div className="copies-printers-list">
                  <h3>Impresoras Registradas</h3>
                  {printers.length === 0 ? (
                    <div className="copies-no-printers">
                      <p>No hay impresoras registradas</p>
                      <p className="copies-hint">Agrega una impresora para comenzar</p>
                    </div>
                  ) : (
                    <div className="copies-printers-grid">
                      {printers.map((printer) => (
                        <div key={printer.id} className="copies-printer-item">
                          <div className="copies-printer-info">
                            <div className="copies-printer-name">
                              {printer.isDefault && <span className="copies-default-badge">⭐</span>}
                              {printer.name}
                            </div>
                            {printer.isDefault && (
                              <div className="copies-default-label">Predeterminada</div>
                            )}
                          </div>
                          <div className="copies-printer-actions">
                            <Button
                              onClick={() => handleSelectPrinter(printer)}
                              variant="secondary"
                              className="copies-printer-btn-small"
                            >
                              Usar
                            </Button>
                            {!printer.isDefault && (
                              <Button
                                onClick={() => handleSetDefault(printer)}
                                variant="secondary"
                                className="copies-printer-btn-small"
                              >
                                ⭐
                              </Button>
                            )}
                            <Button
                              onClick={() => handleEditPrinter(printer)}
                              variant="secondary"
                              className="copies-printer-btn-small"
                            >
                              ✏️
                            </Button>
                            <Button
                              onClick={() => handleDeletePrinter(printer)}
                              variant="secondary"
                              className="copies-printer-btn-small"
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopiesPage;
