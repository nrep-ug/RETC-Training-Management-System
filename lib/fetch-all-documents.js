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

    // Offset pagination (works without a $id index).
    try {
        const out = [];
        for (let offset = 0; offset < maxDocs; offset += pageSize) {
            const queries = [...extraQueries, Query.limit(pageSize), Query.offset(offset)];
            const res = await list(queries);
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
    }
    catch {
        // Fall through to cursor pagination.
    }

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
