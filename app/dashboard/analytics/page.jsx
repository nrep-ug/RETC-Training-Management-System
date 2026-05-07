'use client';
import { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Download, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { buildAnalyticsReportFilename } from '@/lib/pdf-report-naming';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
const COLORS = ['#047857', '#ff8829', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
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
function getProgramIdFromPartnerJoin(row) {
    return getRelationshipId(row.program_id || row.programId || row.program);
}
function getPartnerIdFromPartnerJoin(row) {
    return getRelationshipId(row.partner_id || row.partnerId || row.partner);
}
function getEnrollmentTraineeId(doc) {
    const value = doc.trainee_id || doc.traineeId || doc.trainee || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object')
        return value.$id || value.documentId || value.id || '';
    return '';
}
function getEnrollmentProgramId(doc) {
    const value = doc.program_id || doc.programId || doc.program || '';
    if (typeof value === 'string')
        return value;
    if (value && typeof value === 'object')
        return value.$id || value.documentId || value.id || '';
    return '';
}
/** Primary training partner only (not program_partners join rows). */
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
function getPartnerIdsForProgram(program, programPartnerMap, partnersRaw) {
    const ids = new Set([...(programPartnerMap[program.$id] || [])]);
    getTrainingPartnerIdsForProgram(program, partnersRaw).forEach((id) => ids.add(id));
    return [...ids];
}
function isPartnerActive(partner) {
    const status = String(partner?.status || '').trim().toLowerCase();
    // Treat missing/legacy status as active; only explicit "inactive" is excluded.
    return status !== 'inactive';
}
async function fetchAllDocuments(databases, databaseId, collectionId, { maxDocs = 100000, pageSize = 250 } = {}) {
    if (!databases || !databaseId || !collectionId)
        return [];
    const out = [];
    let cursor = null;
    while (out.length < maxDocs) {
        const queries = [Query.limit(pageSize), Query.orderAsc('$id')];
        if (cursor)
            queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(databaseId, collectionId, queries, undefined, true);
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
    const [programPartnerMap, setProgramPartnerMap] = useState({});
    const [filters, setFilters] = useState({
        year: 'all',
        programId: 'all',
        gender: 'all',
        district: '',
        trainingPartnerId: 'all',
    });
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    const loadAnalyticsData = async (mode = 'initial') => {
        try {
            if (mode === 'initial')
                setIsLoading(true);
            else
                setIsRefreshing(true);
            const [traineeDocs, programDocs, trainerDocs, partnerDocs, programPartnerDocs, enrollmentDocs] = await Promise.all([
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINEES),
                fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAMS),
                COLLECTIONS.TRAINERS
                    ? fetchAllDocuments(databases, DB_ID, COLLECTIONS.TRAINERS)
                    : Promise.resolve([]),
                COLLECTIONS.PARTNERS
                    ? fetchAllDocuments(databases, DB_ID, COLLECTIONS.PARTNERS)
                    : Promise.resolve([]),
                COLLECTIONS.PROGRAM_PARTNERS
                    ? fetchAllDocuments(databases, DB_ID, COLLECTIONS.PROGRAM_PARTNERS)
                    : Promise.resolve([]),
                COLLECTIONS.ENROLLMENTS
                    ? fetchAllDocuments(databases, DB_ID, COLLECTIONS.ENROLLMENTS)
                    : Promise.resolve([]),
            ]);
            const enrollmentByTrainee = {};
            enrollmentDocs.forEach((e) => {
                const tid = getEnrollmentTraineeId(e);
                const pid = getEnrollmentProgramId(e);
                if (tid && pid)
                    enrollmentByTrainee[tid] = pid;
            });
            const mergedTrainees = traineeDocs.map((t) => ({
                ...t,
                program_id: enrollmentByTrainee[t.$id]
                    || t.program_id
                    || t.programId
                    || (t.program && typeof t.program === 'object'
                        ? (t.program.$id || t.program.documentId || t.program.id || '')
                        : '')
                    || '',
            }));
            setTraineesRaw(mergedTrainees);
            setProgramsRaw(programDocs);
            setTrainersRaw(trainerDocs);
            setPartnersRaw(partnerDocs);
            const map = {};
            programPartnerDocs.forEach((row) => {
                const programId = getProgramIdFromPartnerJoin(row);
                const partnerId = getPartnerIdFromPartnerJoin(row);
                if (!programId || !partnerId)
                    return;
                if (!map[programId]) {
                    map[programId] = [];
                }
                if (!map[programId].includes(partnerId)) {
                    map[programId].push(partnerId);
                }
            });
            setProgramPartnerMap(map);
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
    const programById = useMemo(() => Object.fromEntries(programsRaw.map((p) => [p.$id, p])), [programsRaw]);
    const filteredPrograms = useMemo(() => programsRaw.filter((p) => {
        const programOk = filters.programId === 'all' || p.$id === filters.programId;
        const trainingIds = getTrainingPartnerIdsForProgram(p, partnersRaw);
        const trainingOk = filters.trainingPartnerId === 'all' || trainingIds.includes(filters.trainingPartnerId);
        return programOk && trainingOk;
    }), [programsRaw, filters.programId, filters.trainingPartnerId, partnersRaw]);
    const allowedProgramIds = useMemo(() => new Set(filteredPrograms.map((p) => p.$id)), [filteredPrograms]);
    const filteredTrainees = useMemo(() => traineesRaw.filter((t) => {
        const traineeProgramId = getProgramIdFromTrainee(t);
        const createdYear = getYearFromDate(t.$createdAt || t.created_at);
        const progYear = getProgramStartYear(programById[traineeProgramId]);
        const yearOk = filters.year === 'all' || createdYear === filters.year || progYear === filters.year;
        const genderOk = filters.gender === 'all' || normalizeGender(t.gender).toLowerCase() === filters.gender;
        const programOk = (filters.programId === 'all' && filters.trainingPartnerId === 'all')
            || allowedProgramIds.has(traineeProgramId);
        const districtOk = !filters.district.trim()
            || String(t.district || '').toLowerCase().includes(filters.district.trim().toLowerCase());
        return yearOk && genderOk && programOk && districtOk;
    }), [traineesRaw, filters, allowedProgramIds, programById]);
    const stats = useMemo(() => {
        const completedCount = filteredTrainees.filter((t) => String(t.status || '').toLowerCase() === 'completed').length;
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
            enrolledCount: filteredTrainees.length - completedCount,
            completedCount,
            certifiedCount,
            totalTrainees: filteredTrainees.length,
            activePartners: activePartnersCount,
            avgTrainingWeeks,
        };
    }, [filteredTrainees, filteredPrograms, partnersRaw, filters.trainingPartnerId]);
    const data = useMemo(() => {
        const statusMap = { upcoming: 0, ongoing: 0, completed: 0 };
        filteredPrograms.forEach((p) => {
            const key = String(p.status || '').toLowerCase();
            if (key in statusMap)
                statusMap[key]++;
        });
        const programStatus = Object.entries(statusMap).map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }));
        const genderMap = { Male: 0, Female: 0, Other: 0 };
        filteredTrainees.forEach((t) => { genderMap[normalizeGender(t.gender)]++; });
        const genderDistribution = Object.entries(genderMap).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
        const districtMap = {};
        filteredTrainees.forEach((t) => {
            const district = String(t.district || 'Unknown').trim() || 'Unknown';
            districtMap[district] = (districtMap[district] || 0) + 1;
        });
        const districtDistribution = Object.entries(districtMap).map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count).slice(0, 10);
        const programTitleById = Object.fromEntries(filteredPrograms.map((p) => [p.$id, p.title || 'Untitled']));
        const attendanceMap = {};
        filteredTrainees.forEach((t) => {
            const label = programTitleById[getProgramIdFromTrainee(t)] || 'Unassigned';
            attendanceMap[label] = (attendanceMap[label] || 0) + 1;
        });
        const courseAttendance = Object.entries(attendanceMap).map(([course, trainees]) => ({ course, trainees })).sort((a, b) => b.trainees - a.trainees).slice(0, 8);
        const certificationMap = { Certified: 0, Pending: 0, 'Not Certified': 0 };
        filteredTrainees.forEach((t) => {
            const label = normalizeCertificationStatus(t.certification_status || t.certificationStatus);
            certificationMap[label] = (certificationMap[label] || 0) + 1;
        });
        const certificationDistribution = Object.entries(certificationMap).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
        const trainerRoleMap = { trainer: 0, senior_trainer: 0 };
        trainersRaw.forEach((trainer) => {
            const role = String(trainer.role || '').toLowerCase();
            if (role in trainerRoleMap)
                trainerRoleMap[role]++;
        });
        const trainerRoleDistribution = [{ name: 'Trainer', count: trainerRoleMap.trainer }, { name: 'Senior Trainer', count: trainerRoleMap.senior_trainer }];
        const yearlyMap = {};
        filteredTrainees.forEach((t) => {
            const pid = getProgramIdFromTrainee(t);
            const year = getProgramStartYear(programById[pid])
                || getYearFromDate(t.$createdAt || t.created_at);
            if (!year)
                return;
            yearlyMap[year] = (yearlyMap[year] || 0) + 1;
        });
        const yearlyParticipation = Object.entries(yearlyMap).sort(([a], [b]) => Number(a) - Number(b)).map(([year, participants]) => ({ year, participants }));
        const partnerById = Object.fromEntries(partnersRaw.map((p) => [p.$id, p.name || 'Unnamed Partner']));
        const partnerMap = {};
        filteredPrograms.forEach((p) => {
            const linkedIds = new Set(getPartnerIdsForProgram(p, programPartnerMap, partnersRaw));
            linkedIds.forEach((id) => {
                const label = partnerById[id] || 'Unknown Partner';
                partnerMap[label] = (partnerMap[label] || 0) + 1;
            });
        });
        const partnerContribution = Object.entries(partnerMap)
            .map(([partner, programs]) => ({ partner, programs }))
            .sort((a, b) => b.programs - a.programs)
            .slice(0, 8);
        return { programStatus, genderDistribution, districtDistribution, courseAttendance, certificationDistribution, trainerRoleDistribution, yearlyParticipation, partnerContribution };
    }, [filteredTrainees, filteredPrograms, trainersRaw, partnersRaw, programPartnerMap, programById]);
    const years = useMemo(() => {
        const set = new Set();
        traineesRaw.forEach((t) => {
            const y = getYearFromDate(t.$createdAt || t.created_at);
            if (y)
                set.add(y);
            const pid = getProgramIdFromTrainee(t);
            const py = pid ? getProgramStartYear(programById[pid]) : '';
            if (py)
                set.add(py);
        });
        return Array.from(set).sort((a, b) => Number(b) - Number(a));
    }, [traineesRaw, programById]);
    const chartCards = useMemo(() => {
        const cards = [];
        if (data.programStatus.length > 0) {
            cards.push({
                id: 'programStatus',
                title: 'Program Status Distribution',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.programStatus}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="name"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#047857"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.genderDistribution.length > 0) {
            cards.push({
                id: 'genderDistribution',
                title: 'Participant Gender Distribution',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={data.genderDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={90} fill="#8884d8" dataKey="value">
                      {data.genderDistribution.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>),
            });
        }
        if (data.partnerContribution.length > 0) {
            cards.push({
                id: 'partnerContribution',
                title: 'Partner Contribution (Programs)',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.partnerContribution}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="partner"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="programs" fill="#ff8829"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.districtDistribution.length > 0) {
            cards.push({
                id: 'districtDistribution',
                title: 'Trainee Distribution by District (Top 10)',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.districtDistribution}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="district"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ff8829"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.courseAttendance.length > 0) {
            cards.push({
                id: 'courseAttendance',
                title: 'Most Attended Courses',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.courseAttendance}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="course"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="trainees" fill="#047857"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.certificationDistribution.length > 0) {
            cards.push({
                id: 'certificationDistribution',
                title: 'Certification Status',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.certificationDistribution}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="name"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.trainerRoleDistribution.length > 0) {
            cards.push({
                id: 'trainerRoleDistribution',
                title: 'Trainer Involvement (Role Comparison)',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.trainerRoleDistribution}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="name"/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ff8829"/>
                  </BarChart>
                </ResponsiveContainer>),
            });
        }
        if (data.yearlyParticipation.length > 0) {
            cards.push({
                id: 'yearlyParticipation',
                title: 'Participation Trends Over Time (Yearly)',
                element: (<ResponsiveContainer width="100%" height={230}>
                  <LineChart data={data.yearlyParticipation}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="year"/>
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="participants" stroke="#047857" dot={{ fill: '#047857' }} name="Participants"/>
                  </LineChart>
                </ResponsiveContainer>),
            });
        }
        return cards;
    }, [data]);
    useEffect(() => {
        if (activeChartIndex > chartCards.length - 1) {
            setActiveChartIndex(0);
        }
    }, [chartCards.length, activeChartIndex]);
    const exportAnalyticsReport = async () => {
        try {
            const programLabel = filters.programId === 'all'
                ? 'All programs'
                : (programsRaw.find((p) => p.$id === filters.programId)?.title || filters.programId);
            const trainingPartnerLabel = filters.trainingPartnerId === 'all'
                ? 'All training partners'
                : (partnersRaw.find((p) => p.$id === filters.trainingPartnerId)?.name || filters.trainingPartnerId);
            const yearLabel = filters.year === 'all' ? 'All years' : String(filters.year);
            const genderLabel = filters.gender === 'all' ? 'All genders' : String(filters.gender);
            const districtLabel = filters.district.trim() ? filters.district.trim() : 'All districts';
            const downloadName = buildAnalyticsReportFilename(filters, {
                programTitle: filters.programId === 'all' ? '' : programLabel,
                trainingPartnerName: filters.trainingPartnerId === 'all' ? '' : trainingPartnerLabel,
            });
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
                body: [
                    ['Year', yearLabel],
                    ['Program', programLabel],
                    ['Training partner', trainingPartnerLabel],
                    ['Gender', genderLabel],
                    ['District', districtLabel],
                ],
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
                    ['Trainees enrolled (active)', String(stats.enrolledCount)],
                    ['Trainees completed', String(stats.completedCount)],
                    ['Trainees certified', String(stats.certifiedCount)],
                    ['Total trainees (in scope)', String(stats.totalTrainees)],
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
            doc.text('COURSE ATTENDANCE (TOP COURSES)', marginX, y);
            y += 7;
            const courseRows = data.courseAttendance.length > 0
                ? data.courseAttendance.map((item) => [item.course, String(item.trainees)])
                : [['No course-level data in scope', '—']];
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Course / program', 'Trainees']],
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
            doc.text('CERTIFICATION STATUS', marginX, y);
            y += 7;
            const certRows = data.certificationDistribution.length > 0
                ? data.certificationDistribution.map((item) => [item.name, String(item.value)])
                : [['No certification data in scope', '—']];
            autoTable(doc, {
                ...tableBase,
                startY: y,
                head: [['Certification status', 'Trainees']],
                body: certRows,
                columnStyles: {
                    0: { cellWidth: contentW * 0.62, halign: 'left', textColor: [15, 23, 42] },
                    1: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
                },
            });
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.25);
                doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text('RETC Training Management', centerX, pageH - 9, { align: 'center' });
                doc.text(`Page ${i} of ${totalPages}`, centerX, pageH - 5, { align: 'center' });
            }
            doc.save(downloadName);
        }
        catch (error) {
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
    return (<div className="space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-[#047857]/20 bg-gradient-to-r from-[#047857] via-[#0b8d68] to-[#ff8829] p-4 text-white shadow-[0_22px_45px_-24px_rgba(4,120,87,0.8)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-full">
            <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Analytics</h1>
            <p className="mt-2 text-sm text-white/90 sm:text-base">Training insights for programs, trainees, trainers, and participation trends</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Button onClick={exportAnalyticsReport} className="w-full bg-white text-[#047857] hover:bg-white/90 sm:w-auto">
            <Download className="mr-2 h-4 w-4"/>
            Download Analytics PDF
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
      <Card className="border-[#047857]/20 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Analytics Filters</h2>
          <span className="text-xs text-slate-500 sm:text-right">Refine by period, demographics, and training partner</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="min-w-0 space-y-2">
            <Label>Year</Label>
            <p className="text-xs text-slate-500">Registration or program start year</p>
            <Select value={filters.year} onValueChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}>
              <SelectTrigger className="w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((year) => (<SelectItem key={year} value={year}>{year}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Program</Label>
            <Select value={filters.programId} onValueChange={(value) => setFilters((prev) => ({ ...prev, programId: value }))}>
              <SelectTrigger className="w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {programsRaw.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.title || 'Untitled'}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Training partner</Label>
            <Select value={filters.trainingPartnerId} onValueChange={(value) => setFilters((prev) => ({ ...prev, trainingPartnerId: value }))}>
              <SelectTrigger className="w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All training partners</SelectItem>
                {partnersRaw.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.name || 'Unnamed Partner'}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Gender</Label>
            <Select value={filters.gender} onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))}>
              <SelectTrigger className="w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <Input placeholder="Filter district" value={filters.district} onChange={(e) => setFilters((prev) => ({ ...prev, district: e.target.value }))}/>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-emerald-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Trainings Conducted</p><p className="mt-2 text-3xl font-bold text-gray-900">{stats.trainingsConducted}</p></Card>
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-emerald-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Trainees Enrolled</p><p className="mt-2 text-3xl font-bold text-gray-900">{stats.enrolledCount}</p></Card>
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-emerald-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Trainees Completed</p><p className="mt-2 text-3xl font-bold text-[#047857]">{stats.completedCount}</p></Card>
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-orange-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Total Trainees</p><p className="mt-2 text-3xl font-bold text-[#ff8829]">{stats.totalTrainees}</p></Card>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-emerald-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Active Partners</p><p className="mt-2 text-3xl font-bold text-[#047857]">{stats.activePartners}</p></Card>
        <Card className="border-[#047857]/20 bg-gradient-to-b from-white to-orange-50/40 p-6 shadow-sm"><p className="text-sm font-medium text-gray-600">Average Training Period (Weeks)</p><p className="mt-2 text-3xl font-bold text-[#ff8829]">{stats.avgTrainingWeeks}</p></Card>
      </div>
      {chartCards.length > 0 && (<Card className="border-[#047857]/20 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{chartCards[activeChartIndex]?.title}</h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setActiveChartIndex((prev) => (prev - 1 + chartCards.length) % chartCards.length)} aria-label="Previous chart">
                <ChevronLeft className="h-4 w-4"/>
              </Button>
              <span className="text-xs text-slate-500">
                {activeChartIndex + 1} / {chartCards.length}
              </span>
              <Button type="button" variant="outline" size="icon" onClick={() => setActiveChartIndex((prev) => (prev + 1) % chartCards.length)} aria-label="Next chart">
                <ChevronRight className="h-4 w-4"/>
              </Button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {chartCards.map((chart, idx) => (<Button key={chart.id} type="button" variant={idx === activeChartIndex ? 'default' : 'outline'} size="sm" className={idx === activeChartIndex ? 'bg-[#047857] hover:bg-[#036b4c]' : ''} onClick={() => setActiveChartIndex(idx)}>
                {chart.title}
              </Button>))}
          </div>
          {chartCards[activeChartIndex]?.element}
        </Card>)}
    </div>);
}
