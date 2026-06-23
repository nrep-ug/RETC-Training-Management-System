'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Query } from 'appwrite';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments, fetchCollectionOrEmpty } from '@/lib/fetch-all-documents';
import { AnalyticsFilterFields } from '@/components/analytics-filter-fields';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Download, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { buildAnalyticsReportFilename } from '@/lib/pdf-report-naming';
import { downloadPdfDocument } from '@/lib/pdf-download';
import {
    appendAnalyticsPdfFooters,
    collectAnalyticsChartExportSections,
    exportAnalyticsChartsPdf,
} from '@/lib/analytics-pdf-export';
import {
    appendGenderReportSections,
    drawPdfSectionHeading,
    estimatePdfTableHeightMm,
    reservePdfVerticalSpace,
} from '@/lib/pdf-section-table';
import {
    buildProgramByAnyId,
    getCourseFilterSelectOptions,
    getCourseKeyFromProgram,
    getCourseLabel,
    programMatchesCourseFilter,
    UNCATEGORIZED_COURSE_LABEL,
} from '@/lib/renewable-energy-courses';
import {
    buildEnrollmentListsByTrainee,
    expandTraineesByEnrollment,
    getProgramIdsFromTrainee,
    mergeTraineeWithEnrollment,
} from '@/lib/trainee-enrollment';
import { enrollmentRowMatchesScope } from '@/lib/enrollment-scope';
import { isTraineeStatusEnrolled, isTraineeStatusInProgress, normalizeTraineeStatus } from '@/lib/types';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { PARTNER_LABELS } from '@/lib/partner-labels';
import {
    buildPartnerCourseContributions,
    buildProgramPartnerAssignmentIndex,
    getTrainingPartnerIdsForProgram,
} from '@/lib/program-partner-assignments';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, LabelList } from 'recharts';
import {
    GENDER_STACK_COLORS,
    GENDER_STACK_SERIES,
    LEVEL_CHART_COLORS,
    LEVEL_STACK_SERIES,
    buildGenderByCourseCategory,
    buildGroupedSegmentsFromStackRow,
    buildLevelByCourseCategory,
    enrichDistributionWithPercent,
    filterGenderBreakdownByCategory,
    filterLevelBreakdownByCategory,
    formatCountWithPercent,
    formatPercent,
    levelByCategoryPdfRows,
    levelSummaryPdfRows,
} from '@/lib/analytics-visualization';
import {
    CHART_CERTIFICATION_COLORS,
    CHART_GENDER_COLORS,
    CHART_PROGRAM_STATUS_COLORS,
    CHART_TRAINER_ROLE_COLORS,
    RETC_GREEN,
    RETC_ORANGE,
    chartAxisProps,
    chartGridProps,
    chartPercentYAxisProps,
    chartTooltipStyle,
    colorForLabel,
    getChartSeriesColor,
} from '@/lib/chart-brand-colors';

const ANALYTICS_DEFAULT_FILTERS = {
    year: 'all',
    programId: 'all',
    course: 'all',
    gender: 'all',
    district: 'all',
    trainingPartnerId: 'all',
};

const ANALYTICS_CHART_HEIGHT = 300;

const ANALYTICS_EXPORT_FORMATS = {
    tabular: 'tabular',
    charts: 'charts',
};

function chartPercentTooltip(value, name, item) {
    const payload = item?.payload;
    const label = name || item?.name || '';
    if (!payload)
        return [String(value), label];
    const count = payload.count
        ?? payload.trainees
        ?? payload.programs
        ?? payload.value
        ?? payload.participants;
    const pct = payload.percentLabel ?? (payload.percent != null ? `${payload.percent}%` : '');
    if (count != null && pct)
        return [`${count} (${pct})`, label];
    if (pct)
        return [pct, label];
    return [String(value), label];
}

function pieSliceLabel({ name, value, percent }) {
    if (value <= 0)
        return '';
    return `${name}: ${value} (${(percent ?? 0).toFixed(1)}%)`;
}
function normalizeGender(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'male' || v === 'm')
        return 'Male';
    if (v === 'female' || v === 'f')
        return 'Female';
    return 'Other';
}
function normalizeCertificationStatus(value) {
    const v = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (v === 'certified')
        return 'Certified';
    if (v === 'not_certified' || v === 'not-certified')
        return 'Not Certified';
    return 'Pending';
}
function getProgramIdFromTrainee(trainee) {
    const value = trainee.program_id || trainee.programId || trainee.program || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object')
        return value.$id || value.documentId || value.id || '';
    return '';
}
function getYearFromDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime()))
        return '';
    return String(date.getFullYear());
}
function getProgramStartYear(program) {
    if (!program)
        return '';
    return getYearFromDate(program.start_date || program.startDate || program['start-date'] || program['start_date'] || '');
}
function getRelationshipId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object')
        return value.$id || value.documentId || value.id || '';
    return '';
}
function partnerIdMatchesFilter(candidateId, filterPartnerId, partnersRaw) {
    const filterId = String(filterPartnerId || '').trim();
    const candidate = String(candidateId || '').trim();
    if (!filterId || filterId === 'all')
        return true;
    if (!candidate)
        return false;
    if (candidate === filterId)
        return true;
    const filterPartner = (partnersRaw || []).find((p) => String(p.$id || '') === filterId
        || String(p.documentId || '') === filterId);
    const candidatePartner = (partnersRaw || []).find((p) => String(p.$id || '') === candidate
        || String(p.documentId || '') === candidate);
    if (filterPartner && candidatePartner) {
        return String(filterPartner.$id) === String(candidatePartner.$id);
    }
    return false;
}
function isPartnerActive(partner) {
    const status = String(partner?.status || '').trim().toLowerCase();
    // Treat missing/legacy status as active; only explicit "inactive" is excluded.
    return status !== 'inactive';
}
function getTrainingPeriodWeeks(program) {
    const start = new Date(program.start_date || program.startDate || program['start-date'] || '');
    const end = new Date(program.end_date || program.endDate || program['end-time'] || program['end-date'] || '');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return 0;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0)
        return 0;
    return Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
}
async function loadLogoDataUrl() {
    try {
        const response = await fetch('/logo.png');
        if (!response.ok)
            return '';
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.readAsDataURL(blob);
        });
    }
    catch (_error) {
        return '';
    }
}
export default function AnalyticsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [programsRaw, setProgramsRaw] = useState([]);
    const [traineesRaw, setTraineesRaw] = useState([]);
    const [trainersRaw, setTrainersRaw] = useState([]);
    const [partnersRaw, setPartnersRaw] = useState([]);
    const [programPartnerAssignmentIndex, setProgramPartnerAssignmentIndex] = useState({});
    const [filters, setFilters] = useState({ ...ANALYTICS_DEFAULT_FILTERS });
    const [breakdownCategoryFilter, setBreakdownCategoryFilter] = useState('all');
    const [analyticsExportFormat, setAnalyticsExportFormat] = useState(ANALYTICS_EXPORT_FORMATS.tabular);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const exportRootRef = useRef(null);
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    /** `all` = show every chart; otherwise a single chart id from chartCards */
    const [chartViewId, setChartViewId] = useState('all');
    const loadAnalyticsData = async (mode = 'initial') => {
        try {
            if (mode === 'initial')
                setIsLoading(true);
            else
                setIsRefreshing(true);
            const [traineeDocs, programDocs, trainerDocs, partnerDocs, programPartnerDocs, enrollmentDocs] = await Promise.all([
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINEES),
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAMS),
                fetchCollectionOrEmpty(databases, DB_ID, COLLECTIONS.TRAINERS),
                fetchCollectionOrEmpty(databases, DB_ID, COLLECTIONS.PARTNERS),
                fetchCollectionOrEmpty(databases, DB_ID, COLLECTIONS.PROGRAM_PARTNERS),
                fetchCollectionOrEmpty(databases, DB_ID, COLLECTIONS.ENROLLMENTS),
            ]);
            const enrollmentByTrainee = buildEnrollmentListsByTrainee(enrollmentDocs);
            const mergedTrainees = traineeDocs.map((t) => mergeTraineeWithEnrollment(enrollmentByTrainee, t));
            setTraineesRaw(mergedTrainees);
            setProgramsRaw(programDocs);
            setTrainersRaw(trainerDocs);
            setPartnersRaw(partnerDocs);
            setProgramPartnerAssignmentIndex(buildProgramPartnerAssignmentIndex(programPartnerDocs));
            setLastUpdatedAt(new Date());
        }
        catch (error) {
            console.error('Error fetching analytics:', error);
            toast({
                title: 'Failed to refresh analytics',
                description: error instanceof Error ? error.message : 'Could not fetch latest analytics data.',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };
    useEffect(() => {
        loadAnalyticsData('initial');
    }, []);
    useEffect(() => {
        const timer = setInterval(() => {
            loadAnalyticsData('auto');
        }, 30000);
        return () => clearInterval(timer);
    }, []);
    const programById = useMemo(() => buildProgramByAnyId(programsRaw), [programsRaw]);
    const filteredPrograms = useMemo(() => programsRaw.filter((p) => {
        const programOk = filters.programId === 'all' || p.$id === filters.programId;
        const courseOk = programMatchesCourseFilter(p, filters.course);
        const trainingIds = getTrainingPartnerIdsForProgram(p, partnersRaw, programPartnerAssignmentIndex);
        const trainingOk = filters.trainingPartnerId === 'all'
            || trainingIds.some((id) => partnerIdMatchesFilter(id, filters.trainingPartnerId, partnersRaw));
        return programOk && courseOk && trainingOk;
    }), [programsRaw, filters.programId, filters.course, filters.trainingPartnerId, partnersRaw, programPartnerAssignmentIndex]);
    const allowedProgramIds = useMemo(() => new Set(filteredPrograms.map((p) => p.$id)), [filteredPrograms]);
    const scopedAllowedProgramIds = useMemo(
        () => ((filters.programId === 'all' && filters.trainingPartnerId === 'all') ? null : allowedProgramIds),
        [filters.programId, filters.trainingPartnerId, allowedProgramIds],
    );
    const personFilteredTrainees = useMemo(() => traineesRaw.filter((t) => {
        const genderOk = filters.gender === 'all' || normalizeGender(t.gender).toLowerCase() === filters.gender;
        const districtOk = filters.district === 'all'
            || !String(filters.district || '').trim()
            || String(t.district || '').trim().toLowerCase() === String(filters.district).trim().toLowerCase();
        return genderOk && districtOk;
    }), [traineesRaw, filters.gender, filters.district]);
    const enrollmentScope = useMemo(() => ({
        year: filters.year,
        programId: filters.programId,
        course: filters.course,
        allowedProgramIds: scopedAllowedProgramIds,
    }), [filters.year, filters.programId, filters.course, scopedAllowedProgramIds]);
    const filteredEnrollmentRows = useMemo(
        () => expandTraineesByEnrollment(personFilteredTrainees).filter((row) => enrollmentRowMatchesScope(row, enrollmentScope, programById)),
        [personFilteredTrainees, enrollmentScope, programById],
    );
    const filteredTrainees = useMemo(
        () => personFilteredTrainees.filter((t) => expandTraineesByEnrollment([t]).some((row) => enrollmentRowMatchesScope(row, enrollmentScope, programById))),
        [personFilteredTrainees, enrollmentScope, programById],
    );
    const stats = useMemo(() => {
        const completedCount = filteredEnrollmentRows.filter((t) => normalizeTraineeStatus(t.status) === 'completed').length;
        const currentlyEnrolledCount = filteredEnrollmentRows.filter((t) => isTraineeStatusEnrolled(t.status)).length;
        const inProgressCount = filteredEnrollmentRows.filter((t) => isTraineeStatusInProgress(t.status)).length;
        const certifiedCount = filteredTrainees.filter((t) => normalizeCertificationStatus(t.certification_status || t.certificationStatus) === 'Certified').length;
        const activePartnersCount = partnersRaw.filter((p) => {
            if (!isPartnerActive(p))
                return false;
            if (filters.trainingPartnerId === 'all')
                return true;
            return String(p.$id || '').trim() === String(filters.trainingPartnerId || '').trim();
        }).length;
        const avgTrainingWeeks = filteredPrograms.length > 0
            ? Math.round((filteredPrograms.reduce((sum, p) => sum + getTrainingPeriodWeeks(p), 0) / filteredPrograms.length) * 10) / 10
            : 0;
        return {
            trainingsConducted: filteredPrograms.length,
            currentlyEnrolledCount,
            inProgressCount,
            completedCount,
            certifiedCount,
            totalTrainees: filteredTrainees.length,
            totalEnrollments: filteredEnrollmentRows.length,
            activePartners: activePartnersCount,
            avgTrainingWeeks,
        };
    }, [filteredTrainees, filteredEnrollmentRows, filteredPrograms, partnersRaw, filters.trainingPartnerId]);
    const data = useMemo(() => {
        const statusMap = { upcoming: 0, ongoing: 0, completed: 0 };
        filteredPrograms.forEach((p) => {
            const key = String(p.status || '').toLowerCase();
            if (key in statusMap)
                statusMap[key]++;
        });
        const programStatus = enrichDistributionWithPercent([
            { name: 'Upcoming', count: statusMap.upcoming },
            { name: 'Ongoing', count: statusMap.ongoing },
            { name: 'Completed', count: statusMap.completed },
        ], 'count');
        const genderMap = { Male: 0, Female: 0, Other: 0 };
        filteredTrainees.forEach((t) => { genderMap[normalizeGender(t.gender)]++; });
        const genderDistribution = enrichDistributionWithPercent(
            Object.entries(genderMap).map(([name, value]) => ({ name, value })),
            'value',
        );
        const districtMap = {};
        filteredTrainees.forEach((t) => {
            const district = String(t.district || 'Unknown').trim() || 'Unknown';
            districtMap[district] = (districtMap[district] || 0) + 1;
        });
        const districtDistribution = enrichDistributionWithPercent(
            Object.entries(districtMap).map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count).slice(0, 10),
            'count',
        );
        const attendanceMap = {};
        filteredEnrollmentRows.forEach((t) => {
            const pid = getProgramIdFromTrainee(t);
            const label = getCourseLabel(getCourseKeyFromProgram(programById[pid]));
            if (!label || label === 'Uncategorized')
                return;
            attendanceMap[label] = (attendanceMap[label] || 0) + 1;
        });
        const courseAttendance = enrichDistributionWithPercent(
            Object.entries(attendanceMap)
                .map(([course, trainees]) => ({ course, trainees }))
                .sort((a, b) => b.trainees - a.trainees),
            'trainees',
        );
        const certificationMap = { Certified: 0, Pending: 0, 'Not Certified': 0 };
        filteredTrainees.forEach((t) => {
            const label = normalizeCertificationStatus(t.certification_status || t.certificationStatus);
            certificationMap[label] = (certificationMap[label] || 0) + 1;
        });
        const certificationDistribution = enrichDistributionWithPercent(
            Object.entries(certificationMap).map(([name, value]) => ({ name, value })),
            'value',
        );
        const trainerRoleMap = { trainer: 0, senior_trainer: 0 };
        trainersRaw.forEach((trainer) => {
            const role = String(trainer.role || '').toLowerCase();
            if (role in trainerRoleMap)
                trainerRoleMap[role]++;
        });
        const trainerRoleDistribution = enrichDistributionWithPercent([
            { name: 'RETC Facilitator', count: trainerRoleMap.trainer || 0 },
            { name: 'Senior RETC Facilitator', count: trainerRoleMap.senior_trainer || 0 },
        ], 'count');
        const yearlyMap = {};
        filteredEnrollmentRows.forEach((t) => {
            const pid = getProgramIdFromTrainee(t);
            const year = getProgramStartYear(programById[pid])
                || getYearFromDate(t.$createdAt || t.created_at);
            if (!year)
                return;
            yearlyMap[year] = (yearlyMap[year] || 0) + 1;
        });
        const yearlyParticipation = Object.entries(yearlyMap).sort(([a], [b]) => Number(a) - Number(b)).map(([year, participants]) => ({ year, participants }));
        const { trainingPartnerPrograms, otherPartnerPrograms } = buildPartnerCourseContributions(
            filteredPrograms,
            programPartnerAssignmentIndex,
            partnersRaw,
        );
        const trainingPartnerContribution = enrichDistributionWithPercent(trainingPartnerPrograms, 'programs');
        const otherPartnerContribution = enrichDistributionWithPercent(otherPartnerPrograms, 'programs');
        const yearlyParticipationEnriched = enrichDistributionWithPercent(yearlyParticipation, 'participants');
        return {
            programStatus,
            genderDistribution,
            districtDistribution,
            courseAttendance,
            certificationDistribution,
            trainerRoleDistribution,
            yearlyParticipation: yearlyParticipationEnriched,
            trainingPartnerContribution,
            otherPartnerContribution,
        };
    }, [filteredTrainees, filteredEnrollmentRows, filteredPrograms, trainersRaw, partnersRaw, programPartnerAssignmentIndex, programById]);
    const levelByCategory = useMemo(
        () => buildLevelByCourseCategory(filteredEnrollmentRows, programById, { alreadyExpanded: true }),
        [filteredEnrollmentRows, programById],
    );
    const genderByCategory = useMemo(
        () => buildGenderByCourseCategory(filteredEnrollmentRows, programById, { alreadyExpanded: true }),
        [filteredEnrollmentRows, programById],
    );
    const breakdownCategoryOptions = useMemo(() => {
        const keysInData = new Set([
            ...levelByCategory.stackedChartData.map((r) => r.categoryKey),
            ...genderByCategory.stackedChartData.map((r) => r.categoryKey),
        ]);
        const options = getCourseFilterSelectOptions().filter(
            (opt) => opt.value === 'all' || keysInData.has(opt.value),
        );
        if (keysInData.has('_uncategorized')) {
            options.push({ value: '_uncategorized', label: UNCATEGORIZED_COURSE_LABEL });
        }
        return options;
    }, [levelByCategory.stackedChartData, genderByCategory.stackedChartData]);
    const levelBreakdownView = useMemo(
        () => filterLevelBreakdownByCategory(levelByCategory, breakdownCategoryFilter),
        [levelByCategory, breakdownCategoryFilter],
    );
    const genderBreakdownView = useMemo(
        () => filterGenderBreakdownByCategory(genderByCategory, breakdownCategoryFilter),
        [genderByCategory, breakdownCategoryFilter],
    );
    const isBreakdownCategoryFiltered = breakdownCategoryFilter !== 'all';
    const levelGroupedChartData = useMemo(
        () => buildGroupedSegmentsFromStackRow(
            levelBreakdownView.stackedChartData[0],
            LEVEL_STACK_SERIES,
            LEVEL_CHART_COLORS,
        ),
        [levelBreakdownView.stackedChartData],
    );
    const genderGroupedChartData = useMemo(
        () => buildGroupedSegmentsFromStackRow(
            genderBreakdownView.stackedChartData[0],
            GENDER_STACK_SERIES,
            GENDER_STACK_COLORS,
        ),
        [genderBreakdownView.stackedChartData],
    );
    useEffect(() => {
        if (filters.course !== 'all')
            setBreakdownCategoryFilter(filters.course);
    }, [filters.course]);
    useEffect(() => {
        if (breakdownCategoryFilter === 'all')
            return;
        const stillValid = breakdownCategoryOptions.some((opt) => opt.value === breakdownCategoryFilter);
        if (!stillValid)
            setBreakdownCategoryFilter('all');
    }, [breakdownCategoryFilter, breakdownCategoryOptions]);
    const years = useMemo(() => {
        const set = new Set();
        traineesRaw.forEach((t) => {
            const y = getYearFromDate(t.$createdAt || t.created_at);
            if (y)
                set.add(y);
            getProgramIdsFromTrainee(t).forEach((pid) => {
                const py = pid ? getProgramStartYear(programById[pid]) : '';
                if (py)
                    set.add(py);
            });
        });
        return Array.from(set).sort((a, b) => Number(b) - Number(a));
    }, [traineesRaw, programById]);
    const districtOptions = useMemo(() => {
        const set = new Set();
        traineesRaw.forEach((t) => {
            const d = String(t.district || '').trim();
            if (d)
                set.add(d);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [traineesRaw]);
    const isFiltersDefault = useMemo(
        () => JSON.stringify(filters) === JSON.stringify(ANALYTICS_DEFAULT_FILTERS),
        [filters],
    );
    const chartCards = useMemo(() => {
        const cards = [];
        const chartH = ANALYTICS_CHART_HEIGHT;
        if (filteredPrograms.length >= 0) {
            cards.push({
                id: 'programStatus',
                pickerLabel: 'Course status',
                title: `${COURSE_MODULE_LABELS.statusDistribution} (%)`,
                description: 'Share of filtered courses by lifecycle status.',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.programStatus} maxBarSize={72} margin={{ top: 12, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="name" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" name="Courses">
                      {data.programStatus.map((entry, index) => (
                        <Cell key={entry.name} fill={colorForLabel(CHART_PROGRAM_STATUS_COLORS, entry.name, index)}/>
                      ))}
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 8 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (stats.totalTrainees >= 0) {
            cards.push({
                id: 'genderDistribution',
                pickerLabel: 'Gender (overall)',
                title: 'Participant Gender Distribution (%)',
                description: 'Share of filtered trainees by gender (all genders shown).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <PieChart>
                    <Pie data={data.genderDistribution} cx="50%" cy="50%" labelLine={false} label={pieSliceLabel} outerRadius={90} fill={RETC_GREEN} dataKey="value" stroke="#fff" strokeWidth={2}>
                      {data.genderDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={colorForLabel(CHART_GENDER_COLORS, entry.name, index)}/>
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, item) => chartPercentTooltip(value, name, item)} contentStyle={chartTooltipStyle.contentStyle}/>
                  </PieChart>
                </ResponsiveContainer>),
            });
        }
        if (data.trainingPartnerContribution.length > 0) {
            cards.push({
                id: 'trainingPartnerContribution',
                pickerLabel: 'Training partners',
                title: PARTNER_LABELS.trainingPartnerChartTitle,
                description: 'Courses led per training partner (% of filtered courses).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.trainingPartnerContribution} maxBarSize={56} margin={{ top: 12, right: 8, left: 4, bottom: 56 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="partner" interval={0} angle={-20} textAnchor="end" height={70} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" fill={RETC_GREEN} name="Courses">
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 6 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.otherPartnerContribution.length > 0) {
            cards.push({
                id: 'otherPartnerContribution',
                pickerLabel: 'Other partners',
                title: PARTNER_LABELS.otherPartnerChartTitle,
                description: 'Co-delivery partners per course (% of filtered courses).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.otherPartnerContribution} maxBarSize={56} margin={{ top: 12, right: 8, left: 4, bottom: 56 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="partner" interval={0} angle={-20} textAnchor="end" height={70} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" fill={RETC_ORANGE} name="Courses">
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 6 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.districtDistribution.length > 0) {
            cards.push({
                id: 'districtDistribution',
                pickerLabel: 'By district',
                title: 'Trainees by District — Top 10 (%)',
                description: 'Top districts by trainee count in current filter scope.',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.districtDistribution} maxBarSize={48} margin={{ top: 12, right: 8, left: 4, bottom: 56 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="district" interval={0} angle={-25} textAnchor="end" height={72} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" name="Trainees">
                      {data.districtDistribution.map((entry, index) => (
                        <Cell key={entry.district} fill={getChartSeriesColor(index)}/>
                      ))}
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 6 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.courseAttendance.length > 0) {
            cards.push({
                id: 'courseAttendance',
                pickerLabel: 'By category',
                title: 'Enrollments by Course Category (%)',
                description: 'One count per course enrollment (same person in two courses counts twice).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.courseAttendance} maxBarSize={56} margin={{ top: 12, right: 8, left: 4, bottom: 56 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="course" interval={0} angle={-18} textAnchor="end" height={64} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" name="Trainees">
                      {data.courseAttendance.map((entry, index) => (
                        <Cell key={entry.course} fill={getChartSeriesColor(index)}/>
                      ))}
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 6 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (stats.totalTrainees >= 0) {
            cards.push({
                id: 'certificationDistribution',
                pickerLabel: 'Certification',
                title: 'Certification Status (%)',
                description: 'Certified, pending, and not certified within filter scope.',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.certificationDistribution} maxBarSize={72} margin={{ top: 12, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="name" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" name="Trainees">
                      {data.certificationDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={colorForLabel(CHART_CERTIFICATION_COLORS, entry.name, index)}/>
                      ))}
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 8 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.trainerRoleDistribution.length > 0) {
            cards.push({
                id: 'trainerRoleDistribution',
                pickerLabel: 'Facilitator roles',
                title: 'RETC Facilitator Roles (%)',
                description: 'Facilitator role mix (not filtered by trainee scope).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={data.trainerRoleDistribution} maxBarSize={72} margin={{ top: 12, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="name" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Bar dataKey="percent" name="Facilitators">
                      {data.trainerRoleDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={colorForLabel(CHART_TRAINER_ROLE_COLORS, entry.name, index)}/>
                      ))}
                      <LabelList dataKey="percent" position="top" formatter={(p) => (p >= 8 ? `${p}%` : '')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.yearlyParticipation.length > 0) {
            cards.push({
                id: 'yearlyParticipation',
                pickerLabel: 'Yearly trend',
                title: 'Yearly Participation (%) of total in view',
                description: 'Course enrollments by year (% of all enrollments in scope).',
                element: (<ResponsiveContainer width="100%" height={chartH}>
                  <LineChart data={data.yearlyParticipation} margin={{ top: 12, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid {...chartGridProps}/>
                    <XAxis dataKey="year" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
                    <YAxis {...chartPercentYAxisProps}/>
                    <Tooltip formatter={chartPercentTooltip} contentStyle={chartTooltipStyle.contentStyle}/>
                    <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }}/>
                    <Line type="monotone" dataKey="percent" stroke={RETC_GREEN} strokeWidth={2.5} dot={{ fill: RETC_GREEN, r: 4 }} activeDot={{ fill: RETC_ORANGE, r: 6 }} name="Participants"/>
                  </LineChart>
                </ResponsiveContainer>),
            });
        }
        return cards;
    }, [data, stats.totalTrainees, filteredPrograms.length]);
    useEffect(() => {
        if (activeChartIndex > chartCards.length - 1) {
            setActiveChartIndex(0);
        }
    }, [chartCards.length, activeChartIndex]);
    const exportAnalyticsReport = async () => {
        const programLabel = filters.programId === 'all'
            ? COURSE_MODULE_LABELS.filterAll
            : (programsRaw.find((p) => p.$id === filters.programId)?.title || filters.programId);
        const trainingPartnerLabel = filters.trainingPartnerId === 'all'
            ? 'All partners'
            : (partnersRaw.find((p) => p.$id === filters.trainingPartnerId)?.name || filters.trainingPartnerId);
        const yearLabel = filters.year === 'all' ? 'All years' : String(filters.year);
        const genderLabel = filters.gender === 'all' ? 'All genders' : String(filters.gender);
        const districtLabel = filters.district === 'all' ? 'All districts' : String(filters.district);
        const courseLabel = filters.course === 'all' ? COURSE_MODULE_LABELS.filterAllCategories : getCourseLabel(filters.course);
        const filterRows = [
            ['Year', yearLabel],
            [COURSE_MODULE_LABELS.reportFilterLabel, programLabel],
            ['Course', courseLabel],
            ['Training partner', trainingPartnerLabel],
            ['Gender', genderLabel],
            ['District', districtLabel],
        ];
        const downloadName = buildAnalyticsReportFilename(filters, {
            programTitle: filters.programId === 'all' ? '' : programLabel,
            trainingPartnerName: filters.trainingPartnerId === 'all' ? '' : trainingPartnerLabel,
            courseLabel: filters.course === 'all' ? '' : courseLabel,
            reportFormat: analyticsExportFormat,
        });

        if (analyticsExportFormat === ANALYTICS_EXPORT_FORMATS.charts) {
            setIsExportingPdf(true);
            const previousChartViewId = chartViewId;
            try {
                flushSync(() => setChartViewId('all'));
                await new Promise((resolve) => setTimeout(resolve, 1200));
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const sectionElements = collectAnalyticsChartExportSections(
                    null,
                    exportRootRef.current ?? document,
                );
                if (sectionElements.length === 0) {
                    throw new Error('No chart sections are available to export. Adjust filters or refresh the page.');
                }
                const enrollmentHint = stats.totalEnrollments !== stats.totalTrainees
                    ? `${stats.totalEnrollments} enrollments`
                    : 'Filter scope';
                const summaryMetrics = [
                    { label: 'Trainings', value: stats.trainingsConducted, accent: 'green' },
                    {
                        label: 'Currently enrolled',
                        value: stats.currentlyEnrolledCount,
                        hint: 'Not yet in training',
                        pct: stats.totalEnrollments > 0
                            ? `${formatPercent(stats.currentlyEnrolledCount, stats.totalEnrollments)} of enrollments`
                            : null,
                        accent: 'green-soft',
                    },
                    {
                        label: 'In progress',
                        value: stats.inProgressCount,
                        hint: 'Active training',
                        pct: stats.totalEnrollments > 0
                            ? `${formatPercent(stats.inProgressCount, stats.totalEnrollments)} of enrollments`
                            : null,
                        accent: 'orange',
                    },
                    {
                        label: 'Completed',
                        value: stats.completedCount,
                        pct: stats.totalEnrollments > 0
                            ? `${formatPercent(stats.completedCount, stats.totalEnrollments)} of enrollments`
                            : null,
                        accent: 'green',
                    },
                    {
                        label: 'Total trainees',
                        value: stats.totalTrainees,
                        hint: enrollmentHint,
                        accent: 'orange-soft',
                    },
                    { label: 'Active partners', value: stats.activePartners, accent: 'green' },
                    { label: 'Avg weeks', value: stats.avgTrainingWeeks, accent: 'orange' },
                ];
                await exportAnalyticsChartsPdf({
                    filterRows,
                    summaryMetrics,
                    sectionElements,
                    downloadName,
                });
                toast({
                    title: 'Analytics PDF downloaded',
                    description: 'Chart view exported as shown on the dashboard.',
                });
            }
            catch (error) {
                console.error('Analytics charts export failed:', error);
                toast({
                    title: 'Export failed',
                    description: error instanceof Error ? error.message : 'Could not export analytics charts.',
                    variant: 'destructive',
                });
            }
            finally {
                flushSync(() => setChartViewId(previousChartViewId));
                setIsExportingPdf(false);
            }
            return;
        }

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const marginX = 22;
            const contentW = pageW - marginX * 2;
            const centerX = pageW / 2;
            const logoDataUrl = await loadLogoDataUrl();
            const tableBase = {
                margin: { left: marginX, right: marginX, bottom: 20 },
                styles: {
                    font: 'helvetica',
                    fontSize: 9.5,
                    cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
                    lineColor: [226, 232, 240],
                    lineWidth: 0.15,
                    valign: 'middle',
                },
                headStyles: {
                    fillColor: [4, 120, 87],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle',
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                theme: 'plain',
            };
            /** Top accent */
            doc.setFillColor(4, 120, 87);
            doc.rect(0, 0, pageW, 3.5, 'F');
            doc.setFillColor(255, 136, 41);
            doc.rect(0, 3.5, pageW, 1.2, 'F');
            let y = 14;
            /** Centered logo */
            const logoW = 34;
            const logoH = 34;
            if (logoDataUrl) {
                doc.addImage(logoDataUrl, 'PNG', centerX - logoW / 2, y, logoW, logoH);
                y += logoH + 6;
            }
            else {
                y += 4;
            }
            doc.setTextColor(4, 120, 87);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('RETC', centerX, y, { align: 'center' });
            y += 6.5;
            doc.setFontSize(10);
            doc.text('Training Management', centerX, y, { align: 'center' });
            y += 8;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(20);
            doc.text('ANALYTICS REPORT', centerX, y, { align: 'center' });
            y += 12;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.35);
            doc.line(marginX, y, pageW - marginX, y);
            y += 8;
            doc.setTextColor(51, 65, 85);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Parameter', 'Value']],
                body: filterRows,
                columnStyles: {
                    0: { cellWidth: contentW * 0.42, halign: 'left', fontStyle: 'bold', textColor: [71, 85, 105] },
                    1: { halign: 'right', textColor: [15, 23, 42] },
                },
            });
            y = doc.lastAutoTable.finalY + 12;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            doc.text('SUMMARY METRICS', marginX, y);
            y += 7;
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Metric', 'Count']],
                body: [
                    ['Trainings conducted', String(filteredPrograms.length)],
                    ['Enrollments currently enrolled', formatCountWithPercent(stats.currentlyEnrolledCount, stats.totalEnrollments, 1)],
                    ['Enrollments in progress', formatCountWithPercent(stats.inProgressCount, stats.totalEnrollments, 1)],
                    ['Enrollments completed', formatCountWithPercent(stats.completedCount, stats.totalEnrollments, 1)],
                    ['Trainees certified', formatCountWithPercent(stats.certifiedCount, stats.totalTrainees, 1)],
                    ['Total trainees (unique people)', String(stats.totalTrainees)],
                    ['Total course enrollments', String(stats.totalEnrollments)],
                    ['Active partners (distinct)', String(stats.activePartners)],
                    ['Avg training period (weeks)', String(stats.avgTrainingWeeks)],
                ],
                headStyles: { ...tableBase.headStyles, fillColor: [255, 136, 41] },
                columnStyles: {
                    0: { cellWidth: contentW * 0.58, halign: 'left', fontStyle: 'bold', textColor: [71, 85, 105] },
                    1: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
                },
            });
            y = doc.lastAutoTable.finalY + 12;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            doc.text('ENROLLMENTS BY COURSE CATEGORY', marginX, y);
            y += 7;
            const courseRows = data.courseAttendance.length > 0
                ? data.courseAttendance.map((item) => [item.course, formatCountWithPercent(item.trainees, stats.totalEnrollments, 1)])
                : [['No course-level data in scope', '—']];
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [[COURSE_MODULE_LABELS.categoryFilterLabel, 'Enrollments (% of scope)']],
                body: courseRows,
                columnStyles: {
                    0: { cellWidth: contentW * 0.62, halign: 'left', textColor: [15, 23, 42] },
                    1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
                },
            });
            y = doc.lastAutoTable.finalY + 12;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            doc.text('PARTICIPANT LEVEL (OVERALL)', marginX, y);
            y += 7;
            const levelRows = levelByCategory.levelSummary.length > 0
                ? levelSummaryPdfRows(levelByCategory.levelSummary)
                : [['No level data', '—', '—']];
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Level', 'Count', '% of trainees']],
                body: levelRows,
                columnStyles: {
                    0: { cellWidth: contentW * 0.4, halign: 'left', textColor: [15, 23, 42] },
                    1: { halign: 'right', fontStyle: 'bold' },
                    2: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
                },
            });
            y = doc.lastAutoTable.finalY + 12;
            const matrixRows = levelByCategory.tableRows.length > 0
                ? levelByCategoryPdfRows(levelByCategory.tableRows)
                : [['No data in scope', '—', '—', '—', '—', '—']];
            const levelTableH = estimatePdfTableHeightMm(matrixRows.length);
            y = reservePdfVerticalSpace(doc, y, 7 + levelTableH);
            y = drawPdfSectionHeading(doc, 'LEVEL BY COURSE CATEGORY', marginX, y);
            autoTable(doc, {
                ...tableBase,
                theme: 'grid',
                tableWidth: contentW,
                startY: y,
                head: [[
                    COURSE_MODULE_LABELS.categoryFilterLabel,
                    'Beginner (share of row)',
                    'Technician (share of row)',
                    'Trainer (share of row)',
                    'Total',
                    '% of all enrollments',
                ]],
                body: matrixRows,
                headStyles: { ...tableBase.headStyles, fontSize: 8 },
                styles: { ...tableBase.styles, fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: contentW * 0.28, halign: 'left' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' },
                    5: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
                },
            });
            y = doc.lastAutoTable.finalY + 12;
            if (filteredEnrollmentRows.length > 0) {
                y = appendGenderReportSections(doc, y, {
                    marginX,
                    contentWidth: contentW,
                    tableBase,
                    trainees: filteredEnrollmentRows,
                    programById,
                    summaryTitle: 'GENDER (OVERALL)',
                    enrollmentRowsAlreadyExpanded: true,
                });
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            doc.text('CERTIFICATION STATUS', marginX, y);
            y += 7;
            const certRows = data.certificationDistribution.length > 0
                ? data.certificationDistribution.map((item) => [item.name, formatCountWithPercent(item.value, stats.totalTrainees, 1)])
                : [['No certification data in scope', '—']];
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Certification status', 'Trainees (% of scope)']],
                body: certRows,
                columnStyles: {
                    0: { cellWidth: contentW * 0.62, halign: 'left', textColor: [15, 23, 42] },
                    1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
                },
            });
            appendAnalyticsPdfFooters(doc);
            downloadPdfDocument(doc, downloadName);
            toast({
                title: 'Analytics PDF downloaded',
                description: 'Tabular report exported successfully.',
            });
        }
        catch (error) {
            console.error('Analytics tabular export failed:', error);
            toast({
                title: 'Export failed',
                description: error instanceof Error ? error.message : 'Could not export analytics report.',
                variant: 'destructive',
            });
        }
    };
    if (isLoading) {
        return (<div className="p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[min(24rem,70dvh)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#047857]"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>);
    }
    return (<div ref={exportRootRef} className="space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-[#047857]/20 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] p-4 text-white shadow-[0_22px_45px_-24px_rgba(4,120,87,0.8)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-full">
            <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Analytics</h1>
            <p className="mt-2 text-sm text-white/90 sm:text-base">Training insights for courses, trainees, RETC facilitators, and participation trends</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <div className="w-full min-w-[200px] space-y-1.5 sm:w-auto">
              <Label htmlFor="analytics-export-format" className="text-white/90">Report format</Label>
              <Select
                value={analyticsExportFormat}
                onValueChange={setAnalyticsExportFormat}
                disabled={isExportingPdf}
              >
                <SelectTrigger id="analytics-export-format" className="w-full border-white/30 bg-white/95 text-slate-900 sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANALYTICS_EXPORT_FORMATS.tabular}>Tabular (tables)</SelectItem>
                  <SelectItem value={ANALYTICS_EXPORT_FORMATS.charts}>Analytics (charts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => { void exportAnalyticsReport(); }}
              disabled={isExportingPdf}
              className="w-full bg-white text-[#047857] hover:bg-white/90 sm:w-auto"
            >
            <Download className="mr-2 h-4 w-4"/>
            {isExportingPdf ? 'Preparing PDF…' : 'Download Analytics PDF'}
          </Button>
          <Button onClick={() => loadAnalyticsData('manual')} variant="outline" className="w-full border-white/80 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
            <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}/>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          </div>
        </div>
        {lastUpdatedAt && (<p className="mt-3 text-xs text-white/80">
            Last updated: {lastUpdatedAt.toLocaleTimeString()}
          </p>)}
      </div>
      <Card id="analytics-filters" className="border-[#047857]/20 p-5 shadow-sm scroll-mt-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Analytics filters</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose <span className="font-medium">All</span> on any field to include everything in scope, or narrow to a specific year, course, partner, gender, or district.
            </p>
          </div>
          {!isFiltersDefault && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-[#047857]/30 text-[#047857] hover:bg-[#047857]/5"
              onClick={() => setFilters({ ...ANALYTICS_DEFAULT_FILTERS })}
            >
              Reset all filters
            </Button>
          )}
        </div>
        <AnalyticsFilterFields
          filters={filters}
          onFiltersChange={setFilters}
          years={years}
          programsRaw={programsRaw}
          partnersRaw={partnersRaw}
          districtOptions={districtOptions}
        />
      </Card>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {[
          { key: 'trainings', label: 'Trainings', value: stats.trainingsConducted, hint: null, pct: null, accent: 'green', valueClass: 'text-slate-900' },
          { key: 'enrolled', label: 'Currently enrolled', value: stats.currentlyEnrolledCount, hint: 'Not yet in training', pct: stats.totalEnrollments > 0 ? formatPercent(stats.currentlyEnrolledCount, stats.totalEnrollments) : null, accent: 'green-soft', valueClass: 'text-slate-800' },
          { key: 'progress', label: 'In progress', value: stats.inProgressCount, hint: 'Active training', pct: stats.totalEnrollments > 0 ? formatPercent(stats.inProgressCount, stats.totalEnrollments) : null, accent: 'orange', valueClass: 'text-[#ff8829]' },
          { key: 'completed', label: 'Completed', value: stats.completedCount, hint: null, pct: stats.totalEnrollments > 0 ? formatPercent(stats.completedCount, stats.totalEnrollments) : null, accent: 'green', valueClass: 'text-[#047857]' },
          { key: 'total', label: 'Total trainees', value: stats.totalTrainees, hint: stats.totalEnrollments !== stats.totalTrainees ? `${stats.totalEnrollments} enrollments` : 'Filter scope', pct: null, accent: 'orange-soft', valueClass: 'text-[#ff8829]' },
          { key: 'partners', label: 'Active partners', value: stats.activePartners, hint: null, pct: null, accent: 'green', valueClass: 'text-[#047857]' },
          { key: 'weeks', label: 'Avg weeks', value: stats.avgTrainingWeeks, hint: null, pct: null, accent: 'orange', valueClass: 'text-[#ff8829]' },
        ].map((tile) => {
          const accentClass = tile.accent === 'orange'
            ? 'border-[#ff8829]/25 border-l-[#ff8829] bg-[#ff8829]/[0.07]'
            : tile.accent === 'orange-soft'
              ? 'border-[#ff8829]/20 border-l-[#ff8829]/75 bg-[#ff8829]/[0.05]'
              : tile.accent === 'green-soft'
                ? 'border-[#047857]/12 border-l-[#047857]/60 bg-white'
                : 'border-[#047857]/15 border-l-[#047857] bg-[#047857]/[0.05]';
          const pctClass = tile.accent.startsWith('orange') ? 'text-[#c2410c]' : 'text-[#047857]';
          return (
            <div
              key={tile.key}
              className={`rounded-lg border border-l-[3px] px-3 py-2 ${accentClass}`}
            >
              <p className="text-[11px] font-semibold leading-tight text-slate-600">{tile.label}</p>
              {tile.hint && <p className="text-[10px] leading-tight text-slate-500">{tile.hint}</p>}
              <p className={`mt-0.5 text-lg font-bold leading-none tabular-nums ${tile.valueClass}`}>{tile.value}</p>
              {tile.pct && <p className={`mt-0.5 text-[10px] font-medium ${pctClass}`}>{tile.pct} of enrollments</p>}
            </div>
          );
        })}
      </div>
      {(levelByCategory.grandTotal > 0 || genderByCategory.grandTotal > 0) && (
        <div className="space-y-4">
          <Card className="border-[#047857]/20 p-4 shadow-sm" data-analytics-export-hide>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Course category breakdown</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Filter by {COURSE_MODULE_LABELS.categoryFilterLabel.toLowerCase()} to see exact participant counts on the charts (including trainer level).
                </p>
              </div>
              <div className="min-w-[220px] space-y-1.5">
                <Label htmlFor="breakdown-category-filter">{COURSE_MODULE_LABELS.categoryFilterLabel}</Label>
                <Select value={breakdownCategoryFilter} onValueChange={setBreakdownCategoryFilter}>
                  <SelectTrigger id="breakdown-category-filter" className="w-full">
                    <SelectValue placeholder={COURSE_MODULE_LABELS.filterAllCategories} />
                  </SelectTrigger>
                  <SelectContent>
                    {breakdownCategoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {levelBreakdownView.grandTotal > 0 && (<Card
          className="border-[#047857]/20 p-4 shadow-sm"
          data-analytics-export-chart
          data-export-title="Participants by level and course category"
        >
          <div className="mb-4" data-analytics-export-pdf-hide>
            <h2 className="text-lg font-semibold text-gray-900">Participants by level and course category</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isBreakdownCategoryFiltered
                ? `${levelBreakdownView.selectedCategory} — ${levelBreakdownView.grandTotal} participants. Counts and percentages are shown on each bar.`
                : `Participant counts by level within each ${COURSE_MODULE_LABELS.categoryFilterLabel.toLowerCase()}. Select a category above to focus on one course.`}
            </p>
          </div>
          <ResponsiveContainer
            width="100%"
            height={isBreakdownCategoryFiltered
                ? Math.max(300, levelGroupedChartData.length * 72)
                : Math.max(280, levelBreakdownView.stackedChartData.length * 48)}
          >
            {isBreakdownCategoryFiltered ? (
            <BarChart data={levelGroupedChartData} maxBarSize={72} margin={{ top: 28, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid {...chartGridProps}/>
              <XAxis dataKey="segment" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <YAxis allowDecimals={false} width={44} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {levelGroupedChartData.map((entry) => (
                  <Cell key={entry.segment} fill={entry.fill}/>
                ))}
                <LabelList
                  dataKey="chartLabel"
                  position="top"
                  fill="#334155"
                  fontSize={12}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
            ) : (
            <BarChart data={levelBreakdownView.stackedChartData} maxBarSize={56} margin={{ top: 28, right: 8, left: 4, bottom: 56 }}>
              <CartesianGrid {...chartGridProps}/>
              <XAxis dataKey="category" interval={0} angle={-22} textAnchor="end" height={72} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <YAxis allowDecimals={false} width={44} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }}/>
              {LEVEL_STACK_SERIES.map(({ countKey, name }) => (
                <Bar
                  key={countKey}
                  dataKey={countKey}
                  stackId="level"
                  fill={LEVEL_CHART_COLORS[countKey]}
                  name={name}
                >
                  <LabelList
                    dataKey={countKey}
                    position="center"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={700}
                    formatter={(_value, entry) => {
                        const row = entry?.payload ?? entry;
                        const count = row?.[countKey] ?? 0;
                        if (count <= 0)
                            return '';
                        return formatCountWithPercent(count, row.total, 1);
                    }}
                  />
                </Bar>
              ))}
            </BarChart>
            )}
          </ResponsiveContainer>
        </Card>)}
      {genderBreakdownView.grandTotal > 0 && (<Card
          className="border-[#047857]/20 p-4 shadow-sm xl:min-h-0"
          data-analytics-export-chart
          data-export-title="Participants by gender and course category"
        >
          <div className="mb-4" data-analytics-export-pdf-hide>
            <h2 className="text-lg font-semibold text-gray-900">Participants by gender and course category</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isBreakdownCategoryFiltered
                ? `${genderBreakdownView.selectedCategory} — ${genderBreakdownView.grandTotal} participants. Counts and percentages are shown on each bar.`
                : `Participant counts by gender within each ${COURSE_MODULE_LABELS.categoryFilterLabel.toLowerCase()}. Select a category above to focus on one course.`}
            </p>
          </div>
          <ResponsiveContainer
            width="100%"
            height={isBreakdownCategoryFiltered
                ? Math.max(300, genderGroupedChartData.length * 72)
                : Math.max(280, genderBreakdownView.stackedChartData.length * 48)}
          >
            {isBreakdownCategoryFiltered ? (
            <BarChart data={genderGroupedChartData} maxBarSize={72} margin={{ top: 28, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid {...chartGridProps}/>
              <XAxis dataKey="segment" tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <YAxis allowDecimals={false} width={44} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {genderGroupedChartData.map((entry) => (
                  <Cell key={entry.segment} fill={entry.fill}/>
                ))}
                <LabelList
                  dataKey="chartLabel"
                  position="top"
                  fill="#334155"
                  fontSize={12}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
            ) : (
            <BarChart data={genderBreakdownView.stackedChartData} maxBarSize={56} margin={{ top: 28, right: 8, left: 4, bottom: 56 }}>
              <CartesianGrid {...chartGridProps}/>
              <XAxis dataKey="category" interval={0} angle={-22} textAnchor="end" height={72} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <YAxis allowDecimals={false} width={44} tick={chartAxisProps.tick} axisLine={chartAxisProps.axisLine} tickLine={chartAxisProps.tickLine}/>
              <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }}/>
              {GENDER_STACK_SERIES.map(({ countKey, name }) => (
                <Bar
                  key={countKey}
                  dataKey={countKey}
                  stackId="gender"
                  fill={GENDER_STACK_COLORS[countKey]}
                  name={name}
                >
                  <LabelList
                    dataKey={countKey}
                    position="center"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight={700}
                    formatter={(_value, entry) => {
                        const row = entry?.payload ?? entry;
                        const count = row?.[countKey] ?? 0;
                        if (count <= 0)
                            return '';
                        return formatCountWithPercent(count, row.total, 1);
                    }}
                  />
                </Bar>
              ))}
            </BarChart>
            )}
          </ResponsiveContainer>
        </Card>)}
        </div>
        </div>
      )}
      {chartCards.length > 0 && (<Card className="border-[#047857]/20 p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Data visualizations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Charts use the <span className="font-medium">Analytics filters</span> above (choose <span className="font-medium">All …</span> on any field for the full dataset). Pick <span className="font-medium">All charts</span> to see every chart at once.
            </p>
          </div>
          <div data-analytics-export-hide className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:max-w-md">
              <Label htmlFor="analytics-chart-select">Chart view</Label>
              <Select
                value={chartViewId === 'all' ? 'all' : (chartCards[activeChartIndex]?.id ?? chartCards[0]?.id)}
                onValueChange={(id) => {
                    if (id === 'all') {
                        setChartViewId('all');
                        return;
                    }
                    setChartViewId(id);
                    const idx = chartCards.findIndex((c) => c.id === id);
                    if (idx >= 0)
                        setActiveChartIndex(idx);
                }}
              >
                <SelectTrigger id="analytics-chart-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All charts</SelectItem>
                  {chartCards.map((chart) => (
                    <SelectItem key={chart.id} value={chart.id}>{chart.pickerLabel ?? chart.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chartViewId !== 'all' && (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setActiveChartIndex((prev) => (prev - 1 + chartCards.length) % chartCards.length)} aria-label="Previous chart">
                  <ChevronLeft className="h-4 w-4"/>
                </Button>
                <span className="min-w-[4rem] text-center text-xs font-medium text-slate-600">
                  {activeChartIndex + 1} / {chartCards.length}
                </span>
                <Button type="button" variant="outline" size="icon" onClick={() => setActiveChartIndex((prev) => (prev + 1) % chartCards.length)} aria-label="Next chart">
                  <ChevronRight className="h-4 w-4"/>
                </Button>
              </div>
            )}
          </div>
          <div>
          {chartViewId === 'all' ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {chartCards.map((chart) => (
                <div
                  key={chart.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/40 p-3"
                  data-analytics-export-chart
                  data-export-title={chart.title}
                >
                  <div data-analytics-export-pdf-hide>
                  <h3 className="text-base font-semibold text-slate-900">{chart.title}</h3>
                  {chart.description && (
                    <p className="mt-0.5 text-sm text-slate-600">{chart.description}</p>
                  )}
                  </div>
                  <div className="mt-3 min-h-[280px] w-full">{chart.element}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                <h3 className="text-base font-semibold text-slate-900">{chartCards[activeChartIndex]?.title}</h3>
                {chartCards[activeChartIndex]?.description && (
                  <p className="mt-0.5 text-sm text-slate-600">{chartCards[activeChartIndex].description}</p>
                )}
              </div>
              <div className="mt-3 min-h-[300px] w-full">
                {chartCards[activeChartIndex]?.element}
              </div>
            </>
          )}
          </div>
        </Card>)}
    </div>);
}
