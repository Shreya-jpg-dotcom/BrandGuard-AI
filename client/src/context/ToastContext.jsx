import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return <ToastContext.Provider value={notify}>{children}<div className="toast-stack" aria-live="polite">{items.map((item) => { const Icon = icons[item.type] || Info; return <motion.div key={item.id} className={`toast toast-${item.type}`} initial={{ opacity: 0, y: 12, x: 16 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, x: 16 }}><Icon size={17}/><span>{item.message}</span><button aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15}/></button></motion.div>; })}</div></ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
