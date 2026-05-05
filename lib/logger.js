/**
 * Central place to gate console noise. Production builds should not spam the console
 * with debug info; use devLog / devWarn for that. Real errors can still use console.error at call sites.
 */
const isDev = process.env.NODE_ENV === 'development';

/** Logs only in development. */
export function devLog(...args) {
    if (isDev)
        console.log(...args);
}

/** Warnings only in development (e.g. report fetch fallbacks). */
export function devWarn(...args) {
    if (isDev)
        console.warn(...args);
}
