'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  type = 'warning', // 'warning', 'danger'
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const typeConfig = {
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-neutral-600" />,
      iconBgColor: 'bg-neutral-100',
      buttonColor: 'bg-neutral-900 hover:bg-neutral-800',
    },
    danger: {
      icon: <Trash2 className="w-6 h-6 text-neutral-600" />,
      iconBgColor: 'bg-neutral-100',
      buttonColor: 'bg-neutral-900 hover:bg-neutral-800',
    },
  };

  const config = typeConfig[type] || typeConfig.warning;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - Black */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={cn(
          "relative w-full max-w-md transform transition-all",
          "bg-white/95 backdrop-blur-xl rounded-2xl",
          "border border-neutral-200/60",
          "shadow-[0_20px_60px_rgba(0,0,0,0.15)]",
          "p-6"
        )}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className={cn(
            "mx-auto flex items-center justify-center w-12 h-12 rounded-xl mb-4",
            config.iconBgColor
          )}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2 tracking-tight">
              {title}
            </h3>
            <p className="text-sm text-neutral-600">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium text-sm",
                "bg-white border border-neutral-200/60 text-neutral-700",
                "hover:bg-neutral-50 hover:border-neutral-300",
                "transition-all duration-200"
              )}
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-white",
                "shadow-lg transition-all duration-200",
                "hover:-translate-y-[1px] hover:shadow-xl",
                "active:translate-y-0",
                config.buttonColor
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
