import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewMode, Ticket, ScanResult, User, UserRole, Event } from './types';
// Updated Imports from api.ts
import { getTicketsForUser, getMyDeviceId, getCurrentUser, registerOrLogin, logout, getEvents, purchaseTicket, createEvent, recoverAccount, generateHype, chatConcierge } from './services/api';
import { SecureQR } from './components/SecureQR';
import { Scanner, ScanResultDisplay } from './components/Scanner';
import { Ticket as TicketIcon, Calendar, MapPin, ShieldCheck, LogOut, Lock, Fingerprint, ShoppingBag, AlertCircle, UserCircle, Briefcase, Plus, Users, ArrowRight, DollarSign, Key, Check, Sparkles, Bot, Tag, ShoppingCart, Trash2, X, Map, Send } from 'lucide-react';

// Chat Message Interface
interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    eventId?: string;
    grounding?: any[];
    timestamp: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<ViewMode>('MARKET');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [recommendedEventId, setRecommendedEventId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  // Recovery State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newRegistrationCode, setNewRegistrationCode] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<{ [eventId: string]: number }>({});
  const [showCart, setShowCart] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // Create Event State
  const [newEvent, setNewEvent] = useState({ name: '', venue: '', price: '', total: '', description: '', tags: '' });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [isGeneratingHype, setIsGeneratingHype] = useState(false);
  const [verifyingLocation, setVerifyingLocation] = useState(false);

  // UI State
  const [visibleMapId, setVisibleMapId] = useState<string | null>(null);

  // AI Concierge State
  const [showConcierge, setShowConcierge] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initApp = async () => {
      setDeviceId(getMyDeviceId());
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        await initUserData(currentUser);
      }
      setIsAppLoading(false);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (showConcierge && chatEndRef.current) {
      (chatEndRef.current as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showConcierge]);

  const initUserData = async (u: User) => {
    try {
      const [evts, tix] = await Promise.all([getEvents(), u.role === 'USER' ? getTicketsForUser(u.id) : Promise.resolve([])]);
      setAllEvents(evts);
      setTickets(tix);
      setMode(u.role === 'USER' ? 'MARKET' : 'ADMIN');
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to load app data.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isRecoveryMode) {
          const recoveredUser = await recoverAccount(email, recoveryCode);
          setUser(recoveredUser);
          await initUserData(recoveredUser);
          setIsRecoveryMode(false);
      } else {
          const { user: u, isNew } = await registerOrLogin(email, name, role);
          setUser(u);
          await initUserData(u);
          if (isNew && u.role === 'USER' && u.recoveryCode) {
              setNewRegistrationCode(u.recoveryCode);
          }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setTickets([]);
  };

  // --- Cart Management ---

  const getCartTotalCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  
  const getCartTotalPrice = () => {
      return Object.entries(cart).reduce((total, [id, qty]) => {
          const evt = allEvents.find(e => e.id === id);
          return total + (evt ? evt.price * qty : 0);
      }, 0);
  };

  const addToCart = (eventId: string) => {
      if (!user) return;
      
      const currentQty = cart[eventId] || 0;
      const existingTickets = tickets.filter(t => t.eventId === eventId).length;
      
      if (currentQty + existingTickets >= 4) {
          setCartError("Limit of 4 tickets per event reached.");
          setTimeout(() => setCartError(null), 3000);
          return;
      }

      setCart(prev => ({ ...prev, [eventId]: currentQty + 1 }));
  };

  const removeFromCart = (eventId: string) => {
      setCart(prev => {
          const next = { ...prev };
          if (next[eventId] > 1) {
              next[eventId]--;
          } else {
              delete next[eventId];
          }
          return next;
      });
  };

  const clearCartItem = (eventId: string) => {
      setCart(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
      });
  };

  const handleCheckout = async () => {
      if (!user) return;
      setIsCheckingOut(true);
      setCartError(null);

      try {
          for (const [eventId, qty] of Object.entries(cart)) {
              for (let i = 0; i < qty; i++) {
                  await purchaseTicket(user, eventId);
              }
          }
          const tix = await getTicketsForUser(user.id);
          setTickets(tix);
          setCart({});
          setShowCart(false);
          setMode('USER');
      } catch (e: any) {
          setCartError(e.message || "Checkout failed partway through.");
      } finally {
          setIsCheckingOut(false);
          const evts = await getEvents();
          setAllEvents(evts);
      }
  };

  // --- Create Event & AI ---

  const handleVerifyLocation = async () => {
     // Simplified verification for demo, since actual GMaps tool is on backend chat now
     // We can just trust user input or add a backend endpoint for this specifically if needed
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setCreatingEvent(true);
      try {
        const tagArray = newEvent.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

        await createEvent(user.id, {
            name: newEvent.name,
            venue: newEvent.venue,
            description: newEvent.description,
            price: Number(newEvent.price),
            totalTickets: Number(newEvent.total),
            tags: tagArray,
            date: new Date().toISOString()
        });
        const evts = await getEvents();
        setAllEvents(evts);
        setNewEvent({ name: '', venue: '', price: '', total: '', description: '', tags: '' });
        setMode('ADMIN');
      } catch (err) {
          console.error(err);
      } finally {
          setCreatingEvent(false);
      }
  }

  const handleGenerateHype = async () => {
      if (!newEvent.name || !newEvent.venue) return;
      setIsGeneratingHype(true);
      try {
          const text = await generateHype(newEvent.name, newEvent.venue, Number(newEvent.price));
          setNewEvent(prev => ({ ...prev, description: text }));
      } catch (error) {
          console.error("AI Gen failed", error);
      } finally {
          setIsGeneratingHype(false);
      }
  };

  // --- AI Concierge Logic (Backend Proxy) ---

  const handleConciergeSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      
      const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      const eventsContext = allEvents.map(e => {
        const soldOut = e.soldTickets >= e.totalTickets;
        return `ID: ${e.id} | Name: ${e.name} | Venue: ${e.venue} | Tags: ${e.tags.join(', ')} | Price: ₹${e.price} | Status: ${soldOut ? 'SOLD OUT' : 'Available'}`;
      }).join('\n');

      try {
          const result = await chatConcierge(userMsg.text, eventsContext);
          const text = result.reply || "Connection error.";
          
          // Parse for Event ID
          const match = text.match(/\[ID:(.*?)\]/);
          const cleanText = text.replace(/\[ID:.*?\]/, '').trim();
          const recommendedId = match ? match[1] : undefined;
          
          if (recommendedId) {
            setRecommendedEventId(recommendedId);
          }

          const aiMsg: ChatMessage = {
              role: 'model',
              text: cleanText,
              eventId: recommendedId,
              grounding: result.grounding,
              timestamp: Date.now()
          };
          setChatMessages(prev => [...prev, aiMsg]);
      } catch (err) {
          console.error(err);
          setChatMessages(prev => [...prev, { role: 'model', text: "Connection interrupted. Retrying neural handshake...", timestamp: Date.now() }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const openConciergeModal = () => {
      setShowConcierge(true);
      if (chatMessages.length === 0) {
          setChatMessages([{
              role: 'model',
              text: "Systems online. I am Nexus. Looking for a specific vibe or location tonight?",
              timestamp: Date.now()
          }]);
      }
  };

  // --- Views ---

  const renderNewUserRecoveryModal = () => {
      if (!newRegistrationCode) return null;
      return (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
              <div className="bg-dark-800 border-2 border-neon-red/50 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(255,0,60,0.2)]">
                  <div className="flex justify-center mb-6">
                      <div className="bg-neon-red/20 p-4 rounded-full text-neon-red animate-pulse">
                          <Key size={48} />
                      </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white text-center mb-2">Save This Key!</h2>
                  <p className="text-gray-400 text-center text-sm mb-6">
                      Your account is now bound to this device. If you lose this device, this is the <strong>ONLY</strong> way to recover your tickets.
                  </p>
                  
                  <div className="bg-black border border-white/10 rounded-xl p-6 mb-6 text-center">
                      <p className="font-mono text-2xl font-bold text-neon-green tracking-widest select-all">
                          {newRegistrationCode}
                      </p>
                  </div>

                  <button 
                    onClick={() => setNewRegistrationCode(null)}
                    className="w-full bg-neon-green text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-colors"
                  >
                      <Check size={20} />
                      I Have Saved It
                  </button>
              </div>
          </div>
      );
  };

  const renderLogin = () => (
      <div className="fixed inset-0 bg-dark-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-neon-purple/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-neon-green/20 rounded-full blur-[100px]"></div>

        <div className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center p-6 relative z-10">
                <div className="w-full max-w-md">
                    <div className="flex flex-col items-center mb-10 mt-10">
                        <div className="w-20 h-20 bg-dark-800/50 backdrop-blur-md rounded-2xl flex items-center justify-center text-neon-green border border-white/10 shadow-[0_0_40px_-10px_rgba(0,255,157,0.3)] mb-6 animate-pulse-fast">
                            <Fingerprint size={40} />
                        </div>
                        <h1 className="text-4xl font-bold text-center mb-2 tracking-tight">SecureBuy</h1>
                        <p className="text-center text-gray-400 font-mono text-sm">SECURE IDENTITY PROTOCOL</p>
                    </div>

                    <div className="bg-dark-800/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl mb-10">
                        {!isRecoveryMode ? (
                            <div className="flex bg-black/40 rounded-xl p-1 mb-8 border border-white/5 relative">
                                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-dark-700 rounded-lg transition-all duration-300 ${role === 'USER' ? 'left-1' : 'left-[calc(50%+4px)]'}`}></div>
                                <button type="button" onClick={() => setRole('USER')} className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 relative z-10 transition-colors ${role === 'USER' ? 'text-white' : 'text-gray-500'}`}>
                                    <UserCircle size={16} /> Attendee
                                </button>
                                <button type="button" onClick={() => setRole('MANAGER')} className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 relative z-10 transition-colors ${role === 'MANAGER' ? 'text-neon-purple' : 'text-gray-500'}`}>
                                    <Briefcase size={16} /> Organizer
                                </button>
                            </div>
                        ) : (
                            <div className="mb-6 text-center">
                                <h2 className="text-xl font-bold text-neon-red flex items-center justify-center gap-2">
                                    <Key size={20} /> Account Recovery
                                </h2>
                                <p className="text-xs text-gray-400 mt-2">Enter your email and the recovery code you saved during registration.</p>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            {authError && (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-sm text-red-200 flex items-start gap-3">
                                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                    <span>{authError}</span>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="group">
                                    <label className="block text-[10px] font-mono text-gray-500 mb-1 ml-1 uppercase tracking-wider">Email Address</label>
                                    <input required type="email" className="w-full bg-dark-950/50 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-green/50 outline-none transition-all"
                                        placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                                
                                {!isRecoveryMode ? (
                                    <div className="group">
                                        <label className="block text-[10px] font-mono text-gray-500 mb-1 ml-1 uppercase tracking-wider">Full Legal Name</label>
                                        <input required type="text" className="w-full bg-dark-950/50 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-green/50 outline-none transition-all"
                                            placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                ) : (
                                    <div className="group">
                                        <label className="block text-[10px] font-mono text-neon-red mb-1 ml-1 uppercase tracking-wider">Recovery Code</label>
                                        <input required type="text" className="w-full bg-dark-950/50 border border-neon-red/50 rounded-xl p-4 text-white focus:ring-1 focus:ring-neon-red outline-none transition-all font-mono tracking-widest"
                                            placeholder="REC-XXXX-XXXX" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} />
                                    </div>
                                )}
                            </div>

                            <button disabled={isAuthLoading} className={`w-full font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex justify-center mt-6 
                                ${isRecoveryMode 
                                    ? 'bg-neon-red text-black shadow-red-900/20' 
                                    : role === 'MANAGER' 
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-900/20' 
                                        : 'bg-white text-black hover:bg-neon-green shadow-neon-green/20'}`}>
                                {isAuthLoading ? (
                                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"/> 
                                ) : (
                                    isRecoveryMode ? 'Recover & Bind Device' : role === 'MANAGER' ? 'Access Dashboard' : 'Secure Login'
                                )}
                            </button>

                            {!isRecoveryMode && role === 'USER' && (
                                <div className="space-y-4 mt-6">
                                     <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
                                        <Lock size={12} className="text-neon-green" />
                                        <span>Device Binding: <span className="font-mono text-gray-400">{deviceId.substring(0, 8)}...</span></span>
                                    </div>
                                    <div className="text-center">
                                        <button type="button" onClick={() => { setIsRecoveryMode(true); setAuthError(''); }} className="text-xs text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4">
                                            Lost your device? Recover Account
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {isRecoveryMode && (
                                <div className="text-center mt-4">
                                    <button type="button" onClick={() => { setIsRecoveryMode(false); setAuthError(''); }} className="text-xs text-gray-400 hover:text-white">
                                        Cancel Recovery
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
      </div>
  );

  const renderCartModal = () => {
    if (!showCart) return null;
    const cartItems = Object.entries(cart);
    const totalPrice = getCartTotalPrice();

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in slide-in-from-bottom">
            <div className="bg-dark-900 w-full sm:max-w-md h-[80vh] sm:h-auto rounded-t-3xl sm:rounded-2xl border border-white/10 flex flex-col shadow-2xl">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="text-neon-green" />
                        Checkout
                    </h2>
                    <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {cartItems.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            Your cart is empty.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cartItems.map(([id, qty]) => {
                                const evt = allEvents.find(e => e.id === id);
                                if (!evt) return null;
                                return (
                                    <div key={id} className="bg-white/5 p-4 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white text-sm">{evt.name}</h4>
                                            <p className="text-xs text-neon-green">₹{evt.price} x {qty}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => removeFromCart(id)} className="w-8 h-8 rounded-full bg-black flex items-center justify-center border border-white/10 hover:border-white/30 text-white">-</button>
                                            <span className="font-mono">{qty}</span>
                                            <button onClick={() => addToCart(id)} className="w-8 h-8 rounded-full bg-black flex items-center justify-center border border-white/10 hover:border-white/30 text-white">+</button>
                                            <button onClick={() => clearCartItem(id)} className="ml-2 text-red-400 hover:text-red-300">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-dark-800 rounded-b-2xl">
                    <div className="flex justify-between mb-4 text-lg font-bold">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white">₹{totalPrice.toLocaleString()}</span>
                    </div>
                    {cartError && (
                        <div className="mb-4 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-500/20">
                            {cartError}
                        </div>
                    )}
                    <button 
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0 || isCheckingOut}
                        className="w-full bg-neon-green text-black font-bold py-4 rounded-xl hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isCheckingOut ? (
                            <>
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                                Processing...
                            </>
                        ) : (
                            <>
                                Confirm Purchase <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderConciergeModal = () => {
      if (!showConcierge) return null;
      
      return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in">
              <div className="bg-dark-900 w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-3xl sm:rounded-2xl border border-neon-blue/30 flex flex-col shadow-[0_0_50px_rgba(0,243,255,0.15)] overflow-hidden">
                  
                  {/* Chat Header */}
                  <div className="p-4 bg-dark-800/80 backdrop-blur border-b border-white/10 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neon-blue/10 flex items-center justify-center border border-neon-blue/30 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                        <Bot className="text-neon-blue" size={20} />
                      </div>
                      <div className="flex-1">
                          <h3 className="font-bold text-white text-sm">Nexus AI</h3>
                          <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse"></span>
                              <p className="text-[10px] text-neon-blue font-mono tracking-wider">ONLINE</p>
                          </div>
                      </div>
                      <button onClick={() => setShowConcierge(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                          <X size={18} className="text-gray-400" />
                      </button>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-grid-pattern bg-[length:20px_20px] bg-opacity-5">
                      {chatMessages.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          const evt = msg.eventId ? allEvents.find(e => e.id === msg.eventId) : null;

                          return (
                              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] space-y-2`}>
                                      <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-white text-black rounded-tr-none' : 'bg-dark-800 border border-white/10 text-gray-200 rounded-tl-none'}`}>
                                          {msg.text}
                                      </div>
                                      
                                      {/* Maps Grounding Chips */}
                                      {msg.grounding && msg.grounding.length > 0 && (
                                          <div className="flex flex-wrap gap-2">
                                              {msg.grounding.map((chunk, i) => chunk.maps?.uri && (
                                                  <a key={i} href={chunk.maps.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-2 py-1 rounded hover:bg-neon-blue hover:text-black transition-colors">
                                                      <MapPin size={10} /> {chunk.maps.title || 'Location Map'}
                                                  </a>
                                              ))}
                                          </div>
                                      )}

                                      {/* Recommended Event Card */}
                                      {evt && (
                                          <div className="bg-dark-900 border border-neon-blue/50 rounded-xl overflow-hidden mt-2 max-w-[240px] shadow-lg animate-in zoom-in-95 duration-300">
                                              <div className="h-24 relative">
                                                  <img src={evt.image} className="w-full h-full object-cover" alt={evt.name} />
                                                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-neon-green border border-white/10">
                                                      ₹{evt.price}
                                                  </div>
                                              </div>
                                              <div className="p-3">
                                                  <h4 className="font-bold text-white text-xs mb-1 truncate">{evt.name}</h4>
                                                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-3">
                                                      <Calendar size={10} /> {new Date(evt.date).toLocaleDateString()}
                                                  </div>
                                                  <button 
                                                    onClick={() => { addToCart(evt.id); setShowCart(true); }}
                                                    className="w-full bg-neon-blue text-black text-xs font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-white transition-colors"
                                                  >
                                                      <Plus size={12} /> Add to Cart
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                      
                                      <div className={`text-[10px] text-gray-600 ${isUser ? 'text-right' : 'text-left'}`}>
                                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                      <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <form onSubmit={handleConciergeSend} className="p-3 bg-dark-800 border-t border-white/10 flex gap-2">
                      <input 
                        className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-blue outline-none transition-colors"
                        placeholder="Type a message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isChatLoading}
                      />
                      <button 
                        disabled={isChatLoading || !chatInput.trim()}
                        className="bg-neon-blue text-black p-3 rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isChatLoading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/> : <Send size={20} />}
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  const renderMarketplaceView = () => {
    return (
        <div className="h-full overflow-y-auto p-6 pb-32 scroll-smooth">
             <header className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">Events</h1>
                    <div className="h-1 w-12 bg-neon-green mt-2 rounded-full"></div>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setShowCart(true)}
                        className="relative w-10 h-10 rounded-full bg-dark-800 border border-white/20 text-white flex items-center justify-center hover:bg-white hover:text-black transition-colors"
                    >
                        <ShoppingCart size={18} />
                        {getCartTotalCount() > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-neon-green text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                                {getCartTotalCount()}
                            </div>
                        )}
                    </button>
                    <button 
                        onClick={openConciergeModal}
                        className="w-10 h-10 rounded-full bg-neon-blue/10 border border-neon-blue/30 text-neon-blue flex items-center justify-center hover:bg-neon-blue hover:text-black transition-colors"
                    >
                        <Bot size={20} />
                    </button>
                    <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center hover:bg-dark-700 transition-colors text-gray-400 hover:text-white border border-white/5">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {cartError && (
                 <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-bounce">
                    <div className="bg-red-600/90 backdrop-blur text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-red-400/50">
                         <AlertCircle className="shrink-0" />
                         <span className="text-sm font-bold">{cartError}</span>
                    </div>
                 </div>
            )}

            <div className="grid gap-6">
                {allEvents.map(event => {
                    const myTickets = tickets.filter(t => t.eventId === event.id).length;
                    const cartQty = cart[event.id] || 0;
                    const hasMaxTickets = (myTickets + cartQty) >= 4;
                    const isSoldOut = event.soldTickets >= event.totalTickets;
                    const isMapVisible = visibleMapId === event.id;

                    return (
                        <div key={event.id} className={`group relative overflow-hidden rounded-3xl bg-dark-800/80 border transition-all hover:shadow-[0_0_30px_-10px_rgba(0,255,157,0.15)] ${recommendedEventId === event.id ? 'border-neon-blue ring-2 ring-neon-blue shadow-[0_0_30px_rgba(0,243,255,0.3)]' : 'border-white/5 hover:border-neon-green/30'}`}>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dark-900/60 to-dark-900 z-10 pointer-events-none"></div>
                            
                            <div className="h-48 relative overflow-hidden bg-gray-900">
                                {isMapVisible ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        loading="lazy"
                                        allowFullScreen
                                        src={`https://www.google.com/maps?q=${encodeURIComponent(event.venue)}&output=embed`}
                                    ></iframe>
                                ) : (
                                    <>
                                        <img src={event.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={event.name} />
                                        <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-sm font-bold flex items-center gap-1">
                                            <span className="text-neon-green">₹</span>
                                            {event.price}
                                        </div>
                                        <div className="absolute bottom-4 left-4 z-20 flex gap-1 flex-wrap pr-4">
                                            {event.tags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-black/60 backdrop-blur text-white border border-white/10 px-2 py-1 rounded-md">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="p-6 relative z-20 -mt-2">
                                <div className="flex justify-between items-start mb-2">
                                     <h3 className="font-bold text-2xl text-white leading-tight max-w-[70%]">{event.name}</h3>
                                     <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${isSoldOut ? 'border-red-500 text-red-500' : 'border-neon-blue text-neon-blue'}`}>
                                        {isSoldOut ? 'Sold Out' : 'Selling Fast'}
                                     </div>
                                </div>
                                
                                <p className="text-sm text-gray-300 mb-4 line-clamp-2 min-h-[40px]">{event.description || "No description provided."}</p>

                                <div className="flex flex-col gap-2 text-gray-400 text-sm mb-6">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-500" />
                                        <span>{new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-gray-500" />
                                        <span className="truncate max-w-[200px]">{event.venue}</span>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                     <button 
                                        onClick={() => setVisibleMapId(isMapVisible ? null : event.id)}
                                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-colors ${isMapVisible ? 'bg-neon-blue text-black border-neon-blue' : 'bg-dark-700 border-white/10 hover:border-white/30 text-white'}`}
                                     >
                                        <Map size={20} />
                                     </button>

                                    <button 
                                        onClick={() => !hasMaxTickets && !isSoldOut && addToCart(event.id)}
                                        disabled={hasMaxTickets || isSoldOut}
                                        className={`flex-1 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg
                                            ${hasMaxTickets 
                                                ? 'bg-dark-700 text-gray-500 border border-dark-600' 
                                                : isSoldOut 
                                                    ? 'bg-dark-700 text-red-400 border border-red-900/30'
                                                    : 'bg-white text-black hover:bg-neon-green hover:scale-[1.02]'
                                            }`}
                                    >
                                        {hasMaxTickets ? (
                                            <>
                                                <ShieldCheck size={18} />
                                                Max Reached
                                            </>
                                        ) : isSoldOut ? (
                                            "Sold Out"
                                        ) : (
                                            <>
                                                Add to Cart {cartQty > 0 ? `(${cartQty})` : ''} <Plus size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {renderConciergeModal()}
            {renderCartModal()}
        </div>
    );
  };

  const renderUserTicketView = () => {
    if (selectedTicket) {
        return (
            <div className="flex flex-col h-full bg-grid-pattern">
                <div className="p-6 flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedTicket(null)}
                        className="w-10 h-10 rounded-full bg-dark-800 border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all"
                    >
                        ←
                    </button>
                    <h1 className="font-bold text-xl truncate pr-4">{selectedTicket.eventName}</h1>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center -mt-10">
                    <SecureQR ticket={selectedTicket} deviceId={deviceId} />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-6 pb-32 scroll-smooth">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">My Wallet</h1>
                <div className="flex items-center gap-2 bg-dark-800/50 w-fit px-3 py-1 rounded-full border border-white/5">
                     <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
                     <span className="text-xs text-gray-400">{user?.email}</span>
                </div>
            </header>
            <div className="space-y-4">
                {tickets.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <ShoppingBag size={48} className="mx-auto mb-4 text-gray-600" />
                        <p>No tickets yet.</p>
                    </div>
                )}
                {tickets.map(ticket => (
                    <div 
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl p-6 border border-white/5 cursor-pointer hover:border-neon-green/30 transition-all hover:translate-y-[-2px] shadow-lg group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-white group-hover:text-neon-green transition-colors">{ticket.eventName}</h3>
                                <p className="text-sm text-gray-400">{ticket.venue}</p>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                                <TicketIcon size={20} className="text-neon-green" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                            <span className="text-xs font-mono text-gray-500">{new Date(ticket.eventDate).toLocaleDateString()}</span>
                            <span className="text-xs bg-white text-black px-3 py-1.5 rounded font-bold flex items-center gap-1 group-hover:bg-neon-green transition-colors">
                                ACCESS CODE <ArrowRight size={10} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const renderAdminDashboard = () => {
    const totalSales = allEvents.reduce((acc, e) => acc + (e.soldTickets * e.price), 0);
    const totalTicketsSold = allEvents.reduce((acc, e) => acc + e.soldTickets, 0);

    return (
        <div className="h-full overflow-y-auto p-6 pb-32 scroll-smooth">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neon-purple to-white">Admin Panel</h1>
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mt-1">Live Overview</p>
                </div>
                <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center hover:bg-red-900/20 hover:text-red-400 transition-colors border border-white/5">
                    <LogOut size={18} />
                </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-dark-800 to-dark-900 p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={40} />
                    </div>
                    <p className="text-gray-500 text-[10px] font-mono uppercase mb-2">Revenue</p>
                    <p className="text-2xl font-bold text-white">₹{totalSales.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-dark-800 to-dark-900 p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TicketIcon size={40} />
                    </div>
                    <p className="text-gray-500 text-[10px] font-mono uppercase mb-2">Tickets Sold</p>
                    <p className="text-2xl font-bold text-neon-purple">{totalTicketsSold}</p>
                </div>
            </div>

            <div className="mb-6">
                 <h3 className="font-bold mb-4 text-white flex items-center gap-2">
                    <Briefcase size={16} className="text-neon-purple"/>
                    Active Events
                 </h3>
                 <div className="space-y-3">
                    {allEvents.map(evt => (
                        <div key={evt.id} className="bg-dark-800/50 p-4 rounded-xl border border-white/5 flex justify-between items-center backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-700 overflow-hidden">
                                    <img src={evt.image} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-white">{evt.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{new Date(evt.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-white bg-white/5 px-2 py-1 rounded">
                                    {evt.soldTickets} / {evt.totalTickets}
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
  };

  const renderCreateEvent = () => (
      <div className="h-full overflow-y-auto p-6 pb-32 scroll-smooth">
          <h1 className="text-3xl font-bold text-white mb-2">New Event</h1>
          <p className="text-gray-400 text-sm mb-8">Deploy a new smart contract for ticketing.</p>
          
          <form onSubmit={handleCreateEvent} className="space-y-5">
              <div className="space-y-4">
                  <div>
                      <label className="text-xs text-gray-500 font-mono block mb-1 uppercase">Event Title</label>
                      <input required className="w-full bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} placeholder="e.g. Cyber Punk Rave"/>
                  </div>
                  <div>
                      <label className="text-xs text-gray-500 font-mono block mb-1 uppercase">Venue Location</label>
                      <div className="flex gap-2">
                          <input 
                            required 
                            className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors" 
                            value={newEvent.venue} 
                            onChange={e => setNewEvent({...newEvent, venue: e.target.value})} 
                            placeholder="e.g. Sector 7 or 'Chase Center'"
                          />
                          <button 
                            type="button"
                            onClick={handleVerifyLocation}
                            disabled={verifyingLocation || !newEvent.venue}
                            className="bg-dark-700 border border-dark-600 rounded-xl px-4 flex items-center justify-center text-neon-blue hover:bg-neon-blue hover:text-black transition-colors disabled:opacity-50"
                          >
                             {verifyingLocation ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Map size={20} />}
                          </button>
                      </div>
                      
                      {/* Map Preview for Organizer */}
                      {newEvent.venue && !verifyingLocation && (
                          <div className="mt-2 h-40 w-full rounded-xl overflow-hidden border border-white/10 relative group">
                               <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    allowFullScreen
                                    src={`https://www.google.com/maps?q=${encodeURIComponent(newEvent.venue)}&output=embed`}
                                ></iframe>
                                <div className="absolute inset-0 pointer-events-none border border-neon-purple/30 rounded-xl"></div>
                          </div>
                      )}
                  </div>
                  <div>
                      <label className="text-xs text-gray-500 font-mono block mb-1 uppercase">Tags / Categories</label>
                      <input className="w-full bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors" value={newEvent.tags} onChange={e => setNewEvent({...newEvent, tags: e.target.value})} placeholder="e.g. Sci-Fi, Action, Music (comma separated)"/>
                  </div>
                   <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-xs text-gray-500 font-mono block uppercase">Description</label>
                        <button 
                            type="button" 
                            onClick={handleGenerateHype}
                            disabled={isGeneratingHype || !newEvent.name || !newEvent.venue}
                            className="text-[10px] bg-neon-purple/20 text-neon-purple px-2 py-1 rounded hover:bg-neon-purple hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                            {isGeneratingHype ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Sparkles size={12} />}
                            Auto-Hype
                        </button>
                      </div>
                      <textarea 
                        required 
                        rows={3}
                        className="w-full bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors text-sm" 
                        value={newEvent.description} 
                        onChange={e => setNewEvent({...newEvent, description: e.target.value})} 
                        placeholder="Describe the event experience..."
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                       <div>
                            <label className="text-xs text-gray-500 font-mono block mb-1 uppercase">Price (INR)</label>
                            <input required type="number" className="w-full bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors" value={newEvent.price} onChange={e => setNewEvent({...newEvent, price: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-mono block mb-1 uppercase">Supply</label>
                            <input required type="number" className="w-full bg-dark-800 border border-dark-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none transition-colors" value={newEvent.total} onChange={e => setNewEvent({...newEvent, total: e.target.value})} />
                        </div>
                  </div>
              </div>
              
              <button disabled={creatingEvent} className="w-full bg-gradient-to-r from-neon-purple to-indigo-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-purple-900/20 hover:scale-[1.02] transition-transform">
                  {creatingEvent ? 'Deploying...' : 'Deploy Event Contract'}
              </button>
          </form>
      </div>
  );

  const renderScanner = () => (
      <div className="h-full flex flex-col bg-black">
           <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <h1 className="font-bold text-lg text-white flex items-center gap-2 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                    <ShieldCheck size={18} className="text-neon-blue" />
                    Gatekeeper Protocol
                </h1>
                <button onClick={handleLogout} className="text-xs font-mono text-gray-400 border border-white/10 px-3 py-1 rounded hover:bg-white hover:text-black transition-colors">EXIT</button>
            </div>
            {scanResult ? (
                 <ScanResultDisplay result={scanResult} onReset={() => setScanResult(null)} />
            ) : (
                 <Scanner onScanComplete={setScanResult} />
            )}
      </div>
  );

  // --- Main Render ---

  if (!user) return (
      <>
        {renderLogin()}
        {renderNewUserRecoveryModal()}
      </>
  );

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-neon-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-center p-4">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-400 mb-2">Application Error</h2>
        <p className="text-gray-400 max-w-md">{appError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white font-sans selection:bg-neon-green selection:text-black relative">
       {/* Global Texture */}
       <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none z-0"></div>
      
      <main className="h-[100dvh] overflow-hidden relative z-10">
        {user.role === 'USER' && (
            <>
                {mode === 'MARKET' && renderMarketplaceView()}
                {mode === 'USER' && renderUserTicketView()}
            </>
        )}
        {user.role === 'MANAGER' && (
            <>
                {mode === 'ADMIN' && renderAdminDashboard()}
                {mode === 'CREATE_EVENT' && renderCreateEvent()}
                {mode === 'SCANNER' && renderScanner()}
            </>
        )}
      </main>
      <Navigation currentMode={mode} setMode={setMode} userRole={user.role} />
      {renderNewUserRecoveryModal()}
    </div>
  );
}