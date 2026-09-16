import React, { Component, ReactNode, ErrorInfo } from 'react';

/** Material-style icon button */
export const IconBtn: React.FC<{
  label: string;
  icon: string;
  onClick?: (e?: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  badge?: string | number | null;
}> = ({ label, icon, onClick, active, disabled, className = '', badge }) => (
  <button
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`relative mat-btn flex flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-2 transition-all select-none
      ${active ? 'mat-btn--active shadow-elev-1' : 'text-on-surface/80 hover:bg-surface-variant/70'}
      ${disabled ? 'opacity-40 pointer-events-none' : ''}
      ${className}`}
  >
    <span className="material-symbols-rounded leading-none">{icon}</span>
    {badge != null && badge !== '' && (
      <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-[10px] font-bold text-white flex items-center justify-center bg-red-500">
        {badge}
      </span>
    )}
  </button>
);

/** Simple tool group separator */
export const ToolSeparator: React.FC = () => (
  <div className="w-px h-7 bg-black/10 mx-1 self-center" />
);

/** Material bottom sheet surface (dialog panel) */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxW?: string;
  footer?: React.ReactNode;
}> = ({ open, onClose, title, children, maxW = 'max-w-xl', footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`bg-white w-full ${maxW} max-h-[85vh] rounded-t-3xl shadow-elev-12 animate-fade-in-down flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 pt-5 pb-4 border-b border-black/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2.5">{title}</h2>
            <button onClick={onClose} className="mat-btn p-2 rounded-full text-on-surface/70 hover:bg-surface-variant" aria-label="Close" title="إغلاق / Close">
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-black/5 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};

/** Material button variants */
export const MButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'tonal' | 'outline' | 'text';
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, variant = 'primary', disabled, className = '' }) => {
  const base = 'mat-btn px-5 py-2.5 rounded-full font-medium text-sm inline-flex items-center gap-2 transition-all disabled:opacity-40';
  const styles: Record<string, string> = {
    primary: 'bg-primary text-white shadow-elev-1 hover:shadow-elev-2',
    tonal: 'bg-tonal text-[#047857] hover:brightness-95',
    outline: 'border border-black/15 text-on-surface hover:bg-surface-variant/50',
    text: 'text-primary hover:bg-tonal/60',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
};

/** Loading indicator (Material spinner) */
export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <span
    className={`inline-block rounded-full border-2 border-t-transparent animate-spin ${className}`}
    style={{ width: size, height: size, borderColor: 'currentColor', borderTopColor: 'transparent' }}
    aria-label="Loading"
  />
);

/** Material text field */
export const MInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}> = ({ value, onChange, placeholder, multiline, rows = 3, className = '' }) => {
  const cls = `w-full px-4 py-3 rounded-2xl border border-black/10 bg-surface-variant/40 focus:bg-white focus:border-primary focus:outline-none text-on-surface text-sm placeholder:text-on-surface/40 transition-colors ${className}`;
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${cls} resize-none`} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />;
};

/** React Error Boundary for resilient app recovery */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackText?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SmartBoard Error Boundary caught:', error, errorInfo);
  }

  render() {
    const s = (this as any).state as ErrorBoundaryState;
    const p = (this as any).props as ErrorBoundaryProps;
    if (s.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
          <div className="bg-slate-800 p-8 rounded-2xl max-w-md shadow-2xl border border-slate-700">
            <span className="material-symbols-rounded text-5xl text-[#00E5FF] mb-3 block">warning</span>
            <h2 className="text-xl font-bold mb-2">SmartBoard Recovered</h2>
            <p className="text-sm text-slate-300 mb-6">
              An unexpected issue occurred, but your session is protected.
            </p>
            <button
              onClick={() => {
                (this as any).setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-[#00E5FF] hover:brightness-110 text-black rounded-xl font-semibold shadow-lg transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return p.children;
  }
}