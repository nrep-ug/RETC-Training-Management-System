'use client';
/** Control bar for client-paginated tables: range text, page size, prev/next. */
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CLIENT_PAGE_SIZE_OPTIONS } from '@/hooks/use-client-pagination';

export function TablePaginationFooter({ total, page, pageSize, totalPages, rangeFrom, rangeTo, onPageChange, onPageSizeChange, className = '', }) {
    if (total <= 0) {
        return null;
    }
    return (<div className={`flex flex-col gap-3 border-t border-[#047857]/15 bg-gradient-to-r from-white via-[#f7faf8] to-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${className}`}>
      <p className="text-sm text-gray-600">
        Showing{' '}
        <span className="font-medium text-gray-900">{rangeFrom}</span>
        –
        <span className="font-medium text-gray-900">{rangeTo}</span>
        {' '}of{' '}
        <span className="font-medium text-gray-900">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-gray-500">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[4.75rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_PAGE_SIZE_OPTIONS.map((n) => (<SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4"/>
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-gray-700">
            Page {page} of {totalPages}
          </span>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight className="h-4 w-4"/>
          </Button>
        </div>
      </div>
    </div>);
}
