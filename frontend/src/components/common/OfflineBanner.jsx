import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 4000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      style={{
        width: '100%',
        padding: '10px 16px',
        background: isOffline ? '#ef4444' : '#10b981',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontSize: '0.88rem',
        fontWeight: '700',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 9999,
        transition: 'all 0.3s ease'
      }}
    >
      {isOffline ? (
        <>
          <WifiOff size={20} />
          <span>Você está sem internet no momento. As mensagens do WhatsApp serão enviadas assim que a conexão voltar.</span>
        </>
      ) : (
        <>
          <Wifi size={20} />
          <span>Sua conexão com a internet foi restaurada com sucesso!</span>
        </>
      )}
    </div>
  );
}
