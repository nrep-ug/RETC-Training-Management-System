/** User-facing labels for the trainers collection (RETC facilitators). */
export const RETC_FACILITATOR_LABELS = {
    moduleTitle: 'RETC Facilitators',
    moduleSingular: 'RETC facilitator',
    modulePlural: 'RETC facilitators',
    addButton: 'Add RETC Facilitator',
    saveButton: 'Save RETC Facilitator',
    editTitle: 'Edit RETC Facilitator',
    addTitle: 'Add New RETC Facilitator',
    manageDescription: 'Manage RETC facilitators and their professional profiles',
    leadOnCourse: 'Lead RETC Facilitator',
    leadOnCourseNone: 'No lead RETC facilitator',
    filterAll: 'All RETC facilitators',
    reportFilterLabel: 'RETC Facilitator',
    /** Shorter label on trainees list (lead facilitator for enrolled course). */
    traineesTrainerLabel: 'Trainer',
};

/** @deprecated Use RETC_FACILITATOR_LABELS */
export const RETC_PARTNER_LABELS = RETC_FACILITATOR_LABELS;

export function getRetcFacilitatorRoleLabel(role) {
    const key = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (key === 'senior_trainer')
        return 'Senior RETC Facilitator';
    if (key === 'trainer')
        return 'RETC Facilitator';
    if (!key)
        return '-';
    return String(role).replace(/_/g, ' ');
}

/** @deprecated Use getRetcFacilitatorRoleLabel */
export const getRetcPartnerRoleLabel = getRetcFacilitatorRoleLabel;
