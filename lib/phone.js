/** E.164 international numbers: up to 15 digits, optional leading "+". */
export const PHONE_MAX_DIGITS = 15;
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_STORED_LENGTH = 16;

/**
 * Normalize a phone value for storage — trim, strip separators, keep optional "+".
 * Existing Ugandan values like 256712345678 are preserved as-is.
 */
export function normalizePhoneForStorage(value) {
    if (value === undefined || value === null)
        return '';
    const trimmed = String(value).trim();
    if (!trimmed)
        return '';

    const compact = trimmed.replace(/[\s().-]/g, '');
    const hasPlus = compact.startsWith('+');
    const digits = compact.replace(/\D/g, '');
    if (!digits)
        return '';

    return hasPlus ? `+${digits}` : digits;
}

export function getPhoneDigitCount(value) {
    return String(value || '').replace(/\D/g, '').length;
}

/**
 * Validate and normalize a phone field. Throws on invalid input.
 * @param {unknown} value
 * @param {string} fieldLabel
 * @returns {string}
 */
export function assertValidPhone(value, fieldLabel = 'Phone') {
    const normalized = normalizePhoneForStorage(value);
    if (!normalized)
        return '';

    const digits = getPhoneDigitCount(normalized);
    if (digits < PHONE_MIN_DIGITS) {
        throw new Error(`${fieldLabel} must have at least ${PHONE_MIN_DIGITS} digits.`);
    }
    if (digits > PHONE_MAX_DIGITS) {
        throw new Error(`${fieldLabel} must have at most ${PHONE_MAX_DIGITS} digits (international format).`);
    }
    if (normalized.length > PHONE_MAX_STORED_LENGTH) {
        throw new Error(`${fieldLabel} is too long.`);
    }
    return normalized;
}

/** Compare by digits only so +256… matches 256… for duplicate checks. */
export function phonesAreEquivalent(a, b) {
    const left = String(a || '').replace(/\D/g, '');
    const right = String(b || '').replace(/\D/g, '');
    return Boolean(left && right && left === right);
}

/**
 * Format a stored phone for the international phone input (E.164-style).
 * Keeps legacy Uganda values like 256712345678 and local 07xxxxxxxx working.
 */
export function phoneValueForInput(stored, defaultCountry = 'ug') {
    const normalized = normalizePhoneForStorage(stored);
    if (!normalized)
        return '';
    if (normalized.startsWith('+'))
        return normalized;
    if (defaultCountry === 'ug' && /^0\d{9}$/.test(normalized))
        return `+256${normalized.slice(1)}`;
    return `+${normalized}`;
}

/** True when the value has enough digits to validate and store. */
export function isCompletePhone(value) {
    return getPhoneDigitCount(value) >= PHONE_MIN_DIGITS;
}
