'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

// Custom toast notification functions
export const notify = {
  success: (message, title = 'Success') => {
    toast.success(
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{message}</div>
      </div>,
      {
        duration: 3000,
      }
    );
  },

  error: (message, title = 'Error') => {
    toast.error(
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{message}</div>
      </div>,
      {
        duration: 5000,
      }
    );
  },

  info: (message, title = 'Info') => {
    toast(
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{message}</div>
      </div>,
      {
        icon: 'ℹ️',
        duration: 4000,
      }
    );
  },

  warning: (message, title = 'Warning') => {
    toast(
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{message}</div>
      </div>,
      {
        icon: '⚠️',
        duration: 4000,
        style: {
          border: '1px solid #fef3c7',
        },
      }
    );
  },

  loading: (message) => {
    return toast.loading(message);
  },

  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },

  promise: (promise, messages) => {
    return toast.promise(promise, messages);
  },
};

// Hook for confirmation modals
export function useConfirm() {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null,
  });

  const showConfirm = ({ title, message, type = 'warning', onConfirm }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
    });
  };

  const hideConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const showDeleteConfirm = (title, message, onConfirm) => {
    showConfirm({ title, message, type: 'danger', onConfirm });
  };

  return {
    confirmState,
    showConfirm,
    hideConfirm,
    showDeleteConfirm,
  };
}

// Convenience hook that combines both
export function useNotifications() {
  const confirmHook = useConfirm();

  return {
    ...confirmHook,
    notify,
  };
}
