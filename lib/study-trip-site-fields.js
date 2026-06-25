import { assertValidPhone, normalizePhoneForStorage } from '@/lib/phone';

export function getStudyTripSiteName(doc) {
    return String(doc?.site ?? doc?.name ?? '').trim();
}

export function getStudyTripSiteLocation(doc) {
    return String(doc?.location ?? '').trim();
}

export function getStudyTripSiteContactPerson(doc) {
    return String(doc?.contactperson ?? doc?.contact_person ?? doc?.contactPerson ?? '').trim();
}

/** Read `contact` from Appwrite for the phone input. */
export function getStudyTripSiteContactPhone(doc) {
    return normalizePhoneForStorage(doc?.contact) || String(doc?.contact ?? '').trim();
}

/** Display size in tables and detail views; em dash when not provided. */
export function formatStudyTripSiteSize(value) {
    const trimmed = String(value ?? '').trim();
    return trimmed || '—';
}

function parseOptionalString(value, label, maxLength) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed)
        return '';
    if (maxLength && trimmed.length > maxLength)
        throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return trimmed;
}

function parseRequiredString(value, label, maxLength) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed)
        throw new Error(`${label} is required.`);
    if (maxLength && trimmed.length > maxLength)
        throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return trimmed;
}

/** Appwrite `contact` is String — store validated international phone. */
export function parseStudyTripSiteContactPhone(value) {
    const phone = assertValidPhone(value, 'Phone');
    if (!phone)
        throw new Error('Phone is required.');
    return phone;
}

/**
 * Build Appwrite document payload for `studytripsites`.
 * Range rules on size/contact are enforced by Appwrite only.
 */
export function buildStudyTripSiteWritePayload(formData) {
    const site = String(formData.site ?? '').trim();
    if (!site)
        throw new Error('Site name is required.');
    if (site.length > 100)
        throw new Error('Site name must be 100 characters or fewer.');

    const location = String(formData.location ?? '').trim();
    if (!location)
        throw new Error('Location is required.');
    if (location.length > 100)
        throw new Error('Location must be 100 characters or fewer.');

    const technology = String(formData.technology ?? '').trim();
    if (!technology)
        throw new Error('Technology is required.');
    if (technology.length > 100)
        throw new Error('Technology must be 100 characters or fewer.');

    const type = parseOptionalString(formData.type, 'Type', 100);
    const size = parseOptionalString(formData.size, 'Size', 100);

    const contactperson = String(formData.contactperson ?? '').trim();
    if (!contactperson)
        throw new Error('Contact person is required.');
    if (contactperson.length > 100)
        throw new Error('Contact person must be 100 characters or fewer.');

    const email = String(formData.email ?? '').trim().toLowerCase();
    if (!email)
        throw new Error('Email is required.');
    if (!email.includes('@'))
        throw new Error('Please enter a valid email address.');

    return {
        site,
        location,
        technology,
        type,
        size,
        contact: parseStudyTripSiteContactPhone(formData.contact_phone),
        contactperson,
        email,
    };
}
