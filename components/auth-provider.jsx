'use client';
/**
 * Auth flow:
 * - Appwrite Auth proves identity (session). The `users` collection row (matched by email) supplies role and display fields.
 * - In production (NODE_ENV=production) we do not grant access without a real `users` document; see isProductionBuild branches.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { account, databases, DB_ID, COLLECTIONS, isAppwriteConfigured } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { UserRole, normalizeUserRole } from '@/lib/types';
import { devLog } from '@/lib/logger';
import { useRouter } from 'next/navigation';

/** In production, never invent users or admin access without a real `users` document. */
const isProductionBuild = process.env.NODE_ENV === 'production';

const AuthContext = createContext(undefined);
function extractFirstNameFromRecord(userRecord, fallbackName, emailFallback) {
    const explicitFirstName = userRecord?.first_name
        || userRecord?.firstName
        || userRecord?.firstname
        || userRecord?.given_name
        || userRecord?.givenName;
    if (explicitFirstName && String(explicitFirstName).trim()) {
        return String(explicitFirstName).trim();
    }
    const fullName = userRecord?.name
        || userRecord?.full_name
        || userRecord?.fullName
        || userRecord?.fullname
        || userRecord?.display_name
        || userRecord?.displayName;
    if (fullName && String(fullName).trim()) {
        return String(fullName).trim().split(/\s+/)[0];
    }
    if (fallbackName && String(fallbackName).trim()) {
        return String(fallbackName).trim().split(/\s+/)[0];
    }
    if (emailFallback) {
        return String(emailFallback).split('@')[0] || 'User';
    }
    return 'User';
}
function withDisplayName(userRecord, fallbackName, emailFallback) {
    return {
        ...userRecord,
        name: extractFirstNameFromRecord(userRecord, fallbackName, emailFallback),
    };
}
async function findUserByEmailInsensitive(email) {
    if (!databases || !DB_ID || !COLLECTIONS.USERS || !email) {
        return null;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const exact = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
        Query.equal('email', normalizedEmail),
    ]);
    if (exact.documents.length > 0) {
        return exact.documents[0];
    }
    // Fallback for databases with mixed-case emails or inconsistent old records.
    const allUsers = await fetchAllDocuments(databases, DB_ID, COLLECTIONS.USERS);
    const matches = allUsers.filter((u) => String(u?.email || '').trim().toLowerCase() === normalizedEmail);
    if (matches.length === 0) {
        return null;
    }
    // If duplicates exist for one email, prefer admin so an admin account does not downgrade on refresh.
    const adminMatch = matches.find((u) => normalizeUserRole(u?.role) === UserRole.ADMIN);
    return adminMatch || matches[0];
}
function resolveUserRole(rawRole) {
    // Prefer explicit role mapping; if missing/unknown, default to admin to avoid accidental downgrade.
    if (rawRole == null || String(rawRole).trim() === '') {
        return UserRole.ADMIN;
    }
    return normalizeUserRole(rawRole);
}
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const router = useRouter();

    /** Clear Appwrite session when production rules forbid staying logged in (no DB profile / DB error). */
    const invalidateSessionNoDbUser = async () => {
        try {
            if (account)
                await account.deleteSession('current');
        }
        catch {
            /* ignore */
        }
        setUser(null);
        setIsAuthenticated(false);
    };

    // Restore session after refresh: load `users` row by Auth email, or enforce prod rules.
    useEffect(() => {
        checkSession();
    }, []);
    const checkSession = async () => {
        try {
            // If Appwrite is not configured, skip session check
            if (!isAppwriteConfigured || !account) {
                devLog('Appwrite not configured, skipping session check');
                setIsLoading(false);
                return;
            }
            const session = await account.getSession('current');
            if (session) {
                try {
                    // Fetch user data from database
                    if (!databases) {
                        throw new Error('Database service not available');
                    }
                    const accountProfile = await account.get();
                    const accountEmail = String(accountProfile?.email || '').trim().toLowerCase();
                    const providerEmail = String(session?.providerUid || '').trim().toLowerCase();
                    const lookupEmail = accountEmail || providerEmail;
                    if (!lookupEmail) {
                        throw new Error('Could not resolve current account email for user lookup.');
                    }
                    const dbUser = await findUserByEmailInsensitive(lookupEmail);
                    if (dbUser) {
                        const normalizedUser = {
                            ...withDisplayName(dbUser, accountProfile?.name, lookupEmail),
                            role: resolveUserRole(dbUser.role),
                        };
                        setUser(normalizedUser);
                        setIsAuthenticated(true);
                    }
                    else if (isProductionBuild) {
                        // No matching users collection document — do not fabricate an admin; sign out.
                        await invalidateSessionNoDbUser();
                    }
                    else {
                        // Dev only: allow working before the users collection is fully populated.
                        const profileName = String(accountProfile?.name || '').trim();
                        const fallbackUser = {
                            $id: accountProfile?.$id || lookupEmail,
                            email: lookupEmail,
                            name: profileName || lookupEmail.split('@')[0] || 'User',
                            role: UserRole.ADMIN,
                            status: 'active',
                        };
                        setUser(fallbackUser);
                        setIsAuthenticated(true);
                    }
                }
                catch (dbError) {
                    devLog('Database not ready:', dbError);
                    if (isProductionBuild) {
                        // Permissions / network / misconfiguration: do not default to admin in production.
                        await invalidateSessionNoDbUser();
                    }
                    else {
                        try {
                            const accountProfile = await account.get();
                            const fallbackEmail = String(accountProfile?.email || '').trim().toLowerCase();
                            const fallbackName = String(accountProfile?.name || '').trim();
                            setUser({
                                $id: accountProfile?.$id || fallbackEmail || 'user',
                                email: fallbackEmail,
                                name: fallbackName || (fallbackEmail.split('@')[0] || 'User'),
                                role: UserRole.ADMIN,
                                status: 'active',
                            });
                            setIsAuthenticated(true);
                        }
                        catch (profileError) {
                            console.error('Failed to load account profile fallback:', profileError);
                            setUser(null);
                            setIsAuthenticated(false);
                        }
                    }
                }
            }
        }
        catch (error) {
            devLog('No active session or Appwrite not available');
            setUser(null);
            setIsAuthenticated(false);
        }
        finally {
            setIsLoading(false);
        }
    };
    const login = async (email, password) => {
        try {
            setIsLoading(true);
            if (!isAppwriteConfigured) {
                if (isProductionBuild) {
                    throw new Error('Application is not configured. Set Appwrite environment variables on the server.');
                }
                devLog('Appwrite not configured, using demo login (development only)');
                if (!email || !password) {
                    throw new Error('Email and password are required');
                }
                const tempUser = {
                    $id: email,
                    email,
                    name: email.split('@')[0],
                    role: UserRole.ADMIN,
                    status: 'active',
                    $createdAt: new Date().toISOString(),
                    $updatedAt: new Date().toISOString(),
                };
                setUser(tempUser);
                setIsAuthenticated(true);
                router.push('/dashboard/admin');
                return;
            }
            // Normal Appwrite login
            if (!account) {
                throw new Error('Authentication service not available. Please configure Appwrite.');
            }
            // Appwrite allows only one active session per user on this client.
            // If a stale session exists, clear it before creating a new one.
            try {
                await account.deleteSession('current');
            }
            catch (sessionError) {
                // Ignore when no active session exists.
                devLog('No existing session to clear before login');
            }
            // Create session
            await account.createEmailPasswordSession(email, password);
            try {
                // Fetch user data
                if (!databases) {
                    throw new Error('Database service not available');
                }
                    const dbUser = await findUserByEmailInsensitive(email);
                if (dbUser) {
                    const accountProfile = await account.get();
                    const userData = {
                        ...withDisplayName(dbUser, accountProfile?.name, email),
                        role: resolveUserRole(dbUser.role),
                    };
                    setUser(userData);
                    setIsAuthenticated(true);
                    // Redirect based on role
                    if (userData.role === UserRole.ADMIN) {
                        router.push('/dashboard/admin');
                    }
                    else if (userData.role === UserRole.MANAGER) {
                        router.push('/dashboard/manager');
                    }
                }
                else {
                    throw new Error('User not found in database. Please contact administrator.');
                }
            }
            catch (dbError) {
                console.error('Database error during login:', dbError);
                if (isProductionBuild) {
                    // End the session we just created; client must not continue as a synthetic user.
                    try {
                        await account.deleteSession('current');
                    }
                    catch {
                        /* ignore */
                    }
                    const msg = dbError instanceof Error ? dbError.message : String(dbError);
                    throw new Error(`Cannot verify your account: ${msg}. Ensure your email exists in the users collection and database permissions allow read access.`);
                }
                // Development: optional temp profile so you can still reach the UI while wiring the database.
                let accountName = '';
                try {
                    const accountProfile = await account.get();
                    accountName = String(accountProfile?.name || '').trim();
                }
                catch (profileError) {
                    console.error('Failed to read account profile during login fallback:', profileError);
                }
                const tempUser = {
                    $id: email,
                    email,
                    name: accountName || email.split('@')[0],
                    role: UserRole.ADMIN,
                    status: 'active',
                    $createdAt: new Date().toISOString(),
                    $updatedAt: new Date().toISOString(),
                };
                setUser(tempUser);
                setIsAuthenticated(true);
                router.push('/dashboard/admin');
            }
        }
        catch (error) {
            console.error('Login error:', error);
            let message = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
            if (typeof message === 'string' &&
                (message.includes('Creation of a session is prohibited') ||
                    message.includes('session is active'))) {
                message = 'You already have an active session. Please try again.';
            }
            throw new Error(message);
        }
        finally {
            setIsLoading(false);
        }
    };
    const logout = async () => {
        if (isLoggingOut)
            return;
        setIsLoggingOut(true);
        // Clear local auth state immediately for a snappy logout UX.
        setUser(null);
        setIsAuthenticated(false);
        try {
            if (account && isAppwriteConfigured) {
                await account.deleteSession('current');
            }
        }
        catch (error) {
            console.error('Logout error:', error);
        }
        finally {
            router.replace('/login');
            router.refresh();
            setIsLoggingOut(false);
        }
    };
    const hasRole = (roles) => {
        if (!user)
            return false;
        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role);
    };
    const value = {
        user,
        isAuthenticated,
        isLoading,
        isLoggingOut,
        login,
        logout,
        hasRole,
        isAdmin: user?.role === UserRole.ADMIN || false,
        isManager: user?.role === UserRole.MANAGER || false,
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
