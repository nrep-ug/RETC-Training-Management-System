'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { getCourseFilterSelectOptions } from '@/lib/renewable-energy-courses';

const fieldClass = 'min-w-0 space-y-1';
const labelClass = 'text-xs font-medium text-slate-600';
const triggerClass = 'h-8 w-full text-xs';
const inputClass = 'h-8 text-xs';

/**
 * Compact report PDF filters. Every dropdown includes an explicit "All …" option (value `all`).
 */
export function ReportFilterFields({
    filters,
    onFilterChange,
    reportYears = [],
    programs = [],
    trainers = [],
    partners = [],
}) {
    return (
        <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <div className={fieldClass}>
                    <Label className={labelClass}>Year</Label>
                    <Select value={filters.year} onValueChange={(v) => onFilterChange('year', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder="All years" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {reportYears.map((year) => (<SelectItem key={year} value={year}>{year}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className={fieldClass}>
                    <Label className={labelClass}>{COURSE_MODULE_LABELS.categoryFilterLabel}</Label>
                    <Select value={filters.course} onValueChange={(v) => onFilterChange('course', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder={COURSE_MODULE_LABELS.filterAllCategories} /></SelectTrigger>
                        <SelectContent>
                            {getCourseFilterSelectOptions().map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className={fieldClass}>
                    <Label className={labelClass}>{COURSE_MODULE_LABELS.reportFilterLabel}</Label>
                    <Select value={filters.programId} onValueChange={(v) => onFilterChange('programId', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder={COURSE_MODULE_LABELS.filterAll} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{COURSE_MODULE_LABELS.filterAll}</SelectItem>
                            {programs.map((program) => (
                                <SelectItem key={program.$id} value={program.$id}>{program.title || 'Untitled'}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className={fieldClass}>
                    <Label className={labelClass}>Partner</Label>
                    <Select value={filters.partnerId} onValueChange={(v) => onFilterChange('partnerId', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder="All partners" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All partners</SelectItem>
                            {partners.map((partner) => (
                                <SelectItem key={partner.$id} value={partner.$id}>{partner.name || 'Unnamed Partner'}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className={fieldClass}>
                    <Label className={labelClass}>Gender</Label>
                    <Select value={filters.gender} onValueChange={(v) => onFilterChange('gender', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder="All genders" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All genders</SelectItem>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className={fieldClass}>
                    <Label className={labelClass}>District</Label>
                    <Input
                        className={inputClass}
                        value={filters.district === 'all' ? '' : filters.district}
                        onChange={(e) => onFilterChange('district', e.target.value.trim() ? e.target.value : 'all')}
                        placeholder="All districts"
                    />
                </div>
                <div className={fieldClass}>
                    <Label className={labelClass}>{RETC_FACILITATOR_LABELS.reportFilterLabel}</Label>
                    <Select value={filters.trainerId} onValueChange={(v) => onFilterChange('trainerId', v)}>
                        <SelectTrigger size="sm" className={triggerClass}><SelectValue placeholder={RETC_FACILITATOR_LABELS.filterAll} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{RETC_FACILITATOR_LABELS.filterAll}</SelectItem>
                            {trainers.map((trainer) => (
                                <SelectItem key={trainer.$id} value={trainer.$id}>
                                    {trainer.name || `Unnamed ${RETC_FACILITATOR_LABELS.reportFilterLabel}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
