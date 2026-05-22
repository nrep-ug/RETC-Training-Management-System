/** Shared enrollment → trainee program resolution (analytics, reports, trainees). */

function getEnrollmentTraineeId(doc) {
    const value = doc?.trainee_id || doc?.traineeId || doc?.trainee || '';
    if (typeof value === 'string')
        return String(value).trim();
    if (value && typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

function getEnrollmentProgramId(doc) {
    const value = doc?.program_id || doc?.programId || doc?.program || '';
    if (typeof value === 'string')
        return String(value).trim();
    if (value && typeof value === 'object')
        return String(value.$id || value.documentId || value.id || '').trim();
    return '';
}

/** Maps trainee id (several possible field shapes) → program id from enrollment rows. */
export function buildEnrollmentByTrainee(enrollmentDocs) {
    const map = {};
    (enrollmentDocs || []).forEach((e) => {
        const pid = getEnrollmentProgramId(e);
        if (!pid)
            return;
        const addKey = (raw) => {
            const k = String(raw || '').trim();
            if (k)
                map[k] = pid;
        };
        addKey(getEnrollmentTraineeId(e));
        addKey(e.trainee_id);
        addKey(e.traineeId);
        const tr = e.trainee;
        if (tr && typeof tr === 'object') {
            addKey(tr.$id);
            addKey(tr.documentId);
            addKey(tr.id);
        }
    });
    return map;
}

/** Program often lives on enrollments, not on the trainee document. */
export function mergeTraineeWithEnrollment(enrollmentByTrainee, trainee) {
    const keys = [trainee.$id, trainee.documentId, trainee.id]
        .map((k) => String(k || '').trim())
        .filter(Boolean);
    let fromEnroll = '';
    for (const k of keys) {
        if (enrollmentByTrainee[k]) {
            fromEnroll = enrollmentByTrainee[k];
            break;
        }
    }
    const mergedProgram = fromEnroll
        || trainee.program_id
        || trainee.programId
        || (trainee.program && typeof trainee.program === 'object'
            ? (trainee.program.$id || trainee.program.documentId || trainee.program.id || '')
            : '')
        || (typeof trainee.program === 'string' ? trainee.program : '');
    return { ...trainee, program_id: String(mergedProgram || '').trim() };
}
