'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { getCourseFilterSelectOptions } from '@/lib/renewable-energy-courses';

/**
 * Shared analytics data filters. Every dropdown includes an explicit "All …" option (value `all`).
 */
export function AnalyticsFilterFields({
    filters,
    onFiltersChange,
    years = [],
    programsRaw = [],
    partnersRaw = [],
    districtOptions = [],
    compact = false,
}) {
    const set = (patch) => onFiltersChange((prev) => ({ ...prev, ...patch }));

    const row1 = (
        <div className={`grid grid-cols-1 gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'gap-4 sm:grid-cols-2 lg:grid-cols-4'}`}>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>Year</Label>
                {!compact && <p className="text-xs text-slate-500">Registration or course start year</p>}
                <Select value={filters.year} onValueChange={(value) => set({ year: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All years" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {years.map((year) => (<SelectItem key={year} value={year}>{year}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>{COURSE_MODULE_LABELS.reportFilterLabel}</Label>
                <Select value={filters.programId} onValueChange={(value) => set({ programId: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder={COURSE_MODULE_LABELS.filterAll} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{COURSE_MODULE_LABELS.filterAll}</SelectItem>
                        {programsRaw.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.title || 'Untitled'}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>Training partner</Label>
                <Select value={filters.trainingPartnerId} onValueChange={(value) => set({ trainingPartnerId: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All partners" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All partners</SelectItem>
                        {partnersRaw.map((p) => (<SelectItem key={p.$id} value={p.$id}>{p.name || 'Unnamed Partner'}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>District</Label>
                <Select value={filters.district} onValueChange={(value) => set({ district: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All districts" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All districts</SelectItem>
                        {districtOptions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const row2 = (
        <div className={`grid grid-cols-1 gap-3 ${compact ? 'sm:grid-cols-2' : 'gap-4 sm:grid-cols-2'}`}>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>{COURSE_MODULE_LABELS.categoryFilterLabel}</Label>
                <Select value={filters.course} onValueChange={(value) => set({ course: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder={COURSE_MODULE_LABELS.filterAllCategories} /></SelectTrigger>
                    <SelectContent>
                        {getCourseFilterSelectOptions().map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
                <Label className={compact ? 'text-xs' : undefined}>Gender</Label>
                <Select value={filters.gender} onValueChange={(value) => set({ gender: value })}>
                    <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All genders" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All genders</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    return (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
            {row1}
            {row2}
        </div>
    );
}
