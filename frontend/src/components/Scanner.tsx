import React, { useState } from 'react';
import { ScanResult } from '../types';
import { scanTicket } from '../services/api';
import { CheckCircle, XCircle, Zap, Shield, Search } from 'lucide-react';

interface ScannerProps {
  onScanComplete: (result: ScanResult) => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScanComplete }) => {
  const [manualInput, setManualInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const handleSimulatedScan = async () => {
    if (!manualInput.includes('::')) {
        onScanComplete({
            valid: false,
            message: "Invalid QR Format",
            timestamp: new Date().toISOString()
        });
        return;
    }

    setProcessing(true);
    setAiAnalysis(null);

    const [ticketId, token] = manualInput.split('::');
    
    try {
        const result = await scanTicket(ticketId, token);
        
        if (result.valid && (result as any).riskAnalysis) {
             setAiAnalysis((result as any).riskAnalysis);
        }

        onScanComplete(result);
    } catch (e) {
        onScanComplete({
            valid: false,
            message: "Server Verification Failed",
            timestamp: new Date().toISOString()
        });
    } finally {
        setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 relative">
      {/* Viewfinder Container */}
      <div className="flex-1 relative rounded-3xl overflow-hidden bg-black flex flex-col items-center justify-center shadow-2xl border border-dark-700">
        
        {/* Background Grid inside camera view */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        
        {/* Scanning Laser */}
        <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-transparent to-neon-blue/20 animate-scan-line border-b border-neon-blue/50"></div>

        {/* Viewfinder Corners */}
        <div className="absolute inset-8 pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-neon-blue rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-neon-blue rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-neon-blue rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-neon-blue rounded-br-lg"></div>
        </div>

        <div className="z-10 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-3">
            <Search className="text-neon-blue animate-pulse" size={20} />
            <span className="text-white font-mono text-sm tracking-widest uppercase">Searching...</span>
        </div>
        
        {/* Manual Input Overlay */}
        <div className="absolute bottom-8 left-6 right-6 z-20">
             <div className="bg-dark-900/90 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg">
                <label className="text-[10px] text-gray-400 font-mono mb-2 block uppercase tracking-wider">Manual Override</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="TICK-ID::TOKEN"
                        className="flex-1 bg-black border border-dark-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-neon-blue outline-none transition-colors placeholder:text-gray-700"
                    />
                    <button 
                        onClick={handleSimulatedScan}
                        disabled={processing}
                        className="bg-neon-blue text-black font-bold px-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                    >
                        {processing ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'GO'}
                    </button>
                </div>
             </div>
        </div>
      </div>

      {/* AI Analysis Result */}
      {aiAnalysis && (
          <div className="mt-4 p-4 bg-indigo-950/50 border border-indigo-500/30 rounded-xl backdrop-blur-md animate-in slide-in-from-bottom-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-indigo-400 fill-indigo-400" />
                <p className="text-xs text-indigo-300 font-mono font-bold tracking-wider uppercase">AI Security Insight</p>
              </div>
              <p className="text-sm text-indigo-100 leading-relaxed">{aiAnalysis}</p>
          </div>
      )}
    </div>
  );
};

export const ScanResultDisplay: React.FC<{ result: ScanResult; onReset: () => void }> = ({ result, onReset }) => {
    return (
        <div className={`flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-300 ${result.valid ? 'bg-gradient-radial from-green-900/20 to-transparent' : 'bg-gradient-radial from-red-900/20 to-transparent'}`}>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 relative ${result.valid ? 'text-neon-green' : 'text-neon-red'}`}>
                <div className={`absolute inset-0 rounded-full opacity-20 animate-ping ${result.valid ? 'bg-neon-green' : 'bg-neon-red'}`}></div>
                <div className={`relative z-10 w-full h-full rounded-full border-2 flex items-center justify-center bg-black/50 backdrop-blur-sm ${result.valid ? 'border-neon-green bg-green-500/10' : 'border-neon-red bg-red-500/10'}`}>
                    {result.valid ? <CheckCircle size={64} /> : <XCircle size={64} />}
                </div>
            </div>
            
            <h2 className={`text-4xl font-bold mb-2 tracking-tight ${result.valid ? 'text-white' : 'text-neon-red'}`}>
                {result.valid ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
            </h2>
            <p className="text-gray-400 mb-8 font-mono text-sm tracking-wide">{result.message}</p>

            {result.ticket && (
                <div className="bg-dark-800/80 backdrop-blur-md p-6 rounded-2xl w-full max-w-sm border border-white/5 text-left mb-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                        <div className="w-14 h-14 bg-gray-700 rounded-full overflow-hidden border-2 border-white/10">
                             <img src={`https://picsum.photos/seed/${result.ticket.userId}/200`} alt="User" className="w-full h-full object-cover"/>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-mono uppercase">Ticket Holder</p>
                            <p className="font-bold text-white text-lg">John Doe</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                            <span className="text-gray-500 text-xs font-mono uppercase">Event</span>
                            <span className="text-white text-sm font-bold">{result.ticket.eventName}</span>
                        </div>
                         <div className="flex justify-between items-center p-2">
                            <span className="text-gray-500 text-xs font-mono uppercase">Status</span>
                            <div className="flex items-center gap-1 text-neon-blue text-sm font-bold">
                                <Shield size={12} />
                                <span>Verified</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <button 
                onClick={onReset}
                className="w-full max-w-sm bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
                Scan Next Ticket
            </button>
        </div>
    );
}