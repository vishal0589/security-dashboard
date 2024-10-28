// Alert.js
import React from 'react';

function Alert({ variant = 'info', children }) {
  const variantClasses = {
    info: 'bg-blue-50 text-blue-800',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-yellow-50 text-yellow-800',
    destructive: 'bg-red-50 text-red-800',
  };

  return (
    <div className={`p-4 rounded ${variantClasses[variant] || variantClasses.info}`}>
      {children}
    </div>
  );
}

export default Alert;
