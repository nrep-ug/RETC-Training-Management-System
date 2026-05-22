'use client';

import { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { ProgramStatus } from '@/lib/types';
import { getCourseKeyFromProgram, getCourseLabel } from '@/lib/renewable-energy-courses';
import { buildProgramPartnerMapFromRows } from '@/lib/program-partner-sync';
import { buildFacilityCalendarEvents } from '@/lib/facility-calendar';
import { FacilityCalendarMonth } from '@/components/facility-calendar-month';
import { FacilityCalendarEventDialog } from '@/components/facility-calendar-event-dialog';
import { CalendarDays, Plus, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FACILITY_CALENDAR_LABELS } from '@/lib/facility-calendar-labels';
import { toast } from '@/hooks/use-toast';

function normalizeProgramDoc(program) {
    const createdFallback = program.$createdAt ? new Date(program.$createdAt).toISOString() : '';
    const endFallback = createdFallback
        ? new Date(new Date(createdFallback).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : '';
    return {
        ...program,
        training_partner:
            program.training_partner
            || program.trainingPartner
            || program['training-partners']
            || program.training_partners
            || '',
        training_location:
            program.training_location
            || program.trainingLocation
            || program.location
            || program.venue
            || '',
        training_partner_id:
            program.training_partner_id
            || program.trainingPartnerId
            || (typeof program['training-partners'] === 'object'
                ? program['training-partners'].$id
                    || program['training-partners'].documentId
                    || program['training-partners'].id
                    || ''
                : ''),
        partner_ids: Array.isArray(program.partner_ids) ? program.partner_ids : [],
        start_date:
            program.start_date
            || program.startDate
            || program['start-date']
            || createdFallback,
        end_date:
            program.end_date
            || program.endDate
            || program['end-date']
            || program['end-time']
            || endFallback,
        status: String(program.status || ProgramStatus.UPCOMING).toLowerCase(),
        course: getCourseKeyFromProgram(program),
        course_label: getCourseLabel(getCourseKeyFromProgram(program)),
    };
}

async function fetchAllCollectionDocuments(collectionId, { maxDocs = 50000, pageSize = 250 } = {}) {
    if (!databases || !DB_ID || !collectionId)
        return [];
    const out = [];
    let cursor = null;
    while (out.length < maxDocs) {
        const queries = [Query.limit(pageSize), Query.orderAsc('$id')];
        if (cursor)
            queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DB_ID, collectionId, queries, undefined, true);
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

function LegendPill({ color, label }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
            {label}
        </span>
    );
}

export default function FacilityCalendarPage() {
    const { isAdmin } = useAuth();
    const [programs, setPrograms] = useState([]);
    const [partners, setPartners] = useState([]);
    const [programPartnerMap, setProgramPartnerMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [monthDate, setMonthDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedEvent, setSelectedEvent] = useState(null);

    const loadData = async () => {
        try {
            setIsLoading(true);
            if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
                throw new Error('Courses collection is not configured.');
            }
            const [programRes, partnerRes] = await Promise.all([
                databases.listDocuments(DB_ID, COLLECTIONS.PROGRAMS),
                COLLECTIONS.PARTNERS
                    ? databases.listDocuments(DB_ID, COLLECTIONS.PARTNERS)
                    : Promise.resolve({ documents: [] }),
            ]);
            const normalized = (programRes.documents || []).map(normalizeProgramDoc);
            setPrograms(normalized);
            setPartners(partnerRes.documents || []);

            if (COLLECTIONS.PROGRAM_PARTNERS) {
                const ids = normalized.map((p) => p.$id).filter(Boolean);
                const rows = await fetchAllCollectionDocuments(COLLECTIONS.PROGRAM_PARTNERS);
                setProgramPartnerMap(
                    buildProgramPartnerMapFromRows(rows, ids, normalized, partnerRes.documents || []),
                );
            }
            else {
                setProgramPartnerMap({});
            }
        }
        catch (error) {
            console.error('Facility calendar load error:', error);
            toast({
                title: 'Unable to load calendar',
                description: error instanceof Error ? error.message : 'Please try again.',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const partnerMap = useMemo(() => {
        const map = {};
        partners.forEach((p) => {
            if (p.$id)
                map[p.$id] = String(p.name || p.email || p.$id).trim();
        });
        return map;
    }, [partners]);

    const programsWithPartners = useMemo(() => {
        return programs.map((p) => {
            const m = programPartnerMap[p.$id] || {};
            return {
                ...p,
                ...m,
                partner_names: Array.isArray(m.partner_names) ? m.partner_names : [],
                partner_ids: Array.isArray(m.partner_ids)
                    ? m.partner_ids
                    : Array.isArray(p.partner_ids)
                        ? p.partner_ids
                        : [],
            };
        });
    }, [programs, programPartnerMap]);

    const calendarEvents = useMemo(() => {
        return buildFacilityCalendarEvents(programsWithPartners, partnerMap, { hidePast: true });
    }, [programsWithPartners, partnerMap]);

    const overlapCount = useMemo(
        () => calendarEvents.filter((e) => e.hasOverlap).length,
        [calendarEvents],
    );

    const legend = (
        <>
            <LegendPill color="bg-[#047857]" label="Upcoming" />
            <LegendPill color="bg-[#ff8829]" label="Ongoing" />
            {overlapCount > 0 && (
                <span className="text-red-600">
                    {overlapCount} overlap{overlapCount === 1 ? '' : 's'}
                </span>
            )}
            <span className="ml-auto text-slate-500">
                {calendarEvents.length} booking{calendarEvents.length === 1 ? '' : 's'}
            </span>
        </>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#047857] to-[#0b8d68] text-white shadow-md">
                        <CalendarDays className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Facility calendar
                        </h1>
                        <p className="text-sm text-slate-500">
                            {isAdmin
                                ? 'View bookings · add or edit dates on Courses'
                                : 'View-only · dates managed on Courses'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <Button
                            asChild
                            size="sm"
                            className="bg-[#047857] hover:bg-[#065f46]"
                            title="Set start date and training weeks on Courses"
                        >
                            <Link href="/dashboard/programs?book=1">
                                <Plus className="mr-1.5 h-4 w-4" />
                                {FACILITY_CALENDAR_LABELS.bookFacilityButton}
                            </Link>
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => loadData()}
                    >
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="h-16 bg-gradient-to-r from-[#047857]/30 to-[#ff8829]/30" />
                    <div className="grid grid-cols-7 gap-px p-3">
                        {Array.from({ length: 35 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-md bg-slate-100" />
                        ))}
                    </div>
                </div>
            ) : (
                <FacilityCalendarMonth
                    monthDate={monthDate}
                    events={calendarEvents}
                    onMonthChange={setMonthDate}
                    onSelectEvent={setSelectedEvent}
                    legend={legend}
                />
            )}

            <FacilityCalendarEventDialog
                event={selectedEvent}
                open={!!selectedEvent}
                onOpenChange={(open) => {
                    if (!open)
                        setSelectedEvent(null);
                }}
                isAdmin={isAdmin}
            />
        </div>
    );
}
