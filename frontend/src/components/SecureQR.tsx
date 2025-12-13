/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';
import {
  Smartphone,
  RefreshCw,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';

interface SecureQRProps {
  ticket: Ticket;
  deviceId: string;
}

export const SecureQR: React.FC<SecureQRProps> = ({ ticket, deviceId }) => {
  const [token, setToken] = useState<string>('------');
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isBound, setIsBound] = useState<boolean>(false);
  const [showBlur, setShowBlur] = useState(false);

  useEffect(() => {
    setIsBound(ticket.boundDeviceId === deviceId);

    if (ticket.boundDeviceId !== deviceId) return;

    // Simple frontend timer (backend validates token)
    const interval = setInterval(() => {
      setTimeLeft(t => (t > 1 ? t - 1 : 15));
      setToken(Math.floor(100000 + Math.random() * 900000).toString());
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.hidden) setShowBlur(true);
      else setTimeout(() => setShowBlur(false), 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ticket, deviceId]);

  // ❌ Device mismatch
  if (!isBound) {
    return (
      <div className="w-full aspect-square bg-dark-900/50 rounded-2xl border border-neon-red/30 flex flex-col items-center justify-center p-8 text-center">
        <Smartphone className="text-neon-red mb-4" size={48} />
        <h3 className="text-xl font-bold text-neon-red mb-2">
          Device Mismatch
        </h3>
        <p className="text-gray-400 text-sm">
          This ticket is bound to another device.
        </p>
      </div>
    );
  }

  const qrData = `${ticket.id}::${token}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    qrData
  )}`;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {showBlur && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center rounded-3xl">
          <div className="text-center">
            <AlertTriangle className="text-yellow-500 mx-auto mb-4" size={48} />
            <p className="text-white font-bold">Secure View Active</p>
            <p className="text-sm text-gray-500">Recording blocked</p>
          </div>
        </div>
      )}

      <div className="bg-dark-900 p-6 rounded-3xl border border-white/10">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-neon-green">
            <ShieldCheck size={16} />
            <span className="text-xs font-bold uppercase">Valid Ticket</span>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {ticket.id.slice(-6)}
          </span>
        </div>

        {/* QR */}
        <div className="bg-white rounded-xl p-3 mb-4">
          <img
            src={qrUrl}
            alt="Secure QR"
            className="w-full h-full object-contain"
            style={{ opacity: timeLeft < 3 ? 0.4 : 1 }}
          />
        </div>

        {/* Timer */}
        <div className="flex justify-between text-xs mb-2 font-mono">
          <span className="text-gray-400">REFRESH</span>
          <span className="text-neon-green">{timeLeft}s</span>
        </div>

        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-neon-green transition-all duration-1000"
            style={{ width: `${(timeLeft / 15) * 100}%` }}
          />
        </div>

        {/* Token */}
        <div className="text-center">
          <span className="font-mono text-2xl tracking-widest text-white">
            {token}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
        <RefreshCw
          className={`w-3 h-3 ${timeLeft < 5 ? 'animate-spin' : ''}`}
        />
        <span>Syncing with server</span>
      </div>
    </div>
  );
};
