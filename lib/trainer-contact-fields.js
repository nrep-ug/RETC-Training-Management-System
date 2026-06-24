import { assertValidPhone, hasMeaningfulPhoneDigits, isEmptyOptionalPhoneInput, phonesAreEquivalent } from '@/lib/phone';

export const TRAINER_OPTIONAL_EMAIL_KEY = 'optional_email';
export const TRAINER_OPTIONAL_PHONE_KEY = 'optional_phone';

export function getTrainerPrimaryEmail(trainer) {
    return String(trainer?.email || '').trim().toLowerCase();
}

export function getTrainerOptionalEmail(trainer) {
    return String(
        trainer?.[TRAINER_OPTIONAL_EMAIL_KEY]
        ?? trainer?.['optional-email']
        ?? '',
    ).trim().toLowerCase();
}

export function getTrainerPrimaryPhone(trainer) {
    return String(trainer?.phone ?? trainer?.['primary-phone'] ?? '').trim();
}

export function getTrainerOptionalPhone(trainer) {
    return String(
        trainer?.[TRAINER_OPTIONAL_PHONE_KEY]
        ?? trainer?.['optional-phone']
        ?? trainer?.additional_phone
        ?? '',
    ).trim();
}

/**
 * Build phone/email fields for Appwrite from raw form data.
 * Primary `phone` is required in Appwrite — never send null.
 * Optional fields clear with null on edit when empty.
 */
export function buildTrainerContactWriteFields(formData, { isEdit = false, existingTrainer = null } = {}) {
    const out = {};

    const applyPhone = (key, label, { required = false } = {}) => {
        if (!Object.prototype.hasOwnProperty.call(formData, key))
            return;
        const trimmed = String(formData[key] ?? '').trim();
        if (!trimmed || isEmptyOptionalPhoneInput(trimmed)) {
            if (required) {
                const existing = key === 'phone'
                    ? getTrainerPrimaryPhone(existingTrainer)
                    : getTrainerOptionalPhone(existingTrainer);
                if (isEdit && hasMeaningfulPhoneDigits(existing)) {
                    out[key] = assertValidPhone(existing, label);
                    return;
                }
                throw new Error(`${label} is required.`);
            }
            if (isEdit)
                out[key] = null;
            return;
        }
        out[key] = assertValidPhone(trimmed, label);
    };

    applyPhone('phone', 'Primary phone', { required: true });
    applyPhone(TRAINER_OPTIONAL_PHONE_KEY, 'Additional contact', { required: false });

    if (Object.prototype.hasOwnProperty.call(formData, TRAINER_OPTIONAL_EMAIL_KEY)) {
        const trimmed = String(formData[TRAINER_OPTIONAL_EMAIL_KEY] ?? '').trim();
        if (!trimmed) {
            if (isEdit)
                out[TRAINER_OPTIONAL_EMAIL_KEY] = null;
        }
        else if (!trimmed.includes('@')) {
            throw new Error('Please enter a valid additional email.');
        }
        else {
            out[TRAINER_OPTIONAL_EMAIL_KEY] = trimmed.toLowerCase();
        }
    }

    return out;
}

export function getTrainerAllEmails(trainer) {
    return [getTrainerPrimaryEmail(trainer), getTrainerOptionalEmail(trainer)].filter(Boolean);
}

export function getTrainerAllPhones(trainer) {
    return [getTrainerPrimaryPhone(trainer), getTrainerOptionalPhone(trainer)]
        .filter((value) => hasMeaningfulPhoneDigits(value));
}

/**
 * @param {Array<Record<string, unknown>>} trainers
 * @param {{ email?: string, optional_email?: string, phone?: string, optional_phone?: string }} payload
 * @param {{ excludeId?: string }} options
 */
export function findFacilitatorContactDuplicate(trainers, payload, { excludeId = '' } = {}) {
    const newEmails = [
        String(payload.email || '').trim().toLowerCase(),
        String(payload[TRAINER_OPTIONAL_EMAIL_KEY] || '').trim().toLowerCase(),
    ].filter(Boolean);

    const newPhones = [payload.phone, payload[TRAINER_OPTIONAL_PHONE_KEY]]
        .map((value) => String(value || '').trim())
        .filter((value) => hasMeaningfulPhoneDigits(value));

    for (const trainer of trainers) {
        const trainerId = String(trainer?.$id ?? trainer?.documentId ?? trainer?.id ?? '').trim();
        if (excludeId && trainerId === excludeId)
            continue;

        const existingEmails = getTrainerAllEmails(trainer);
        for (const email of newEmails) {
            if (existingEmails.includes(email)) {
                return { reason: 'email', trainer };
            }
        }

        const existingPhones = getTrainerAllPhones(trainer);
        for (const phone of newPhones) {
            if (existingPhones.some((existing) => phonesAreEquivalent(existing, phone))) {
                return { reason: 'phone', trainer };
            }
        }
    }

    return null;
}
