import React from 'react';
import Button from './Button';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  backText?: string;
  className?: string;
  actions?: React.ReactNode; // Acciones adicionales (botones, iconos, etc.)
}

const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  backText = '← Volver',
  className = '',
  actions,
}) => {
  return (
    <div className={`header ${className}`}>
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        {actions}
        {onBack && (
          <Button
            onClick={onBack}
            variant="primary"
            className="back-button"
          >
            {backText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Header;
