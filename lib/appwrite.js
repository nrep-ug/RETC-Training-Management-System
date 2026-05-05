import { Client, Account, Databases, Storage } from 'appwrite';
// Check if Appwrite credentials are configured
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
let client = null;
let account = null;
let databases = null;
let storage = null;
// Initialize Appwrite Client only if credentials are available
if (APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID) {
    client = new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);
    account = new Account(client);
    databases = new Databases(client);
    storage = new Storage(client);
}
// Export services - will be null if not configured
export { account, databases, storage, client };
// Export IDs
export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
export const COLLECTIONS = {
    USERS: process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID || '',
    TRAINEES: process.env.NEXT_PUBLIC_APPWRITE_TRAINEES_COLLECTION_ID || '',
    ENROLLMENTS: process.env.NEXT_PUBLIC_APPWRITE_ENROLLMENTS_COLLECTION_ID || '',
    PARTNERS: process.env.NEXT_PUBLIC_APPWRITE_PARTNERS_COLLECTION_ID || '',
    PROGRAM_PARTNERS: process.env.NEXT_PUBLIC_APPWRITE_PROGRAM_PARTNERS_COLLECTION_ID || '',
    TRAINERS: process.env.NEXT_PUBLIC_APPWRITE_TRAINERS_COLLECTION_ID || '',
    PROGRAMS: process.env.NEXT_PUBLIC_APPWRITE_PROGRAMS_COLLECTION_ID || '',
    ANALYTICS: process.env.NEXT_PUBLIC_APPWRITE_ANALYTICS_COLLECTION_ID || '',
};
export const isAppwriteConfigured = !!(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID);
export default client;
