'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const DEFAULT_CLIENT_PAGE_SIZE = 10;
export const CLIENT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Client-side pagination for in-memory arrays (e.g. filtered table rows).
 * @param {unknown[]} items
 * @param {{ resetKey?: string; initialPageSize?: number }} [options]
 */
export function useClientPagination(items, { resetKey = '', initialPageSize = DEFAULT_CLIENT_PAGE_SIZE } = {}) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSizeState] = useState(initialPageSize);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    // When filters (or any parent “resetKey”) change, start back at page 1.
    useEffect(() => {
        setPage(1);
    }, [resetKey]);

    // If the list shrinks (e.g. delete) and the current page is past the end, clamp to last page.
    useEffect(() => {
        setPage((p) => Math.min(Math.max(1, p), totalPages));
    }, [totalPages]);

    const pagedItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeTo = Math.min(page * pageSize, total);

    const setPageSize = useCallback((next) => {
        setPageSizeState(next);
        setPage(1);
    }, []);

    return {
        page,
        setPage,
        pageSize,
        setPageSize,
        pagedItems,
        total,
        totalPages,
        rangeFrom,
        rangeTo,
    };
}
