import React, { useState, useRef } from 'react';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { printCopies, photocopy } from '../../api/copies';
import Swal from 'sweetalert2';
import '../../styles/pages/copies/copiesPage.css';

interface CopiesPageProps {
  onBack: () => void;
}

const CopiesPage: React.FC<CopiesPageProps> = ({ onBack }) => {
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('bw');
  const [printerName, setPrinterName] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPhotocopying, setIsPhotocopying] = useState(false);
  const [mode, setMode] = useState<'print' | 'photocopy'>('print');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopiesChange = (value: number) => {
    if (value < 1) value = 1;
    if (value > 100) value = 100;
    setCopies(value);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      Swal.fire({
        icon: 'error',
        title: 'Tipo de archivo no válido',
        text: 'Por favor, selecciona un archivo PDF o imagen (JPG, PNG)',
      });
      return;
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Archivo muy grande',
        text: 'El archivo no debe exceder 10MB',
      });
      return;
    }

    await handlePrint(file);
  };

  const handlePhotocopy = async () => {
    if (!printerName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Impresora no especificada',
        text: 'Por favor, ingresa el nombre de la impresora',
      });
      return;
    }

    setIsPhotocopying(true);

    try {
      await photocopy({
        copies,
        colorMode,
        printerName: printerName.trim(),
      });

      Swal.fire({
        icon: 'success',
        title: '¡Fotocopia completada!',
        text: `Se fotocopiaron ${copies} copia(s) en modo ${colorMode === 'color' ? 'color' : 'blanco y negro'}`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Error al fotocopiar:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al fotocopiar',
        text: error.response?.data?.message || error.response?.data?.error || error.message || 'No se pudo completar la fotocopia. Asegúrate de que haya un documento en la cama del escáner.',
      });
    } finally {
      setIsPhotocopying(false);
    }
  };

  const handlePrint = async (file?: File) => {
    if (!printerName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Impresora no especificada',
        text: 'Por favor, ingresa el nombre de la impresora',
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

    setIsPrinting(true);

    try {
      const formData = new FormData();
      formData.append('file', fileToPrint);
      formData.append('copies', copies.toString());
      formData.append('colorMode', colorMode);
      formData.append('printerName', printerName.trim());

      await printCopies(formData);

      Swal.fire({
        icon: 'success',
        title: '¡Copias enviadas!',
        text: `Se enviaron ${copies} copia(s) en modo ${colorMode === 'color' ? 'color' : 'blanco y negro'} a la impresora ${printerName}`,
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

  return (
    <div className="copies-page">
      <div className="copies-page-container">
        <Header
          title="🖨️ Módulo de Copias"
          onBack={onBack}
          backText="← Volver"
          className="copies-page-header"
        />

        <div className="copies-page-content">
          <Card className="copies-config-card">
            <div className="copies-config-header">
              <h2 className="copies-config-title">Configuración de Copias</h2>
              <p className="copies-config-description">
                Selecciona el modo: imprimir archivo o fotocopiar desde la cama del escáner
              </p>
            </div>

            {/* Selector de modo */}
            <div className="copies-mode-selector">
              <Card
                className={`copies-mode-option ${mode === 'print' ? 'active' : ''}`}
                onClick={() => setMode('print')}
                hoverable
              >
                <div className="mode-icon">📄</div>
                <h3 className="mode-title">Imprimir Archivo</h3>
                <p className="mode-description">Selecciona un archivo para imprimir</p>
              </Card>
              <Card
                className={`copies-mode-option ${mode === 'photocopy' ? 'active' : ''}`}
                onClick={() => setMode('photocopy')}
                hoverable
              >
                <div className="mode-icon">📷</div>
                <h3 className="mode-title">Fotocopiar</h3>
                <p className="mode-description">Escanear e imprimir desde la cama del escáner</p>
              </Card>
            </div>

            <div className="copies-form">
              {/* Selector de archivo (solo para modo print) */}
              {mode === 'print' && (
              <div className="copies-form-group">
                <label className="copies-form-label">
                  <span className="label-icon">📄</span>
                  Archivo a imprimir
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="copies-file-input"
                  id="file-input"
                />
                <Button
                  onClick={handleFileSelect}
                  variant="secondary"
                  className="copies-file-button"
                >
                  📁 Seleccionar archivo (PDF, JPG, PNG)
                </Button>
                {fileInputRef.current?.files?.[0] && (
                  <div className="copies-file-info">
                    <span className="file-name">
                      📎 {fileInputRef.current.files[0].name}
                    </span>
                    <span className="file-size">
                      ({(fileInputRef.current.files[0].size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                )}
              </div>
              )}

              {/* Nombre de impresora */}
              <div className="copies-form-group">
                <label className="copies-form-label">
                  <span className="label-icon">🖨️</span>
                  Nombre de la impresora
                </label>
                <input
                  type="text"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  placeholder="Ej: EPSON L3110, EPSON XP-4100, etc."
                  className="copies-text-input"
                />
                <p className="copies-help-text">
                  💡 Ingresa el nombre exacto de tu impresora Epson (puedes verlo en Configuración → Impresoras)
                </p>
              </div>

              {/* Cantidad de copias */}
              <div className="copies-form-group">
                <label className="copies-form-label">
                  <span className="label-icon">🔢</span>
                  Cantidad de copias
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
                <p className="copies-help-text">
                  Mínimo: 1 copia | Máximo: 100 copias
                </p>
              </div>

              {/* Modo de color */}
              <div className="copies-form-group">
                <label className="copies-form-label">
                  <span className="label-icon">🎨</span>
                  Modo de impresión
                </label>
                <div className="copies-color-options">
                  <Card
                    className={`copies-color-option ${colorMode === 'bw' ? 'active' : ''}`}
                    onClick={() => setColorMode('bw')}
                    hoverable
                  >
                    <div className="color-option-icon">⚫</div>
                    <h3 className="color-option-title">Blanco y Negro</h3>
                    <p className="color-option-description">Más económico, ideal para documentos</p>
                  </Card>
                  <Card
                    className={`copies-color-option ${colorMode === 'color' ? 'active' : ''}`}
                    onClick={() => setColorMode('color')}
                    hoverable
                  >
                    <div className="color-option-icon">🌈</div>
                    <h3 className="color-option-title">Color</h3>
                    <p className="color-option-description">Para imágenes y documentos con color</p>
                  </Card>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="copies-form-actions">
                {mode === 'print' ? (
                  <Button
                    onClick={() => handlePrint()}
                    variant="primary"
                    className="copies-print-button"
                    disabled={isPrinting || !fileInputRef.current?.files?.[0] || !printerName.trim()}
                  >
                    {isPrinting ? (
                      <>
                        <span className="spinner"></span>
                        Imprimiendo...
                      </>
                    ) : (
                      <>
                        🖨️ Imprimir {copies} copia{copies > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handlePhotocopy}
                    variant="primary"
                    className="copies-print-button"
                    disabled={isPhotocopying || !printerName.trim()}
                  >
                    {isPhotocopying ? (
                      <>
                        <span className="spinner"></span>
                        Fotocopiando...
                      </>
                    ) : (
                      <>
                        📷 Fotocopiar {copies} copia{copies > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Información adicional */}
          <Card className="copies-info-card">
            <h3 className="copies-info-title">ℹ️ Información</h3>
            <ul className="copies-info-list">
              {mode === 'print' ? (
                <>
                  <li>✅ Formatos soportados: PDF, JPG, PNG</li>
                  <li>✅ Tamaño máximo: 10MB por archivo</li>
                  <li>✅ La impresora debe estar encendida y conectada</li>
                  <li>✅ Asegúrate de tener papel y tinta suficiente</li>
                  <li>✅ El nombre de la impresora debe coincidir exactamente con el del sistema</li>
                </>
              ) : (
                <>
                  <li>📷 Coloca el documento boca abajo en la cama del escáner</li>
                  <li>📷 Asegúrate de que el documento esté bien alineado</li>
                  <li>📷 La impresora debe tener función de escáner integrada</li>
                  <li>📷 Asegúrate de tener papel y tinta suficiente</li>
                  <li>📷 El proceso puede tardar unos segundos (escanear + imprimir)</li>
                  <li>📷 En Windows, se requiere Epson Scan instalado o WIA configurado</li>
                </>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CopiesPage;

