import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';
import { OTPService } from '../services/otpService';
import { Smartphone, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SecureQRProps {
  ticket: Ticket;
  deviceId: string;
}

export const SecureQR: React.FC<SecureQRProps> = ({ ticket, deviceId }) => {
  const [token, setToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isBound, setIsBound] = useState<boolean>(false);
  const [showBlur, setShowBlur] = useState(false);

  useEffect(() => {
    setIsBound(ticket.boundDeviceId === deviceId);
    if (ticket.boundDeviceId === deviceId) {
      updateToken();
    }
    const interval = setInterval(() => {
      if (ticket.boundDeviceId === deviceId) {
        setTimeLeft(OTPService.getRemainingSeconds(15));
        updateToken();
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, deviceId]);

  const updateToken = () => {
    const newToken = OTPService.generateTOTP(ticket.seedSecret, 15);
    setToken(newToken);
  };

  const qrData = `${ticket.id}::${token}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000`;

  if (!isBound) {
    return (
      <div className="w-full aspect-square bg-dark-900/50 backdrop-blur-md rounded-2xl border border-neon-red/30 flex flex-col items-center justify-center p-8 text-center animate-pulse">
        <Smartphone className="text-neon-red mb-4 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" size={48} />
        <h3 className="text-xl font-bold text-neon-red mb-2 tracking-tight">Device Mismatch</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          This ticket is bound to another hardware ID. Access denied.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto perspective-1000">
        {showBlur && (
             <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center rounded-3xl border border-yellow-500/20">
                <div className="text-center p-6">
                    <AlertTriangle className="text-yellow-500 mx-auto mb-4 animate-bounce" size={48} />
                    <p className="text-white font-bold text-lg mb-1">Secure View Active</p>
                    <p className="text-sm text-gray-500">Screen recording prohibited</p>
                </div>
            </div>
        )}

      {/* Holographic Container */}
      <div className="relative p-[1px] rounded-3xl overflow-hidden bg-gradient-to-b from-white/20 to-transparent shadow-[0_0_40px_-10px_rgba(0,255,157,0.3)]">
        <div className="bg-dark-900/90 backdrop-blur-xl p-6 rounded-[23px] relative">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-neon-green">
                    <ShieldCheck size={18} />
                    <span className="text-xs font-bold tracking-widest uppercase">Valid Ticket</span>
                </div>
                <div className="text-xs font-mono text-gray-500">{ticket.id.split('-')[1]}</div>
            </div>

            {/* QR Wrapper */}
            <div className="relative aspect-square bg-white rounded-xl overflow-hidden shadow-inner p-3">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
                <img 
                    src={qrUrl} 
                    alt="Secure Ticket QR" 
                    className="w-full h-full object-contain mix-blend-multiply relative z-10"
                    style={{ opacity: timeLeft < 3 ? 0.3 : 1, transition: 'opacity 0.3s' }}
                />
                
                {/* Scanning Laser Animation */}
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-xl">
                     <div className="w-full h-[2px] bg-neon-green shadow-[0_0_15px_rgba(0,255,157,0.8)] animate-scan-line opacity-50"></div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
                <div className="flex justify-between text-xs mb-2 font-mono">
                    <span className="text-gray-400">TOTP REFRESH</span>
                    <span className="text-neon-green">{timeLeft}s</span>
                </div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-neon-green shadow-[0_0_10px_rgba(0,255,157,0.5)] transition-all duration-1000 ease-linear"
                        style={{ width: `${(timeLeft / 15) * 100}%` }}
                    />
                </div>
            </div>

            {/* Token Display */}
            <div className="mt-6 text-center">
                <div className="inline-block bg-dark-800/50 border border-white/5 rounded-lg px-6 py-2 backdrop-blur-sm">
                    <span className="text-2xl font-mono font-bold text-white tracking-[0.2em] drop-shadow-md">
                        {token.substring(0,3)} <span className="text-gray-600">·</span> {token.substring(3)}
                    </span>
                </div>
            </div>

        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
        <RefreshCw className={`w-3 h-3 ${timeLeft < 5 ? 'animate-spin' : ''}`} />
        <span>Syncing with secure server time</span>
      </div>
    </div>
  );
};