"use client";

import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Verificar status online/offline
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm border">
      {/* Status Online/Offline */}
      <div className="flex items-center gap-1">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}