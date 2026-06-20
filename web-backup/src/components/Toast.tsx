import React, { useEffect } from "react";
import { Check, X, Bell, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info" | "warning";
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function Toast({ toasts, onClose }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        return (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        );
      })}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void; key?: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const Icon = {
    success: Check,
    error: X,
    warning: Bell,
    info: Info,
  }[toast.type];

  const colors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-sky-50 border-sky-200 text-sky-800",
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg ${colors} transition-all duration-300 animate-slide-in`}
    >
      <div className="p-1 rounded-lg bg-white bg-opacity-60 flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 text-sm font-medium leading-relaxed">{toast.text}</div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-stone-400 hover:text-stone-700 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
