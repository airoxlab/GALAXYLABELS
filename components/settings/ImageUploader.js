'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ImageUploader({
  label,
  preview,
  onUpload,
  onDelete,
  uploading = false,
  rounded = false,
  className,
}) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    onUpload(file);
  };

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-neutral-700 mb-2">{label}</label>
      <div className={cn(
        "border-2 border-dashed border-neutral-200 rounded-lg p-3",
        "bg-neutral-50/50",
        "flex flex-col items-center justify-center",
        "min-h-[120px]",
        "relative"
      )}>
        {preview ? (
          <>
            <img
              src={preview}
              alt={label}
              className={cn(
                "max-h-20 max-w-full object-contain",
                rounded && "rounded-full"
              )}
            />
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                title="Delete image"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <div className="text-[10px] text-neutral-400">No {label}</div>
        )}
      </div>
      <label className="mt-2 block">
        <div className={cn(
          "px-3 py-2 rounded-lg text-xs font-medium text-center cursor-pointer",
          "bg-neutral-900 text-white",
          "hover:bg-neutral-800",
          "transition-all duration-200",
          uploading && "opacity-50 cursor-not-allowed"
        )}>
          {uploading ? 'Uploading...' : `Upload ${label}`}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </label>
    </div>
  );
}
