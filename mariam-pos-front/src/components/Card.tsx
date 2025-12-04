import React from 'react';

interface CardProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  variant?: 'default' | 'feature' | 'product';
  hoverable?: boolean;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
  children,
  onClick,
  className = '',
  variant = 'default',
  hoverable = false,
  style,
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
    <div className={classes} onClick={onClick} style={style}>
      {children}
    </div>
  );
};

export default Card;
