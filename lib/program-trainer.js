/** Resolve lead facilitator (trainer) on a course/program document. */
export function getTrainerIdFromProgram(program) {
    if (!program)
        return '';
    const v = program.trainer_id
        || program.trainerId
        || program.lead_trainer_id
        || program.leadTrainerId
        || program.trainer;
    if (v && typeof v === 'object')
        return String(v.$id || v.documentId || v.id || '').trim();
    return String(v || '').trim();
}

export function resolveTrainerDisplayName(program, trainerById = {}) {
    if (!program)
        return '';
    const embedded = program.trainer && typeof program.trainer === 'object'
        ? (program.trainer.name || program.trainer.email || '')
        : (program.trainer_name || program.trainerName || '');
    if (String(embedded).trim())
        return String(embedded).trim();
    const tid = getTrainerIdFromProgram(program);
    return tid ? String(trainerById[tid] || '').trim() : '';
}

export function buildTrainerNameById(trainerDocs) {
    const map = {};
    (trainerDocs || []).forEach((t) => {
        const id = String(t.$id || t.documentId || t.id || '').trim();
        if (id)
            map[id] = t.name || t.email || id;
    });
    return map;
}
