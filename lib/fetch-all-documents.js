import { Query } from 'appwrite';

/**
 * Load every document in an Appwrite collection.
 * Appwrite's listDocuments default limit is 25 — always paginate for full lists.
 */
export async function fetchAllDocuments(databases, databaseId, collectionId, {
    maxDocs = 100000,
    pageSize = 250,
    extraQueries = [],
} = {}) {
    if (!databases || !databaseId || !collectionId)
        return [];

    const list = (queries) => databases.listDocuments(databaseId, collectionId, queries, undefined, true);
    let lastError = null;

    // Offset pagination (works without a $id index).
    try {
        const out = [];
        let sawSuccessfulResponse = false;
        for (let offset = 0; offset < maxDocs; offset += pageSize) {
            const queries = [...extraQueries, Query.limit(pageSize), Query.offset(offset)];
            const res = await list(queries);
            sawSuccessfulResponse = true;
            const batch = res.documents || [];
            if (!batch.length)
                break;
            out.push(...batch);
            if (batch.length < pageSize)
                break;
            if (typeof res.total === 'number' && out.length >= res.total)
                break;
        }
        if (out.length > 0)
            return out;
        if (sawSuccessfulResponse)
            return out;
    }
    catch (error) {
        lastError = error;
    }

    try {
        const out = [];
        let cursor = null;
        while (out.length < maxDocs) {
            const queries = [...extraQueries, Query.limit(pageSize), Query.orderAsc('$id')];
            if (cursor)
                queries.push(Query.cursorAfter(cursor));
            const res = await list(queries);
            const batch = res.documents || [];
            if (!batch.length)
                break;
            out.push(...batch);
            if (batch.length < pageSize)
                break;
            if (typeof res.total === 'number' && out.length >= res.total)
                break;
            cursor = batch[batch.length - 1].$id;
        }
        return out;
    }
    catch (error) {
        lastError = error;
    }

    if (lastError)
        throw lastError;
    return [];
}

/** True when Appwrite reports documents exist but a full list came back empty. */
export async function collectionAppearsNonEmpty(databases, databaseId, collectionId) {
    if (!databases || !databaseId || !collectionId)
        return false;
    try {
        const res = await databases.listDocuments(databaseId, collectionId, [Query.limit(1)], undefined, true);
        if (typeof res.total === 'number')
            return res.total > 0;
        return (res.documents || []).length > 0;
    }
    catch {
        return false;
    }
}

/** Load a collection; on failure return [] so optional collections do not break the page. */
export async function fetchCollectionOrEmpty(databases, databaseId, collectionId, options = {}) {
    if (!databases || !databaseId || !collectionId)
        return [];
    try {
        return await fetchAllDocuments(databases, databaseId, collectionId, options);
    }
    catch (error) {
        console.warn(`[fetch] Collection "${collectionId}" could not be loaded:`, error);
        return [];
    }
}
