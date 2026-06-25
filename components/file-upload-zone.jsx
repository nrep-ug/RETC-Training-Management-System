'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FileUploadZone({
    id,
    accept,
    disabled = false,
    selectedFile = null,
    existingFileName = '',
    existingFileId = '',
    onFileSelect,
    onRemove,
    onViewExisting,
    maxSizeLabel = '',
    hint = '',
    statusLabel = '',
}) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const hasNewFile = Boolean(selectedFile);
    const hasExisting = Boolean(existingFileName || existingFileId);
    const hasSelection = hasNewFile || hasExisting;
    const displayName = selectedFile?.name || existingFileName || 'Document';

    const pickFile = (file) => {
        if (!file || disabled)
            return;
        onFileSelect?.(file);
    };

    const handleInputChange = (e) => {
        const file = e.target.files?.[0] || null;
        pickFile(file);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled)
            return;
        const file = e.dataTransfer.files?.[0] || null;
        pickFile(file);
    };

    if (hasSelection) {
        return (
            <div className="rounded-lg border border-[#047857]/30 bg-gradient-to-br from-[#047857]/5 to-white p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#047857]/15">
                            <FileText className="h-5 w-5 text-[#047857]" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#047857]">
                                {statusLabel || (hasNewFile ? 'Selected — will upload when you save' : 'Uploaded')}
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-slate-500 hover:text-red-600"
                        onClick={() => onRemove?.()}
                        disabled={disabled}
                        title="Remove file"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#047857]/15 pt-3">
                    {hasExisting && !hasNewFile && onViewExisting ? (
                        <Button type="button" variant="outline" size="sm" onClick={onViewExisting} disabled={disabled}>
                            View
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                    >
                        Replace file
                    </Button>
                </div>
                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept={accept}
                    className="hidden"
                    disabled={disabled}
                    onChange={handleInputChange}
                />
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={(e) => {
                e.preventDefault();
                if (!disabled)
                    setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
                if (!disabled)
                    inputRef.current?.click();
            }}
            className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                disabled && 'cursor-not-allowed opacity-60',
                isDragging
                    ? 'border-[#047857] bg-[#047857]/10'
                    : 'border-slate-300 bg-slate-50 hover:border-[#047857]/50 hover:bg-[#047857]/5',
            )}
        >
            <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">Drag and drop your file here</p>
            <p className="mt-1 text-sm text-slate-600">or click to browse</p>
            {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
            {maxSizeLabel ? <p className="mt-1 text-xs text-slate-500">{maxSizeLabel}</p> : null}
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept={accept}
                className="hidden"
                disabled={disabled}
                onChange={handleInputChange}
            />
        </div>
    );
}
