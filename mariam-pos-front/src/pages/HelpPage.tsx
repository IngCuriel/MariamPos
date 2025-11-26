import React from 'react';
import Header from '../components/Header';
import '../styles/pages/help/helpPage.css';

interface HelpPageProps {
  onBack: () => void;
}

const HelpPage: React.FC<HelpPageProps> = ({ onBack }) => {
  return (
    <div className="help-page">
      <div className="help-container">
        <Header
          title="❓ Centro de Ayuda"
          onBack={onBack}
          backText="← Volver al Módulo POS"
          className="help-header"
        />

        <div className="help-content"> 
          {/* 🖨️ Bloque de servicios de impresiones */}
          <div className="help-section">
            <h3>🖨️ Servicios de Impresiones</h3>
            <ul>
              <li>
                <strong>Descargar CURP:</strong>{' '}
                <a
                  href="https://www.gob.mx/curp/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir al portal oficial
                </a>
              </li>
              <li>
                <strong>Descargar Recibo de Luz (CFE):</strong>{' '}
                <a
                  href="https://app.cfe.mx/Aplicaciones/CCFE/SolicitudesCFE/Solicitudes/ConsultaTuReciboLuzGmx"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir al portal oficial
                </a>
                {' '}|{' '}
                <a 
                  href="https://drive.google.com/file/d/14z9ShjFCFlAVsWnTZgBWSuaSl6l_iAIx/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver tutorial
                </a>
              </li>
              <li>
                <strong>Descargar Acta de Nacimiento:</strong>{' '}
                Proporciona los siguientes datos y envíalos al número de WhatsApp 8112370478:
                <ul>
                  <li>Nombre Completo</li>
                  <li>Fecha de nacimiento</li>
                  <li>Nombre completo de los padres</li>
                </ul>
              </li>
            </ul>
          </div>

          {/* 📱 Bloque de servicios Bait */}
          <div className="help-section">
            <h3>📱 Servicios Bait</h3>
            <ul>
              <li>
                <strong>Compatibilidad Bait:</strong>{' '}
                <a
                  href="https://mibait.com/compatibilidad"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir al sitio oficial
                </a> 
              </li>
              <li>
                <strong>Portabilidad de número:</strong>{' '}
                <a
                  href="https://mibait.com/haz-tu-portabilidad"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir al sitio oficial
                </a>
              </li>
              <li>
                <strong>Cambiar código de área (Lada):</strong>{' '}
                <a
                  href="https://mibait.com/cambio-nir?section=cambio-nir"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir al sitio oficial
                </a>
              </li>
            </ul>
          </div>

          {/* 📞 Bloque de soporte */}
          <div className="help-section contact-section">
            <h3>📞 Contacto de Soporte</h3>
            <p>Para asistencia técnica, contacta al administrador del sistema:</p>
            <ul>
              <li>
                📱 <strong>Teléfono:</strong>{' '}
                <a href="tel:8112370478">
                  8112370478
                </a>
              </li>
              <li>
                📧 <strong>Correo:</strong>{' '}
                <a href="mailto:eleazar.isc@gmail.com">
                  eleazar.isc@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;