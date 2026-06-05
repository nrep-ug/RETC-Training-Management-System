'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments } from '@/lib/fetch-all-documents';
import { ProgramStatus } from '@/lib/types';
import { getCourseKeyFromProgram, getCourseLabel } from '@/lib/renewable-energy-courses';
import { buildProgramPartnerMapFromRows } from '@/lib/program-partner-sync';
import { buildFacilityCalendarEvents, getStatusLegendDotClass } from '@/lib/facility-calendar';
import {
    clampDayToMonth,
    dateFromParts,
    eventsInYear,
    getYearRangeFromEvents,
} from '@/lib/facility-calendar-nav';
import { FacilityCalendarMonth } from '@/components/facility-calendar-month';
import { FacilityCalendarDay } from '@/components/facility-calendar-day';
import { FacilityCalendarYear } from '@/components/facility-calendar-year';
import { FacilityCalendarToolbar } from '@/components/facility-calendar-toolbar';
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
    const now = new Date();
    const [programs, setPrograms] = useState([]);
    const [partners, setPartners] = useState([]);
    const [programPartnerMap, setProgramPartnerMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedDay, setSelectedDay] = useState(now.getDate());
    const [viewMode, setViewMode] = useState('month');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedEvent, setSelectedEvent] = useState(null);

    const monthDate = useMemo(
        () => dateFromParts(selectedYear, selectedMonth, 1),
        [selectedYear, selectedMonth],
    );
    const dayDate = useMemo(
        () => dateFromParts(selectedYear, selectedMonth, clampDayToMonth(selectedYear, selectedMonth, selectedDay)),
        [selectedYear, selectedMonth, selectedDay],
    );

    const loadData = async () => {
        try {
            setIsLoading(true);
            if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
                throw new Error('Courses collection is not configured.');
            }
            const [programDocs, partnerDocs] = await Promise.all([
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAMS),
                COLLECTIONS.PARTNERS
                    ? fetchAllDocuments(databases, DB_ID, COLLECTIONS.PARTNERS)
                    : Promise.resolve([]),
            ]);
            const normalized = programDocs.map(normalizeProgramDoc);
            setPrograms(normalized);
            setPartners(partnerDocs);

            if (COLLECTIONS.PROGRAM_PARTNERS) {
                const ids = normalized.map((p) => p.$id).filter(Boolean);
                const rows = await fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAM_PARTNERS);
                setProgramPartnerMap(
                    buildProgramPartnerMapFromRows(rows, ids, normalized, partnerDocs),
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

    const allCalendarEvents = useMemo(
        () => buildFacilityCalendarEvents(programsWithPartners, partnerMap, { statusFilter }),
        [programsWithPartners, partnerMap, statusFilter],
    );

    const yearEvents = useMemo(
        () => eventsInYear(allCalendarEvents, selectedYear),
        [allCalendarEvents, selectedYear],
    );

    const yearOptions = useMemo(
        () => getYearRangeFromEvents(allCalendarEvents),
        [allCalendarEvents],
    );

    const overlapCount = useMemo(
        () => yearEvents.filter((e) => e.hasOverlap).length,
        [yearEvents],
    );

    const legend = (
        <>
            <LegendPill color={getStatusLegendDotClass('upcoming')} label="Upcoming" />
            <LegendPill color={getStatusLegendDotClass('ongoing')} label="Ongoing" />
            <LegendPill color={getStatusLegendDotClass('completed')} label="Completed" />
            {overlapCount > 0 && (
                <span className="text-red-600">
                    {overlapCount} overlap{overlapCount === 1 ? '' : 's'}
                </span>
            )}
        </>
    );

    const goToday = () => {
        const t = new Date();
        setSelectedYear(t.getFullYear());
        setSelectedMonth(t.getMonth());
        setSelectedDay(t.getDate());
    };

    const handleYearChange = (year) => {
        setSelectedYear(year);
        setSelectedDay((d) => clampDayToMonth(year, selectedMonth, d));
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        setSelectedDay((d) => clampDayToMonth(selectedYear, month, d));
    };

    const handlePrev = () => {
        if (viewMode === 'year') {
            setSelectedYear((y) => y - 1);
            return;
        }
        if (viewMode === 'day') {
            if (selectedDay > 1) {
                setSelectedDay((d) => d - 1);
                return;
            }
            if (selectedMonth > 0) {
                const prevMonth = selectedMonth - 1;
                const last = new Date(selectedYear, prevMonth + 1, 0).getDate();
                setSelectedMonth(prevMonth);
                setSelectedDay(last);
                return;
            }
            return;
        }
        if (selectedMonth > 0) {
            setSelectedMonth((m) => m - 1);
        }
    };

    const handleNext = () => {
        if (viewMode === 'year') {
            setSelectedYear((y) => y + 1);
            return;
        }
        if (viewMode === 'day') {
            const last = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            if (selectedDay < last) {
                setSelectedDay((d) => d + 1);
                return;
            }
            if (selectedMonth < 11) {
                setSelectedMonth((m) => m + 1);
                setSelectedDay(1);
                return;
            }
            return;
        }
        if (selectedMonth < 11) {
            setSelectedMonth((m) => m + 1);
        }
    };

    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const canGoPrev = viewMode === 'year'
        ? true
        : viewMode === 'month'
            ? selectedMonth > 0
            : selectedMonth > 0 || selectedDay > 1;
    const canGoNext = viewMode === 'year'
        ? true
        : viewMode === 'month'
            ? selectedMonth < 11
            : selectedMonth < 11 || selectedDay < lastDayOfMonth;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#047857] to-[#0b8d68] text-white shadow-md">
                        <CalendarDays className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Facility calendar</h1>
                        <p className="text-sm text-slate-500">Pick a year, then browse months and courses</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <Button asChild size="sm" className="bg-[#047857] hover:bg-[#065f46]">
                            <Link href="/dashboard/programs?book=1">
                                <Plus className="mr-1.5 h-4 w-4" />
                                {FACILITY_CALENDAR_LABELS.bookFacilityButton}
                            </Link>
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={loadData}>
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <FacilityCalendarToolbar
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                selectedDay={selectedDay}
                viewMode={viewMode}
                statusFilter={statusFilter}
                yearOptions={yearOptions}
                bookingCount={yearEvents.length}
                onYearChange={handleYearChange}
                onMonthChange={handleMonthChange}
                onViewModeChange={setViewMode}
                onStatusFilterChange={setStatusFilter}
                onToday={goToday}
                onPrev={handlePrev}
                onNext={handleNext}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
            />

            {isLoading ? (
                <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    Loading calendar…
                </div>
            ) : (
                <>
                    {viewMode === 'month' && (
                        <FacilityCalendarMonth
                            monthDate={monthDate}
                            events={yearEvents}
                            onSelectEvent={setSelectedEvent}
                            onSelectDay={(d) => {
                                setSelectedMonth(d.getMonth());
                                setSelectedDay(d.getDate());
                                setViewMode('day');
                            }}
                            legend={legend}
                            hideNavigation
                        />
                    )}
                    {viewMode === 'day' && (
                        <FacilityCalendarDay
                            dayDate={dayDate}
                            events={yearEvents}
                            onSelectEvent={setSelectedEvent}
                            hideNavigation
                        />
                    )}
                    {viewMode === 'year' && (
                        <FacilityCalendarYear
                            selectedYear={selectedYear}
                            events={yearEvents}
                            onSelectMonth={(d) => {
                                setSelectedMonth(d.getMonth());
                                setSelectedDay(1);
                                setViewMode('month');
                            }}
                            hideNavigation
                        />
                    )}
                </>
            )}

            <FacilityCalendarEventDialog
                event={selectedEvent}
                open={!!selectedEvent}
                onOpenChange={(open) => !open && setSelectedEvent(null)}
                isAdmin={isAdmin}
            />
        </div>
    );
}
