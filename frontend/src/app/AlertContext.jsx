import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState({ visible: false, type: '', message: '' });
  const [isExiting, setIsExiting] = useState(false);

  const showAlert = (type, message) => {
    setAlert({ visible: true, type, message });
    setIsExiting(false);

    if (type === 'success') {
      setTimeout(() => {
        handleDismiss();
      }, 3000); 
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setAlert({ visible: false, type: '', message: '' });
      setIsExiting(false);
    }, 300); 
  };

  return (
    <AlertContext.Provider value={showAlert}>
      {children}
      {alert.visible && (
        <div 
          className={`alert-toast ${alert.type} ${isExiting ? 'exit' : 'enter'}`}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            backgroundColor: alert.type === 'error' ? '#FF6B6B' : '#4A6E52',
            color: 'white',
            minWidth: '300px',
            gap: '12px',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {alert.type === 'error' ? (
            <AlertCircle size={22} />
          ) : (
            <Check size={22} />
          )}
          <span style={{ flex: 1, fontWeight: '500' }}>{alert.message}</span>
          <button 
            onClick={handleDismiss}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              opacity: 0.8
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translate(-50%, -100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translate(-50%, 0); opacity: 1; }
          to { transform: translate(-50%, -100px); opacity: 0; }
        }
        .alert-toast.enter { animation: slideIn 0.3s forwards; }
        .alert-toast.exit { animation: slideOut 0.3s forwards; }
      `}</style>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
