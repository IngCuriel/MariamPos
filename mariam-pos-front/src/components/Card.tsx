import React from 'react';

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'feature' | 'product';
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  onClick,
  className = '',
  variant = 'default',
  hoverable = false,
}) => {
  const baseClasses = 'card';
  const variantClasses = {
    default: 'card-default',
    feature: 'card-feature',
    product: 'card-product',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    hoverable ? 'card-hoverable' : '',
    onClick ? 'card-clickable' : '',
    className,
  ].join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
