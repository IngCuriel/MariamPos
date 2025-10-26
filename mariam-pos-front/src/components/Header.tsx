import React from 'react';
import Button from './Button';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  backText?: string;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  backText = '← Volver',
  className = '',
}) => {
  return (
    <div className={`header ${className}`}>
      <h1 className="header-title">{title}</h1>
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
  );
};

export default Header;
