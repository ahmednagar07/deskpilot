import React, { useEffect, useState } from 'react';
import { useToastStore, Toast } from '../../stores/toast-store';

const TOAST_COLORS = {
  success: { accent: '#2DD4A8', bg: 'rgba(45, 212, 168, 0.12)' },
  error:   { accent: '#FF4D6A', bg: 'rgba(255, 77, 106, 0.12)' },
  warning: { accent: '#F0C246', bg: 'rgba(240, 194, 70, 0.12)' },
  info:    { accent: '#7C5CFC', bg: 'rgba(124, 92, 252, 0.12)' },
} as const;

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
    </svg>
  );
}

const ICONS = {
  success: CheckIcon,
  error: XCircleIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const colors = TOAST_COLORS[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setIsEntered(true));
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 300);
  };

  // Auto-trigger exit animation before removal
  useEffect(() => {
    const exitTime = (toast.duration || 4000) - 300;
    if (exitTime > 0) {
      const timer = setTimeout(() => setIsExiting(true), exitTime);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3 rounded-xl border border-edge/50 overflow-hidden transition-all duration-300 ease-out"
      style={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background: 'var(--t-toast-bg)',
        transform: isEntered && !isExiting ? 'translateX(0)' : 'translateX(120%)',
        opacity: isExiting ? 0 : 1,
        maxWidth: '420px',
        minWidth: '300px',
        boxShadow: 'var(--t-toast-shadow)',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Icon */}
      <span style={{ color: colors.accent }} className="shrink-0 ml-1">
        <Icon />
      </span>

      {/* Message */}
      <span className="text-sm text-foreground flex-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {toast.message}
      </span>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 text-faint hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-lg hover:bg-edge/30"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
