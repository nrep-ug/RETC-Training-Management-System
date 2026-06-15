import {
    getEnrollmentProgramId,
    getEnrollmentTraineeId,
} from '@/lib/trainee-enrollment';
import { normalizeTraineeLevelKey } from '@/lib/trainee-levels';

function enrollmentPairKey(traineeId, programId) {
    return `${String(traineeId || '').trim()}::${String(programId || '').trim()}`;
}

function isUnknownEnrollmentLevelAttributeError(message) {
    const msg = String(message || '');
    return /Unknown attribute:\s*["'](trainee_level|traineeLevel|level|participant_level)["']/i.test(msg);
}

export function buildEnrollmentPayloadCandidates(traineeId, programId, status, traineeLevel = '') {
    const tid = String(traineeId || '').trim();
    const pid = String(programId || '').trim();
    const st = String(status || 'enrolled').trim();
    const level = normalizeTraineeLevelKey(traineeLevel);
    const cores = [
        { trainee_id: tid, program_id: pid, status: st },
        { traineeId: tid, programId: pid, status: st },
        { trainee: tid, program: pid, status: st },
    ];
    const candidates = [];
    cores.forEach((core) => {
        if (level) {
            candidates.push({ ...core, trainee_level: level });
            candidates.push({ ...core, traineeLevel: level });
            candidates.push({ ...core, level });
        }
        candidates.push(core);
    });
    return candidates;
}

async function writeEnrollmentDocument(writeFn, payloads) {
    let sawUnknownLevel = false;
    for (let i = 0; i < payloads.length; i++) {
        try {
            return await writeFn(payloads[i]);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (isUnknownEnrollmentLevelAttributeError(msg)) {
                sawUnknownLevel = true;
                continue;
            }
            if (i === payloads.length - 1)
                throw error;
        }
    }
    if (sawUnknownLevel) {
        throw new Error('Participant level was not saved on the enrollment. In Appwrite → enrollments collection → Attributes, add Enum `trainee_level` (or `level`) with values `beginner`, `technician`, and `trainer`, then save again.');
    }
    throw new Error('Failed to save enrollment.');
}

async function createEnrollmentDocument(databases, dbId, collectionId, traineeId, programId, status, traineeLevel) {
    const payloads = buildEnrollmentPayloadCandidates(traineeId, programId, status, traineeLevel);
    return writeEnrollmentDocument(
        (payload) => databases.createDocument(dbId, collectionId, 'unique()', payload),
        payloads,
    );
}

async function updateEnrollmentDocument(databases, dbId, collectionId, enrollmentId, traineeId, programId, status, traineeLevel) {
    const payloads = buildEnrollmentPayloadCandidates(traineeId, programId, status, traineeLevel);
    return writeEnrollmentDocument(
        (payload) => databases.updateDocument(dbId, collectionId, enrollmentId, payload),
        payloads,
    );
}

/** Find enrollment row for trainee + course pair. */
export function findEnrollmentRow(rows, traineeId, programId) {
    const key = enrollmentPairKey(traineeId, programId);
    return (rows || []).find((row) => enrollmentPairKey(getEnrollmentTraineeId(row), getEnrollmentProgramId(row)) === key) || null;
}

/** Create or update one enrollment (trainee + course + status + level). */
export async function upsertTraineeEnrollment(
    databases,
    dbId,
    collectionId,
    traineeId,
    programId,
    status,
    traineeLevel = '',
    existingRows = [],
) {
    if (!databases || !dbId || !collectionId || !traineeId || !programId)
        return null;
    const pid = String(programId).trim();
    const tid = String(traineeId).trim();
    const level = normalizeTraineeLevelKey(traineeLevel);
    const relevant = (existingRows || []).filter((row) => getEnrollmentTraineeId(row) === tid);
    const existing = findEnrollmentRow(relevant, tid, pid);
    if (existing?.$id) {
        return updateEnrollmentDocument(databases, dbId, collectionId, existing.$id, tid, pid, status, level);
    }
    return createEnrollmentDocument(databases, dbId, collectionId, tid, pid, status, level);
}

/** Delete one trainee + course enrollment row. */
export async function deleteEnrollmentForTraineeProgram(databases, dbId, collectionId, traineeId, programId, allEnrollmentRows) {
    if (!databases || !dbId || !collectionId || !traineeId || !programId)
        return false;
    const row = findEnrollmentRow(allEnrollmentRows, traineeId, programId);
    if (!row?.$id)
        return false;
    await databases.deleteDocument(dbId, collectionId, row.$id);
    return true;
}

/** Delete all enrollment rows for a trainee. */
export async function deleteEnrollmentsForTrainee(databases, dbId, collectionId, traineeId, allEnrollmentRows) {
    if (!databases || !dbId || !collectionId || !traineeId)
        return;
    const tid = String(traineeId).trim();
    const rows = (allEnrollmentRows || []).filter((row) => getEnrollmentTraineeId(row) === tid);
    for (const row of rows) {
        if (row?.$id) {
            await databases.deleteDocument(dbId, collectionId, row.$id);
        }
    }
}

/** Whether trainee is already on this course (enrollment or legacy program_id). */
export function traineeAlreadyOnProgram(trainee, programId, enrollmentRows = []) {
    const pid = String(programId || '').trim();
    if (!pid || !trainee)
        return false;
    const tid = String(trainee.$id || trainee.documentId || '').trim();
    if (findEnrollmentRow(enrollmentRows, tid, pid))
        return true;
    const legacy = String(trainee.program_id || trainee.programId || '').trim();
    return legacy === pid;
}
