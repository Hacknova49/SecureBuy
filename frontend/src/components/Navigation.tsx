import React from 'react';
import { ViewMode, UserRole } from '../../../types';
import { Ticket, ScanLine, ShieldAlert, ShoppingBag, PlusCircle } from 'lucide-react';

interface NavigationProps {
  currentMode: ViewMode;
  setMode: (mode: ViewMode) => void;
  userRole: UserRole;
}

export const Navigation: React.FC<NavigationProps> = ({ currentMode, setMode, userRole }) => {
  const NavButton = ({ mode, icon: Icon, label, colorClass }: { mode: ViewMode; icon: any; label: string; colorClass: string }) => {
      const isActive = currentMode === mode;
      return (
        <button
            onClick={() => setMode(mode)}
            className={`relative flex flex-col items-center gap-1 p-2 transition-all duration-300 ${isActive ? colorClass : 'text-gray-500 hover:text-gray-300'}`}
        >
            <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full bg-current opacity-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : ''}`} />
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
            {isActive && <div className={`absolute inset-0 bg-current opacity-10 blur-xl rounded-full`} />}
        </button>
      );
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-xl border-t border-white/10 pb-safe z-50 shadow-2xl">
      <div className="flex justify-around items-center px-4 py-3 max-w-lg mx-auto">
        
        {/* USER NAVIGATION */}
        {userRole === 'USER' && (
            <>
                <NavButton mode="MARKET" icon={ShoppingBag} label="Events" colorClass="text-white" />
                <NavButton mode="USER" icon={Ticket} label="My Tickets" colorClass="text-neon-green" />
            </>
        )}

        {/* MANAGER NAVIGATION */}
        {userRole === 'MANAGER' && (
            <>
                <NavButton mode="ADMIN" icon={ShieldAlert} label="Dash" colorClass="text-neon-purple" />
                <NavButton mode="CREATE_EVENT" icon={PlusCircle} label="Post" colorClass="text-neon-green" />
                <NavButton mode="SCANNER" icon={ScanLine} label="Scan" colorClass="text-neon-blue" />
            </>
        )}
      </div>
    </nav>
  );
};