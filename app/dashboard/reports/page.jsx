'use client';
import { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { useAuth } from '@/components/auth-provider';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { ReportFilterFields } from '@/components/report-filter-fields';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { buildProgramsReportFilename, buildTraineesReportFilename } from '@/lib/pdf-report-naming';
import {
    buildProgramByAnyId,
    getCourseKeyFromProgram,
    getCourseLabel,
    getProgramIdFromTrainee,
    programMatchesCourseFilter,
    traineeMatchesCourseFilter,
} from '@/lib/renewable-energy-courses';
import { buildEnrollmentByTrainee, mergeTraineeWithEnrollment } from '@/lib/trainee-enrollment';
import { devWarn } from '@/lib/logger';
import { getTraineeStatusLabel } from '@/lib/types';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import {
    buildLevelByCourseCategory,
    levelByCategoryPdfRows,
    levelSummaryPdfRows,
} from '@/lib/analytics-visualization';
import { getTraineeLevelLabel } from '@/lib/trainee-levels';
import {
    appendGenderReportSections,
    drawPdfSectionHeading,
    estimatePdfTableHeightMm,
    reservePdfVerticalSpace,
} from '@/lib/pdf-section-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const REPORT_MARGIN_X = 22;
/** Usable width (mm) inside left/right margins for A4 tables. */
function pdfContentWidthMm(doc) {
    return doc.internal.pageSize.getWidth() - REPORT_MARGIN_X * 2;
}

/** Relative weights → mm widths that sum exactly to contentWidth (avoids squashed columns). */
function pdfColumnWidthsMm(contentWidth, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0)
        return weights.map(() => contentWidth / Math.max(weights.length, 1));
    const colWidths = weights.map((w) => Math.floor(((w / totalWeight) * contentWidth) * 10) / 10);
    const used = colWidths.reduce((sum, w) => sum + w, 0);
    const lastIdx = colWidths.length - 1;
    colWidths[lastIdx] = Math.round((colWidths[lastIdx] + (contentWidth - used)) * 10) / 10;
    return colWidths;
}

function buildProgramsReportColumnStyles(contentWidth) {
    const widths = pdfColumnWidthsMm(contentWidth, [
        5.2, 2.4, 2.2, 2.2, 1.8, 1.3, 0.65, 0.65, 1.05,
    ]);
    const styles = {};
    widths.forEach((cellWidth, index) => {
        styles[index] = { cellWidth, halign: 'left', valign: 'top' };
    });
    styles[6].halign = 'center';
    styles[7].halign = 'center';
    styles[8].halign = 'center';
    return styles;
}

function buildTraineesReportColumnStyles(contentWidth) {
    const widths = pdfColumnWidthsMm(contentWidth, [
        2.2, 3.6, 1.6, 1, 1.3, 2.6, 2.2, 1.2, 1.2, 1.1,
    ]);
    const styles = {};
    widths.forEach((cellWidth, index) => {
        styles[index] = { cellWidth, halign: 'left', valign: 'top' };
    });
    styles[9].halign = 'center';
    return styles;
}

function getOtherPartnerNamesForProgram(programId, programPartnerMap, partnerById) {
    const ids = programPartnerMap[programId];
    if (!Array.isArray(ids))
        return '';
    return ids.map((id) => partnerById[id]).filter(Boolean).join(', ');
}
/** Readable status text in PDFs (avoids narrow columns fighting "in_progress"). */
function formatStatusLabelForPdf(status) {
    const label = getTraineeStatusLabel(status);
    return label === '-' ? '—' : label;
}
function formatCertificationLabel(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (raw === 'certified')
        return 'Certified';
    if (raw === 'not_certified' || raw === 'not-certified')
        return 'Not Certified';
    return 'Pending';
}
function normalizeGender(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'male' || v === 'm')
        return 'Male';
    if (v === 'female' || v === 'f')
        return 'Female';
    return 'Other';
}
function getCreatedYear(doc) {
    const dateValue = doc.$createdAt || doc.created_at || '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime()))
        return '';
    return String(date.getFullYear());
}
function getTrainerIdFromProgram(program) {
    const value = program.trainer_id || program.trainerId || program.trainer || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object') {
        return value.$id || value.documentId || value.id || '';
    }
    return '';
}
function getTrainingPeriodWeeks(program) {
    const start = new Date(program.start_date || program.startDate || program['start-date'] || '');
    const end = new Date(program.end_date || program.endDate || program['end-time'] || program['end-date'] || '');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return '';
    }
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0)
        return '';
    return String(Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))));
}
function getRelationshipId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object') {
        return value.$id || value.documentId || value.id || '';
    }
    return '';
}
function getProgramIdFromPartnerJoin(row) {
    return getRelationshipId(row.program_id || row.programId || row.program);
}
function getPartnerIdFromPartnerJoin(row) {
    return getRelationshipId(row.partner_id || row.partnerId || row.partner);
}
function buildProgramPartnerMapFromDocs(ppDocs) {
    const map = {};
    (ppDocs || []).forEach((row) => {
        const programId = getProgramIdFromPartnerJoin(row);
        const partnerId = getPartnerIdFromPartnerJoin(row);
        if (!programId || !partnerId)
            return;
        if (!map[programId])
            map[programId] = [];
        if (!map[programId].includes(partnerId))
            map[programId].push(partnerId);
    });
    return map;
}
async function listReportDocuments(collectionId, queries) {
    const res = await databases.listDocuments(DB_ID, collectionId, queries, undefined, true);
    return res.documents || [];
}
/**
 * Load all documents for PDFs. Prefer limit+offset (no attribute index required). Fall back to $id cursor, then plain list.
 */
async function fetchAllReportDocuments(collectionId, { maxDocs = 25000, pageSize = 250 } = {}) {
    if (!databases || !DB_ID || !collectionId)
        return [];
    const out = [];
    try {
        for (let offset = 0; offset < maxDocs; offset += pageSize) {
            const queries = [Query.limit(pageSize), Query.offset(offset)];
            const batch = await listReportDocuments(collectionId, queries);
            if (!batch.length)
                break;
            out.push(...batch);
            if (batch.length < pageSize)
                break;
        }
        if (out.length > 0)
            return out;
    }
    catch (err) {
        devWarn('[reports] Offset pagination failed; trying cursor pagination:', collectionId, err);
    }
    let cursor = null;
    try {
        while (out.length < maxDocs) {
            const queries = [Query.limit(pageSize), Query.orderAsc('$id')];
            if (cursor)
                queries.push(Query.cursorAfter(cursor));
            const batch = await listReportDocuments(collectionId, queries);
            if (!batch.length)
                break;
            out.push(...batch);
            if (batch.length < pageSize)
                break;
            cursor = batch[batch.length - 1].$id;
        }
        if (out.length > 0)
            return out;
    }
    catch (err) {
        devWarn('[reports] Cursor pagination failed; trying limit-only:', collectionId, err);
    }
    try {
        return await listReportDocuments(collectionId, [Query.limit(Math.min(maxDocs, 5000))]);
    }
    catch (err2) {
        devWarn('[reports] Limit-only fetch failed; trying default listDocuments:', collectionId, err2);
        const res = await databases.listDocuments(DB_ID, collectionId, undefined, undefined, true);
        return res.documents || [];
    }
}
/** Loads a collection for reports; failures (wrong ID, ACL) do not break the rest of the page. */
async function fetchReportCollectionOrEmpty(collectionId, logLabel) {
    if (!collectionId)
        return [];
    try {
        return await fetchAllReportDocuments(collectionId);
    }
    catch (e) {
        devWarn(`[reports] Optional collection "${logLabel || collectionId}" could not be loaded:`, e);
        return [];
    }
}
function getYearFromProgramStart(program) {
    const raw = program.start_date || program.startDate || program['start-date'];
    if (!raw)
        return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return '';
    return String(d.getFullYear());
}
/** Distinct years from program created/start dates and trainee created dates / assigned program start years. */
function collectReportYears(programDocs, traineeDocs) {
    const set = new Set();
    const programById = buildProgramByAnyId(programDocs || []);
    (programDocs || []).forEach((p) => {
        const cy = getCreatedYear(p);
        if (cy)
            set.add(cy);
        const sy = getYearFromProgramStart(p);
        if (sy)
            set.add(sy);
    });
    (traineeDocs || []).forEach((t) => {
        const cy = getCreatedYear(t);
        if (cy)
            set.add(cy);
        const pid = getProgramIdFromTrainee(t);
        const prog = programById[pid];
        if (prog) {
            const sy = getYearFromProgramStart(prog);
            if (sy)
                set.add(sy);
        }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
}
function buildPartnerLabelMap(partnerDocs) {
    const map = {};
    (partnerDocs || []).forEach((p) => {
        const label = String(p.name || p.email || p.$id || '').trim();
        const id = String(p.$id || '').trim();
        if (id)
            map[id] = label;
        const docId = String(p.documentId || '').trim();
        if (docId)
            map[docId] = label;
    });
    return map;
}
function findPartnerById(partnerDocs, id) {
    if (!id)
        return undefined;
    return (partnerDocs || []).find((p) => p.$id === id || p.documentId === id);
}
function findTrainerById(trainerDocs, id) {
    if (!id)
        return undefined;
    return (trainerDocs || []).find((t) => t.$id === id || t.documentId === id);
}
function buildProgramTitleById(programDocs) {
    const m = {};
    (programDocs || []).forEach((p) => {
        const title = p.title || 'Untitled';
        m[p.$id] = title;
        if (p.documentId && p.documentId !== p.$id)
            m[p.documentId] = title;
    });
    return m;
}
/** Primary training partner ids for a program (same idea as analytics). */
function getTrainingPartnerIdsForProgram(program, partnersRaw) {
    const ids = new Set();
    const idRel = getRelationshipId(program.training_partner_id || program.trainingPartnerId);
    if (idRel)
        ids.add(idRel);
    const tp = program['training-partners'] ?? program.training_partners ?? program.training_partner;
    const tpRel = getRelationshipId(tp);
    if (tpRel)
        ids.add(tpRel);
    const nameStr = typeof tp === 'string'
        ? tp.trim()
        : (typeof program.training_partner === 'string' ? program.training_partner.trim() : '');
    if (nameStr && partnersRaw?.length) {
        const lower = nameStr.toLowerCase();
        partnersRaw.forEach((par) => {
            if (String(par.name || '').trim().toLowerCase() === lower)
                ids.add(par.$id);
        });
    }
    return [...ids];
}
function partnerIdAliases(partners, filterPartnerId) {
    const set = new Set([String(filterPartnerId || '').trim()].filter(Boolean));
    const p = findPartnerById(partners, filterPartnerId);
    if (p) {
        if (p.$id)
            set.add(String(p.$id));
        if (p.documentId)
            set.add(String(p.documentId));
    }
    return set;
}
function programMatchesPartnerFilter(prog, filterPartnerId, partners, programPartnerMap) {
    if (filterPartnerId == null || filterPartnerId === '' || filterPartnerId === 'all')
        return true;
    if (!prog)
        return false;
    const aliases = partnerIdAliases(partners, filterPartnerId);
    const candidateIds = new Set();
    getTrainingPartnerIdsForProgram(prog, partners).forEach((id) => candidateIds.add(String(id)));
    (programPartnerMap[prog.$id] || []).forEach((id) => candidateIds.add(String(id)));
    if (prog.documentId)
        (programPartnerMap[prog.documentId] || []).forEach((id) => candidateIds.add(String(id)));
    for (const c of candidateIds) {
        if (aliases.has(c))
            return true;
        const par = findPartnerById(partners, c);
        if (par && (aliases.has(String(par.$id)) || (par.documentId && aliases.has(String(par.documentId)))))
            return true;
    }
    return false;
}
function districtMatchesFilter(trainee, filters) {
    const d = filters?.district;
    if (d == null || d === '' || d === 'all')
        return true;
    const t = String(trainee.district || '').trim().toLowerCase();
    const f = String(d).trim().toLowerCase();
    if (!f)
        return true;
    return t === f || t.includes(f);
}
function resolveTrainerCanonicalId(trainers, id) {
    if (!id)
        return '';
    const t = trainers.find((x) => x.$id === id || x.documentId === id);
    return t ? String(t.$id) : String(id).trim();
}
function trainerMatchesFilter(prog, filters, trainers) {
    const tid = filters?.trainerId;
    if (tid == null || tid === '' || tid === 'all')
        return true;
    if (!prog)
        return false;
    const a = resolveTrainerCanonicalId(trainers, getTrainerIdFromProgram(prog));
    const b = resolveTrainerCanonicalId(trainers, tid);
    return !!a && !!b && a === b;
}
/** Treat empty / missing UI values like "All" so PDF filters do not drop every row. */
function coalesceReportFilters(f) {
    const rawGender = f.gender;
    const gender = rawGender == null || rawGender === '' || String(rawGender).toLowerCase() === 'all'
        ? 'all'
        : normalizeGender(rawGender);
    return {
        year: f.year == null || f.year === '' ? 'all' : String(f.year),
        programId: !f.programId || f.programId === '' ? 'all' : String(f.programId),
        course: !f.course || f.course === '' ? 'all' : String(f.course),
        gender,
        district: !f.district || f.district === '' || f.district === 'all' ? 'all' : String(f.district),
        trainerId: !f.trainerId || f.trainerId === '' || f.trainerId === 'all' ? 'all' : String(f.trainerId),
        partnerId: !f.partnerId || f.partnerId === '' || f.partnerId === 'all' ? 'all' : String(f.partnerId),
    };
}
const REPORT_FILTERS_ALL = {
    year: 'all',
    programId: 'all',
    course: 'all',
    gender: 'all',
    district: 'all',
    trainerId: 'all',
    partnerId: 'all',
};
function filterTraineesForReport(allTrainees, rf, programByMulti, pdfProgramPartnerMap, partnerDocs, trainerDocs) {
    return allTrainees.filter((t) => {
        const traineeProgramId = getProgramIdFromTrainee(t);
        const prog = programByMulti[traineeProgramId];
        const programStartYear = prog ? getYearFromProgramStart(prog) : '';
        const yearOk = rf.year === 'all'
            || getCreatedYear(t) === rf.year
            || (programStartYear !== '' && programStartYear === rf.year);
        const genderOk = rf.gender === 'all' || normalizeGender(t.gender) === rf.gender;
        const districtOk = districtMatchesFilter(t, rf);
        const programOk = rf.programId === 'all'
            || traineeProgramId === rf.programId
            || (prog && (prog.$id === rf.programId || String(prog.documentId || '') === rf.programId));
        const partnerOk = programMatchesPartnerFilter(prog, rf.partnerId, partnerDocs, pdfProgramPartnerMap);
        const trainerOk = trainerMatchesFilter(prog, rf, trainerDocs);
        const courseOk = traineeMatchesCourseFilter(t, rf.course, programByMulti);
        return yearOk && genderOk && districtOk && programOk && partnerOk && trainerOk && courseOk;
    });
}
/** If the user’s filters exclude every loaded trainee, widen filters so the PDF still lists people (with toast). */
function resolveTraineesForPdf(allTrainees, userFilters, programByMulti, pdfProgramPartnerMap, partnerDocs, trainerDocs) {
    const rf = coalesceReportFilters(userFilters);
    const list = filterTraineesForReport(allTrainees, rf, programByMulti, pdfProgramPartnerMap, partnerDocs, trainerDocs);
    return { rf, trainees: list, widenNote: '' };
}
function filterProgramsForReport(allPrograms, rf, trainerDocs, partnerDocs, programPartnerMap) {
    return allPrograms.filter((p) => {
        const createdYear = getCreatedYear(p);
        const startYear = getYearFromProgramStart(p);
        const yearOk = rf.year === 'all'
            || createdYear === rf.year
            || startYear === rf.year;
        const programOk = rf.programId === 'all' || p.$id === rf.programId || String(p.documentId || '') === rf.programId;
        const trainerOk = trainerMatchesFilter(p, rf, trainerDocs);
        const partnerOk = programMatchesPartnerFilter(p, rf.partnerId, partnerDocs, programPartnerMap);
        const courseOk = programMatchesCourseFilter(p, rf.course);
        return yearOk && programOk && trainerOk && partnerOk && courseOk;
    });
}
function resolveProgramsForPdf(allPrograms, userFilters, trainerDocs, partnerDocs, programPartnerMap) {
    const rf = coalesceReportFilters(userFilters);
    const list = filterProgramsForReport(allPrograms, rf, trainerDocs, partnerDocs, programPartnerMap);
    return { rf, programs: list, widenNote: '' };
}
export default function ReportsPage() {
    const { isAdmin, isManager } = useAuth();
    const canExportReports = isAdmin || isManager;
    const [isGenerating, setIsGenerating] = useState(false);
    const [programs, setPrograms] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [partners, setPartners] = useState([]);
    const [programPartnerMap, setProgramPartnerMap] = useState({});
    /** Loaded with filters — used for Year dropdown (same sources as export year logic). */
    const [traineesSnapshot, setTraineesSnapshot] = useState([]);
    const [filters, setFilters] = useState({
        year: 'all',
        programId: 'all',
        course: 'all',
        gender: 'all',
        district: 'all',
        trainerId: 'all',
        partnerId: 'all',
    });
    useEffect(() => {
        loadFilterSources();
    }, []);
    const loadFilterSources = async () => {
        if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
            toast({
                title: 'Reports unavailable',
                description: 'Appwrite database or programs collection is not configured.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const traineeFetch = COLLECTIONS.TRAINEES
                ? fetchAllReportDocuments(COLLECTIONS.TRAINEES)
                : Promise.resolve([]);
            const [programDocs, trainerDocs, partnerDocs, traineeDocs] = await Promise.all([
                fetchAllReportDocuments(COLLECTIONS.PROGRAMS),
                COLLECTIONS.TRAINERS ? fetchAllReportDocuments(COLLECTIONS.TRAINERS) : Promise.resolve([]),
                COLLECTIONS.PARTNERS ? fetchAllReportDocuments(COLLECTIONS.PARTNERS) : Promise.resolve([]),
                traineeFetch,
            ]);
            const [enrollmentDocs, ppDocs] = await Promise.all([
                fetchReportCollectionOrEmpty(COLLECTIONS.ENROLLMENTS, 'enrollments'),
                fetchReportCollectionOrEmpty(COLLECTIONS.PROGRAM_PARTNERS, 'program_partners'),
            ]);
            setPrograms(programDocs);
            const enrollmentByTrainee = buildEnrollmentByTrainee(enrollmentDocs);
            setTraineesSnapshot(traineeDocs.map((t) => mergeTraineeWithEnrollment(enrollmentByTrainee, t)));
            setTrainers(trainerDocs);
            setPartners(partnerDocs);
            setProgramPartnerMap(buildProgramPartnerMapFromDocs(ppDocs));
        }
        catch (error) {
            console.error('Failed to load report filters:', error);
            toast({
                title: 'Could not load report data',
                description: error instanceof Error ? error.message : 'Check Appwrite permissions and collection IDs.',
                variant: 'destructive',
            });
        }
    };
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };
    const loadLogoDataUrl = async () => {
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
    };
    const getPdfTableBase = (doc) => {
        return {
            margin: { left: REPORT_MARGIN_X, right: REPORT_MARGIN_X, bottom: 20 },
            styles: {
                font: 'helvetica',
                fontSize: 9.5,
                cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
                lineColor: [226, 232, 240],
                lineWidth: 0.15,
                valign: 'middle',
                overflow: 'linebreak',
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
    };
    const layoutStyledReportHeader = async (doc, reportTitle) => {
        const pageW = doc.internal.pageSize.getWidth();
        const centerX = pageW / 2;
        const logoDataUrl = await loadLogoDataUrl();
        doc.setFillColor(4, 120, 87);
        doc.rect(0, 0, pageW, 3.5, 'F');
        doc.setFillColor(255, 136, 41);
        doc.rect(0, 3.5, pageW, 1.2, 'F');
        let y = 14;
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
        doc.text(String(reportTitle || '').toUpperCase(), centerX, y, { align: 'center' });
        y += 12;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.line(REPORT_MARGIN_X, y, pageW - REPORT_MARGIN_X, y);
        y += 8;
        return { startY: y, pageW, pageH: doc.internal.pageSize.getHeight(), centerX };
    };
    const addStyledFilterTable = (doc, startY, filterSourceOverride = null, filterRowSnapshot = null) => {
        const base = getPdfTableBase(doc);
        const cw = pdfContentWidthMm(doc);
        autoTable(doc, {
            ...base,
            startY,
            head: [['Parameter', 'Value']],
            body: activeFilterEntries(filterSourceOverride, filterRowSnapshot),
            columnStyles: {
                0: { cellWidth: cw * 0.38, halign: 'left', fontStyle: 'bold', textColor: [71, 85, 105] },
                1: { cellWidth: cw * 0.58, halign: 'right', textColor: [15, 23, 42] },
            },
        });
        return doc.lastAutoTable.finalY + 10;
    };
    const addPdfPageFooters = (doc) => {
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const centerX = pageW / 2;
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.25);
            doc.line(REPORT_MARGIN_X, pageH - 14, pageW - REPORT_MARGIN_X, pageH - 14);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('RETC Training Management', centerX, pageH - 9, { align: 'center' });
            doc.text(`Page ${i} of ${totalPages}`, centerX, pageH - 5, { align: 'center' });
        }
    };
    const activeFilterEntries = (src = null, fOverride = null) => {
        const f = fOverride ?? filters;
        const progList = src?.programs ?? programs;
        const partList = src?.partners ?? partners;
        const trainList = src?.trainers ?? trainers;
        const programLabel = f.programId === 'all'
            ? COURSE_MODULE_LABELS.filterAll
            : (progList.find((p) => p.$id === f.programId)?.title || f.programId);
        const partnerLabel = f.partnerId === 'all'
            ? 'All partners'
            : (findPartnerById(partList, f.partnerId)?.name || f.partnerId);
        const trainerLabel = f.trainerId === 'all'
            ? RETC_FACILITATOR_LABELS.filterAll
            : (findTrainerById(trainList, f.trainerId)?.name || f.trainerId);
        const courseLabel = f.course === 'all' ? COURSE_MODULE_LABELS.filterAllCategories : getCourseLabel(f.course);
        return [
            ['Year', f.year === 'all' ? 'All years' : String(f.year)],
            [COURSE_MODULE_LABELS.reportFilterLabel, programLabel],
            ['Course', courseLabel],
            ['Gender', f.gender === 'all' ? 'All genders' : String(f.gender)],
            ['District', f.district === 'all' ? 'All districts' : String(f.district)],
            [RETC_FACILITATOR_LABELS.reportFilterLabel, trainerLabel],
            ['Partner', partnerLabel],
        ];
    };
    const reportYears = useMemo(() => collectReportYears(programs, traineesSnapshot), [programs, traineesSnapshot]);
    useEffect(() => {
        setFilters((prev) => {
            if (prev.year === 'all')
                return prev;
            if (!reportYears.includes(prev.year))
                return { ...prev, year: 'all' };
            return prev;
        });
    }, [reportYears]);
    const generateTraineesReport = async () => {
        try {
            setIsGenerating(true);
            if (!databases || !DB_ID || !COLLECTIONS.TRAINEES) {
                throw new Error('Trainees collection is not configured.');
            }
            const [rawTrainees, enrollmentDocs, programDocs, trainerDocs, partnerDocs, ppDocs] = await Promise.all([
                fetchAllReportDocuments(COLLECTIONS.TRAINEES),
                fetchReportCollectionOrEmpty(COLLECTIONS.ENROLLMENTS, 'enrollments'),
                fetchAllReportDocuments(COLLECTIONS.PROGRAMS),
                COLLECTIONS.TRAINERS ? fetchAllReportDocuments(COLLECTIONS.TRAINERS) : Promise.resolve([]),
                COLLECTIONS.PARTNERS ? fetchAllReportDocuments(COLLECTIONS.PARTNERS) : Promise.resolve([]),
                fetchReportCollectionOrEmpty(COLLECTIONS.PROGRAM_PARTNERS, 'program_partners'),
            ]);
            const enrollmentByTrainee = buildEnrollmentByTrainee(enrollmentDocs);
            const allTrainees = rawTrainees.map((t) => mergeTraineeWithEnrollment(enrollmentByTrainee, t));
            const pdfProgramPartnerMap = buildProgramPartnerMapFromDocs(ppDocs);
            const programByMulti = buildProgramByAnyId(programDocs);
            const programTitleById = buildProgramTitleById(programDocs);
            const programCourseById = Object.fromEntries(programDocs.map((p) => [p.$id, getCourseLabel(getCourseKeyFromProgram(p))]));
            const { rf, trainees, widenNote } = resolveTraineesForPdf(allTrainees, filters, programByMulti, pdfProgramPartnerMap, partnerDocs, trainerDocs);
            if (widenNote) {
                toast({
                    title: 'Filters widened for this PDF',
                    description: widenNote,
                    duration: 10000,
                });
            }
            if (rawTrainees.length === 0) {
                toast({
                    title: 'No trainee records loaded',
                    description: 'Check Appwrite permissions and the trainees collection ID.',
                    variant: 'destructive',
                });
            }
            const rows = trainees.map((t) => [
                t.$id,
                t.name,
                t.email,
                t.phone || '',
                normalizeGender(t.gender),
                t.district || '',
                programTitleById[getProgramIdFromTrainee(t)] || 'Unassigned',
                formatCertificationLabel(t.certification_status || t.certificationStatus),
                t.qualification || '',
                t.next_of_kin_name || '',
                t.next_of_kin_phone || '',
                t.consent_given ? 'Yes' : 'No',
                t.consent_date ? new Date(t.consent_date).toLocaleDateString() : '',
                formatStatusLabelForPdf(t.status),
                new Date(t.$createdAt || t.created_at).toLocaleDateString(),
            ]);
            const doc = new jsPDF('l', 'mm', 'a4');
            const { startY } = await layoutStyledReportHeader(doc, 'Trainees report');
            const cw = pdfContentWidthMm(doc);
            const filterSrc = { programs: programDocs, partners: partnerDocs, trainers: trainerDocs };
            let yNext = addStyledFilterTable(doc, startY, filterSrc, rf);
            const levelByCategory = buildLevelByCourseCategory(trainees, programByMulti, getProgramIdFromTrainee);
            const base = getPdfTableBase(doc);
            if (levelByCategory.grandTotal > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(51, 65, 85);
                doc.text('PARTICIPANT LEVEL (SUMMARY)', REPORT_MARGIN_X, yNext);
                yNext += 7;
                autoTable(doc, {
                    ...base,
                    startY: yNext,
                    head: [['Level', 'Count', '% of trainees in report']],
                    body: levelSummaryPdfRows(levelByCategory.levelSummary),
                    columnStyles: {
                        0: { cellWidth: cw * 0.4, halign: 'left', textColor: [15, 23, 42] },
                        1: { halign: 'right', fontStyle: 'bold' },
                        2: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
                    },
                });
                yNext = doc.lastAutoTable.finalY + 10;
                const levelMatrixRows = levelByCategory.tableRows.length > 0
                    ? levelByCategoryPdfRows(levelByCategory.tableRows)
                    : [['No level data in scope', '—', '—', '—', '—', '—']];
                const levelTableH = estimatePdfTableHeightMm(levelMatrixRows.length);
                yNext = reservePdfVerticalSpace(doc, yNext, 7 + levelTableH);
                yNext = drawPdfSectionHeading(doc, 'LEVEL BY COURSE CATEGORY', REPORT_MARGIN_X, yNext);
                autoTable(doc, {
                    ...base,
                    theme: 'grid',
                    tableWidth: cw,
                    startY: yNext,
                    head: [[
                        COURSE_MODULE_LABELS.categoryFilterLabel,
                        'Beginner (share of row)',
                        'Technician (share of row)',
                        'Trainer (share of row)',
                        'Total',
                        '% of all trainees',
                    ]],
                    body: levelMatrixRows,
                    headStyles: { ...base.headStyles, fontSize: 8 },
                    styles: { ...base.styles, fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: cw * 0.28, halign: 'left' },
                        1: { halign: 'right' },
                        2: { halign: 'right' },
                        3: { halign: 'right' },
                        4: { halign: 'right', fontStyle: 'bold' },
                        5: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
                    },
                });
                yNext = doc.lastAutoTable.finalY + 12;
            }
            if (trainees.length > 0) {
                yNext = appendGenderReportSections(doc, yNext, {
                    marginX: REPORT_MARGIN_X,
                    contentWidth: cw,
                    tableBase: base,
                    trainees,
                    programById: programByMulti,
                });
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            const traineeSectionTitle = trainees.length === 1
                ? 'Registered trainees: 1 person'
                : `Registered trainees: ${trainees.length} people`;
            doc.text(traineeSectionTitle, REPORT_MARGIN_X, yNext);
            yNext += 7;
            const headStylesData = {
                ...base.headStyles,
                fillColor: [255, 136, 41],
                fontSize: 8,
                halign: 'left',
            };
            const emptyTableMsg = rawTrainees.length === 0
                ? 'No trainee records were returned from the database.'
                : allTrainees.length === 0
                    ? 'No trainee records were returned from the database.'
                    : 'No trainees could be included after widening filters. Check enrollments and course links in Appwrite.';
            const body = trainees.length > 0
                ? trainees.map((t) => {
                    const pid = getProgramIdFromTrainee(t);
                    return [
                        t.name,
                        t.email,
                        t.phone || '',
                        normalizeGender(t.gender),
                        t.district || '',
                        programTitleById[pid] || 'Unassigned',
                        programCourseById[pid] || getCourseLabel(''),
                        getTraineeLevelLabel(t.trainee_level_label ? t.trainee_level : t),
                        formatCertificationLabel(t.certification_status || t.certificationStatus),
                        formatStatusLabelForPdf(t.status),
                    ];
                })
                : [[{
                        content: emptyTableMsg,
                        colSpan: 10,
                        styles: { halign: 'center', fontStyle: 'italic', textColor: [100, 116, 139] },
                    }]];
            autoTable(doc, {
                ...base,
                startY: yNext,
                tableWidth: cw,
                styles: {
                    ...base.styles,
                    fontSize: 8,
                    overflow: 'linebreak',
                    cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
                    valign: 'top',
                },
                head: [[
                    'Name',
                    'Email',
                    'Phone',
                    'Gender',
                    'District',
                    COURSE_MODULE_LABELS.reportFilterLabel,
                    'Category',
                    'Level',
                    'Certification',
                    'Status',
                ]],
                body,
                headStyles: { ...headStylesData, fontSize: 7.5 },
                columnStyles: buildTraineesReportColumnStyles(cw),
            });
            addPdfPageFooters(doc);
            const programTitle = rf.programId === 'all'
                ? ''
                : (programDocs.find((p) => p.$id === rf.programId)?.title || '');
            const partnerName = rf.partnerId === 'all'
                ? ''
                : (findPartnerById(partnerDocs, rf.partnerId)?.name || '');
            const trainerName = rf.trainerId === 'all'
                ? ''
                : (findTrainerById(trainerDocs, rf.trainerId)?.name || '');
            doc.save(buildTraineesReportFilename(rf, {
                programTitle,
                partnerName,
                trainerName,
                courseLabel: rf.course === 'all' ? '' : getCourseLabel(rf.course),
            }));
        }
        catch (error) {
            console.error('Error generating report:', error);
            toast({
                title: 'Report failed',
                description: error instanceof Error ? error.message : 'Failed to generate trainees report.',
                variant: 'destructive',
            });
        }
        finally {
            setIsGenerating(false);
        }
    };
    const generateProgramsReport = async () => {
        try {
            setIsGenerating(true);
            if (!databases || !DB_ID || !COLLECTIONS.PROGRAMS) {
                throw new Error('Courses collection is not configured.');
            }
            const allPrograms = await fetchAllReportDocuments(COLLECTIONS.PROGRAMS);
            const { rf, programs: programList, widenNote: programsWidenNote } = resolveProgramsForPdf(allPrograms, filters, trainers, partners, programPartnerMap);
            if (programsWidenNote) {
                toast({
                    title: 'Filters widened for this PDF',
                    description: programsWidenNote,
                    duration: 10000,
                });
            }
            const partnerById = buildPartnerLabelMap(partners);
            const rows = programList.map((p) => [
                p.$id,
                p.title,
                getCourseLabel(getCourseKeyFromProgram(p)),
                p.training_partner || p.trainingPartner || partnerById[getRelationshipId(p.training_partner_id || p.trainingPartnerId)] || '',
                getOtherPartnerNamesForProgram(p.$id, programPartnerMap, partnerById),
                p.training_location || p.trainingLocation || p.location || p.venue || '',
                p.description || '',
                new Date(p.start_date || p.startDate || p['start-date']).toLocaleDateString(),
                getTrainingPeriodWeeks(p),
                p.max_capacity ?? p.maxCapacity ?? '',
                p.status,
                new Date(p.$createdAt || p.created_at).toLocaleDateString(),
            ]);
            const doc = new jsPDF('l', 'mm', 'a4');
            const { startY } = await layoutStyledReportHeader(doc, 'Courses report');
            const cw = pdfContentWidthMm(doc);
            let yNext = addStyledFilterTable(doc, startY, null, rf);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            const programSectionTitle = programList.length === 1
                ? 'Training courses: 1 course'
                : `Training courses: ${programList.length} courses`;
            doc.text(programSectionTitle, REPORT_MARGIN_X, yNext);
            yNext += 7;
            const base = getPdfTableBase(doc);
            const headStylesData = {
                ...base.headStyles,
                fillColor: [255, 136, 41],
                fontSize: 7.5,
                halign: 'left',
                valign: 'middle',
                cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
            };
            const progBody = programList.length > 0
                ? rows.map((r) => [r[1], r[2], r[3], r[4], r[5], r[7], r[8], r[9], formatStatusLabelForPdf(r[10])])
                : [[{
                        content: `No ${COURSE_MODULE_LABELS.modulePlural} match the selected filters.`,
                        colSpan: 9,
                        styles: { halign: 'center', fontStyle: 'italic', textColor: [100, 116, 139] },
                    }]];
            autoTable(doc, {
                ...base,
                startY: yNext,
                tableWidth: cw,
                styles: {
                    ...base.styles,
                    fontSize: 8,
                    overflow: 'linebreak',
                    cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
                    valign: 'top',
                },
                head: [[
                    COURSE_MODULE_LABELS.reportFilterLabel,
                    'Category',
                    'Training partner',
                    'Other partners',
                    'Location',
                    'Start',
                    'Weeks',
                    'Cap.',
                    'Status',
                ]],
                body: progBody,
                headStyles: headStylesData,
                columnStyles: buildProgramsReportColumnStyles(cw),
            });
            addPdfPageFooters(doc);
            const programTitle = rf.programId === 'all'
                ? ''
                : (programs.find((p) => p.$id === rf.programId)?.title || '');
            const partnerName = rf.partnerId === 'all'
                ? ''
                : (findPartnerById(partners, rf.partnerId)?.name || '');
            const trainerName = rf.trainerId === 'all'
                ? ''
                : (findTrainerById(trainers, rf.trainerId)?.name || '');
            doc.save(buildProgramsReportFilename(rf, {
                programTitle,
                partnerName,
                trainerName,
                courseLabel: rf.course === 'all' ? '' : getCourseLabel(rf.course),
            }));
        }
        catch (error) {
            console.error('Error generating report:', error);
            toast({
                title: 'Report failed',
                description: error instanceof Error ? error.message : 'Failed to generate programs report.',
                variant: 'destructive',
            });
        }
        finally {
            setIsGenerating(false);
        }
    };
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-gray-600">Generate filtered PDF reports with percentage summaries and participant level by course category</p>
      </div>

      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Report filters</h3>
        <ReportFilterFields
          filters={filters}
          onFilterChange={handleFilterChange}
          reportYears={reportYears}
          programs={programs}
          trainers={trainers}
          partners={partners}
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trainees Report */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Trainees Report</h3>
              <p className="text-gray-600 text-sm mt-1">
                Export a branded PDF with active filters and trainee summary rows
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-500 opacity-20"/>
          </div>
          <Button onClick={generateTraineesReport} disabled={isGenerating || !canExportReports} className="w-full">
            <Download className="mr-2 h-4 w-4"/>
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
        </Card>

        {/* Programs Report */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Courses Report</h3>
              <p className="text-gray-600 text-sm mt-1">
                Export a branded PDF with active filters and course schedule rows
              </p>
            </div>
            <FileText className="h-8 w-8 text-green-500 opacity-20"/>
          </div>
          <Button onClick={generateProgramsReport} disabled={isGenerating || !canExportReports} className="w-full">
            <Download className="mr-2 h-4 w-4"/>
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
        </Card>
      </div>

      {/* Report Information */}
      <Card className="p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">Trainees Report</h4>
            <p className="text-gray-600 text-sm mt-1">
              Contains filtered trainee records with contact details, district, gender, qualification, course, course category, and participation status.
            </p>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900">Courses Report</h4>
            <p className="text-gray-600 text-sm mt-1">
              Includes filtered training courses with schedules, maximum capacity, and current status.
            </p>
          </div>
        </div>
      </Card>
    </div>);
}
