import { ID, Permission, Role } from 'appwrite';
import { storage, BUCKETS, account } from '@/lib/appwrite';

export function getTrainerCvFileId(trainer) {
    return String(trainer?.cv_file_id ?? trainer?.cvFileId ?? '').trim();
}

export function getTrainerCvFileName(trainer) {
    return String(trainer?.cv_file_name ?? trainer?.cvFileName ?? '').trim();
}

export function assertFacilitatorCvFile(file) {
    if (!file)
        throw new Error('CV file is required.');
}

export function getFacilitatorDocumentViewUrl(fileId) {
    const id = String(fileId || '').trim();
    const bucketId = BUCKETS.FACILITATOR_DOCUMENTS;
    if (!id || !bucketId || !storage)
        return '';
    return storage.getFileView({ bucketId, fileId: id });
}

export function getFacilitatorDocumentDownloadUrl(fileId) {
    const id = String(fileId || '').trim();
    const bucketId = BUCKETS.FACILITATOR_DOCUMENTS;
    if (!id || !bucketId || !storage)
        return '';
    return storage.getFileDownload({ bucketId, fileId: id });
}

async function facilitatorDocumentUrlWithAuth(buildUrl) {
    if (!storage || !BUCKETS.FACILITATOR_DOCUMENTS) {
        throw new Error('Facilitator documents storage is not configured.');
    }
    if (!account) {
        throw new Error('You must be signed in to access facilitator documents.');
    }
    const { jwt } = await account.createJWT();
    return buildUrl(jwt);
}

/** Authenticated view URL (works with file security enabled). */
export async function fetchFacilitatorDocumentViewUrl(fileId) {
    const id = String(fileId || '').trim();
    if (!id)
        throw new Error('CV file is missing.');
    const bucketId = BUCKETS.FACILITATOR_DOCUMENTS;
    return facilitatorDocumentUrlWithAuth((jwt) => storage.getFileView({ bucketId, fileId: id, token: jwt }));
}

/** Authenticated download URL (works with file security enabled). */
export async function fetchFacilitatorDocumentDownloadUrl(fileId) {
    const id = String(fileId || '').trim();
    if (!id)
        throw new Error('CV file is missing.');
    const bucketId = BUCKETS.FACILITATOR_DOCUMENTS;
    return facilitatorDocumentUrlWithAuth((jwt) => storage.getFileDownload({ bucketId, fileId: id, token: jwt }));
}

export async function openFacilitatorDocument(fileId) {
    const url = await fetchFacilitatorDocumentViewUrl(fileId);
    window.open(url, '_blank', 'noopener,noreferrer');
}

export async function downloadFacilitatorDocument(fileId, fileName = 'CV') {
    const url = await fetchFacilitatorDocumentDownloadUrl(fileId);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'CV';
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

export async function uploadFacilitatorCv(file) {
    if (!storage || !BUCKETS.FACILITATOR_DOCUMENTS) {
        throw new Error('Facilitator documents storage is not configured. Set NEXT_PUBLIC_APPWRITE_FACILITATOR_DOCUMENTS_BUCKET_ID.');
    }
    assertFacilitatorCvFile(file);
    return storage.createFile(BUCKETS.FACILITATOR_DOCUMENTS, ID.unique(), file, [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
    ]);
}

export async function deleteFacilitatorCv(fileId) {
    const id = String(fileId || '').trim();
    if (!id || !storage || !BUCKETS.FACILITATOR_DOCUMENTS)
        return;
    try {
        await storage.deleteFile(BUCKETS.FACILITATOR_DOCUMENTS, id);
    }
    catch {
        // File may already be removed.
    }
}

/** Upload or replace CV; returns Appwrite trainer document fields. */
export async function syncFacilitatorCvOnSave({
    existingTrainer = null,
    isEdit = false,
    cvFile = null,
    cvFileId = '',
    cvFileName = '',
    removeCv = false,
} = {}) {
    const out = {};
    const existingCvId = getTrainerCvFileId(existingTrainer);

    if (removeCv) {
        if (existingCvId)
            await deleteFacilitatorCv(existingCvId);
        if (isEdit) {
            out.cv_file_id = null;
            out.cv_file_name = null;
        }
        throw new Error('CV is required.');
    }

    if (cvFile) {
        if (existingCvId)
            await deleteFacilitatorCv(existingCvId);
        const uploaded = await uploadFacilitatorCv(cvFile);
        out.cv_file_id = uploaded.$id;
        out.cv_file_name = cvFile.name;
        return out;
    }

    if (cvFileId) {
        out.cv_file_id = cvFileId;
        out.cv_file_name = cvFileName || getTrainerCvFileName(existingTrainer) || 'CV';
        return out;
    }

    if (existingCvId && isEdit) {
        out.cv_file_id = existingCvId;
        out.cv_file_name = getTrainerCvFileName(existingTrainer) || 'CV';
        return out;
    }

    throw new Error('CV is required.');
}

export async function deleteFacilitatorCvForTrainer(trainer) {
    const cvId = getTrainerCvFileId(trainer);
    if (cvId)
        await deleteFacilitatorCv(cvId);
}

/** Remove CV from storage and return trainer fields to clear on the document. */
export async function clearFacilitatorCvFields(trainer) {
    await deleteFacilitatorCvForTrainer(trainer);
    return { cv_file_id: null, cv_file_name: null };
}
