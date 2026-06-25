'use client';

import { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StudyTripSiteDialog } from '@/components/study-trip-site-dialog';
import { StudyTripSiteTable } from '@/components/study-trip-site-table';
import { STUDY_TRIP_SITE_LABELS } from '@/lib/study-trip-site-labels';
import {
    buildStudyTripSiteWritePayload,
    getStudyTripSiteContactPerson,
    getStudyTripSiteLocation,
    getStudyTripSiteName,
} from '@/lib/study-trip-site-fields';

function documentStableId(doc) {
    if (!doc)
        return '';
    return String(doc.$id ?? doc.documentId ?? doc.id ?? '').trim();
}

async function assertNoStudyTripSiteDuplicates(payload, { excludeId = '', localSites = [] } = {}) {
    if (!databases || !DB_ID || !COLLECTIONS.STUDY_TRIP_SITES)
        return;

    const siteTrim = String(payload.site || '').trim();
    const siteLower = siteTrim.toLowerCase();
    const emailLower = String(payload.email || '').trim().toLowerCase();

    const tryEqual = async (attr, value) => {
        if (!value)
            return null;
        try {
            const res = await databases.listDocuments(DB_ID, COLLECTIONS.STUDY_TRIP_SITES, [
                Query.equal(attr, value),
                Query.limit(10),
            ]);
            return res.documents.find((d) => documentStableId(d) !== excludeId) || null;
        }
        catch {
            return null;
        }
    };

    for (const row of localSites) {
        if (!row || documentStableId(row) === excludeId)
            continue;
        if (siteLower && getStudyTripSiteName(row).toLowerCase() === siteLower) {
            throw new Error(`A site named "${getStudyTripSiteName(row) || siteTrim}" already exists.`);
        }
        if (emailLower && String(row.email || '').trim().toLowerCase() === emailLower) {
            throw new Error(`The email ${emailLower} is already used by "${getStudyTripSiteName(row) || 'another site'}".`);
        }
    }

    if (siteTrim) {
        const dupSite = await tryEqual('site', siteTrim);
        if (dupSite && documentStableId(dupSite) !== excludeId)
            throw new Error(`A site named "${dupSite.site || siteTrim}" already exists.`);
    }
    if (emailLower) {
        const dupEmail = await tryEqual('email', emailLower);
        if (dupEmail && documentStableId(dupEmail) !== excludeId)
            throw new Error(`The email ${emailLower} is already used by "${dupEmail.site || 'another site'}".`);
    }
}

function formatStudyTripSiteSaveError(error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (/duplicate|unique|already exists|409/i.test(raw))
        return 'A site with this name or email already exists (database unique rule).';
    return raw;
}

export default function StudyTripSitesPage() {
    const { isAdmin } = useAuth();
    const [sites, setSites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedSite, setSelectedSite] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [filters, setFilters] = useState({
        query: '',
        technology: 'all',
    });

    const fetchSites = async () => {
        try {
            setIsLoading(true);
            if (!COLLECTIONS.STUDY_TRIP_SITES) {
                throw new Error('Study trip sites collection is not configured. Set NEXT_PUBLIC_APPWRITE_STUDYTRIP_SITES_COLLECTION_ID.');
            }
            const documents = await fetchAllDocuments(databases, DB_ID, COLLECTIONS.STUDY_TRIP_SITES);
            setSites(documents);
        }
        catch (error) {
            toast({
                title: 'Unable to load study trip sites',
                description: error instanceof Error ? error.message : 'Could not fetch sites.',
                variant: 'destructive',
            });
            setSites([]);
        }
        finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const handleSaveSite = async (data) => {
        try {
            const excludeSiteId = documentStableId(selectedSite);
            const payload = buildStudyTripSiteWritePayload(data);
            await assertNoStudyTripSiteDuplicates(payload, { excludeId: excludeSiteId, localSites: sites });

            if (selectedSite) {
                const updateId = String(selectedSite.$id || selectedSite.documentId || excludeSiteId).trim();
                await databases.updateDocument(DB_ID, COLLECTIONS.STUDY_TRIP_SITES, updateId, payload);
                setSites((prev) => prev.map((s) => (documentStableId(s) === excludeSiteId ? { ...s, ...payload } : s)));
            }
            else {
                const response = await databases.createDocument(DB_ID, COLLECTIONS.STUDY_TRIP_SITES, 'unique()', payload);
                setSites((prev) => [...prev, response]);
            }

            setShowDialog(false);
            setSelectedSite(null);
            toast({
                title: selectedSite ? 'Site updated' : 'Site added',
                description: selectedSite ? 'Study trip site changes were saved.' : 'Study trip site created successfully.',
            });
        }
        catch (error) {
            toast({
                title: 'Save failed',
                description: formatStudyTripSiteSaveError(error),
                variant: 'destructive',
            });
            throw error;
        }
    };

    const confirmDeleteSite = async () => {
        if (!pendingDeleteId)
            return;
        try {
            await databases.deleteDocument(DB_ID, COLLECTIONS.STUDY_TRIP_SITES, pendingDeleteId);
            setSites((prev) => prev.filter((s) => s.$id !== pendingDeleteId));
            toast({
                title: 'Site deleted',
                description: 'The study trip site was removed successfully.',
            });
        }
        catch (error) {
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Could not delete site.',
                variant: 'destructive',
            });
        }
        finally {
            setPendingDeleteId('');
        }
    };

    const technologyFilterOptions = useMemo(() => {
        const values = new Set();
        sites.forEach((row) => {
            const tech = String(row.technology || '').trim();
            if (tech)
                values.add(tech);
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }, [sites]);

    const filteredSites = useMemo(() => {
        return sites.filter((row) => {
            const q = filters.query.trim().toLowerCase();
            const matchesQuery = !q
                || getStudyTripSiteName(row).toLowerCase().includes(q)
                || getStudyTripSiteLocation(row).toLowerCase().includes(q)
                || String(row.technology || '').toLowerCase().includes(q)
                || String(row.type || '').toLowerCase().includes(q)
                || getStudyTripSiteContactPerson(row).toLowerCase().includes(q)
                || String(row.email || '').toLowerCase().includes(q);
            const matchesTechnology = filters.technology === 'all'
                || String(row.technology || '') === filters.technology;
            return matchesQuery && matchesTechnology;
        });
    }, [sites, filters]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">{STUDY_TRIP_SITE_LABELS.moduleTitle}</h1>
                    <p className="mt-2 text-gray-600">{STUDY_TRIP_SITE_LABELS.manageDescription}.</p>
                </div>
                {isAdmin && (
                    <Button
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() => {
                            setSelectedSite(null);
                            setShowDialog(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {STUDY_TRIP_SITE_LABELS.addButton}
                    </Button>
                )}
            </div>

            <Card className="mb-6 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                        <Label>Search</Label>
                        <Input
                            placeholder="Search by site name, location, technology, type, contact, email..."
                            value={filters.query}
                            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Technology</Label>
                        <Select value={filters.technology} onValueChange={(value) => setFilters((prev) => ({ ...prev, technology: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All technologies</SelectItem>
                                {technologyFilterOptions.map((tech) => (
                                    <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            <Card>
                <StudyTripSiteTable
                    sites={filteredSites}
                    isLoading={isLoading}
                    isAdmin={isAdmin}
                    paginationResetKey={JSON.stringify(filters)}
                    onEdit={isAdmin ? (site) => {
                        setSelectedSite(site);
                        setShowDialog(true);
                    } : undefined}
                    onDelete={isAdmin ? (id) => setPendingDeleteId(id) : undefined}
                />
            </Card>

            {isAdmin && (
                <StudyTripSiteDialog
                    open={showDialog}
                    onOpenChange={setShowDialog}
                    site={selectedSite}
                    onSave={handleSaveSite}
                />
            )}

            <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(''); }}>
                <AlertDialogContent className="border-[#047857]/25">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete study trip site?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The site record will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-[#ff8829] text-[#b45309] hover:bg-[#fff4eb] hover:text-[#9a3f05]">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteSite}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
