'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ProgramStatus } from '@/lib/types';
import { getCourseFormSelectOptions, getCourseKeyFromProgram } from '@/lib/renewable-energy-courses';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { partnerDocumentId } from '@/lib/program-partner-sync';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
const PROGRAM_TITLE_MAX = 100;
const PROGRAM_DESCRIPTION_MAX = 400;
export function ProgramDialog({ open, onOpenChange, program, onSave, trainers = [], partners = [], isTrainersLoading = false, isPartnersLoading = false, }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;
    const [formData, setFormData] = useState({
        title: '',
        course: '',
        training_partner: '',
        training_partner_id: '',
        training_partner_ids: [],
        partner_ids: [],
        description: '',
        training_location: '',
        start_date: '',
        training_period_weeks: '',
        trainer_id: '',
        max_capacity: '',
        status: ProgramStatus.UPCOMING,
    });
    const lastProgramKeyRef = useRef('');
    useEffect(() => {
        const key = program?.$id ? `edit:${program.$id}` : 'new';
        if (!open) {
            lastProgramKeyRef.current = '';
            return;
        }
        const shouldInit = key !== lastProgramKeyRef.current;
        if (!shouldInit)
            return;
        lastProgramKeyRef.current = key;
        setSubmitError('');
        setCurrentStep(1);
        if (program) {
            const startDate = program.start_date || program.startDate || '';
            const endDate = program.end_date || program.endDate || '';
            let durationWeeks = '';
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffMs = end.getTime() - start.getTime();
                if (!Number.isNaN(diffMs) && diffMs >= 0) {
                    durationWeeks = String(Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))));
                }
            }
            const maxCapacity = program.max_capacity ?? program.maxCapacity ?? '';
            const trainerValue = program.trainer_id
                || program.trainerId
                || (program.trainer && typeof program.trainer === 'object'
                    ? (program.trainer.$id || program.trainer.documentId || program.trainer.id || '')
                    : program.trainer)
                || '';
            setFormData({
                title: program.title,
                course: getCourseKeyFromProgram(program),
                training_partner: program.training_partner || program.trainingPartner || program['training-partners'] || program.training_partners || '',
                training_partner_id: program.training_partner_id || program.trainingPartnerId || '',
                training_partner_ids: (() => {
                    const fromArray = Array.isArray(program.training_partner_ids) ? program.training_partner_ids : [];
                    if (fromArray.length > 0)
                        return fromArray.map((id) => String(id || '').trim()).filter(Boolean);
                    const legacy = program.training_partner_id
                        || program.trainingPartnerId
                        || (program['training-partners'] && typeof program['training-partners'] === 'object'
                            ? (program['training-partners'].$id || program['training-partners'].documentId || program['training-partners'].id || '')
                            : '')
                        || '';
                    return legacy ? [String(legacy).trim()] : [];
                })(),
                partner_ids: (() => {
                    const raw = Array.isArray(program.partner_ids) ? program.partner_ids : [];
                    const trainingSet = new Set(
                        (Array.isArray(program.training_partner_ids) ? program.training_partner_ids : [])
                            .concat(program.training_partner_id ? [program.training_partner_id] : [])
                            .map((id) => String(id || '').trim())
                            .filter(Boolean),
                    );
                    return raw.map((id) => String(id || '').trim()).filter((id) => id && !trainingSet.has(id));
                })(),
                description: program.description || '',
                training_location: program.training_location || program.trainingLocation || program.location || program.venue || '',
                start_date: startDate ? String(startDate).split('T')[0] : '',
                training_period_weeks: durationWeeks,
                trainer_id: trainerValue,
                max_capacity: String(maxCapacity),
                status: program.status,
            });
        }
        else {
            setFormData({
                title: '',
                course: '',
                training_partner: '',
                training_partner_id: '',
                partner_ids: [],
                description: '',
                training_location: '',
                start_date: '',
                training_period_weeks: '',
                trainer_id: '',
                max_capacity: '',
                status: ProgramStatus.UPCOMING,
            });
        }
    }, [program, open]);
    useEffect(() => {
        if (!open || !program)
            return;
        const nextTrainingIds = (() => {
            const fromArray = Array.isArray(program.training_partner_ids) ? program.training_partner_ids : [];
            if (fromArray.length > 0)
                return fromArray.map((id) => String(id || '').trim()).filter(Boolean);
            const legacy = String(program.training_partner_id || program.trainingPartnerId || '').trim();
            return legacy ? [legacy] : [];
        })();
        const trainingSet = new Set(nextTrainingIds);
        const raw = Array.isArray(program.partner_ids) ? program.partner_ids : [];
        const nextPartnerIds = raw.map((id) => String(id || '').trim()).filter((id) => id && !trainingSet.has(id));
        setFormData((prev) => {
            const prevTraining = [...prev.training_partner_ids].map(String).sort().join(',');
            const nextTraining = [...nextTrainingIds].sort().join(',');
            const prevSorted = [...prev.partner_ids].map(String).sort().join(',');
            const nextSorted = [...nextPartnerIds].sort().join(',');
            if (prevTraining === nextTraining && prevSorted === nextSorted)
                return prev;
            return {
                ...prev,
                training_partner_ids: nextTrainingIds,
                training_partner_id: nextTrainingIds[0] || '',
                partner_ids: nextPartnerIds,
            };
        });
    }, [
        open,
        program?.$id,
        program?.training_partner_id,
        Array.isArray(program?.training_partner_ids) ? program.training_partner_ids.join(',') : '',
        Array.isArray(program?.partner_ids) ? program.partner_ids.join(',') : '',
    ]);
    const validateStep = (step) => {
        if (step === 1 && !String(formData.title || '').trim()) {
            return COURSE_MODULE_LABELS.titleRequired;
        }
        if (step === 1 && !String(formData.course || '').trim()) {
            return COURSE_MODULE_LABELS.categoryRequired;
        }
        if (step === 1 && (!Array.isArray(formData.training_partner_ids) || formData.training_partner_ids.length === 0)) {
            return 'Select at least one training partner.';
        }
        if (step === 2) {
            if (!String(formData.start_date || '').trim()) {
                return 'Start date is required.';
            }
            const weeks = Number(formData.training_period_weeks);
            if (!Number.isInteger(weeks) || weeks <= 0) {
                return 'Training period must be a positive whole number of weeks.';
            }
            return '';
        }
        if (step === 3) {
            const capacity = Number(formData.max_capacity);
            if (!Number.isInteger(capacity) || capacity <= 0) {
                return 'Max capacity must be a positive whole number.';
            }
            return '';
        }
        return '';
    };
    const trainingPartnerIdSet = useMemo(() => new Set(
        (formData.training_partner_ids || []).map((id) => String(id || '').trim()).filter(Boolean),
    ), [formData.training_partner_ids]);
    const otherPartnersList = useMemo(() => partners.filter((p) => {
        const id = partnerDocumentId(p);
        return id && !trainingPartnerIdSet.has(id);
    }), [partners, trainingPartnerIdSet]);
    const isTrainingPartnerChecked = (partner) => {
        const id = partnerDocumentId(partner);
        return id ? trainingPartnerIdSet.has(id) : false;
    };
    const isOtherPartnerChecked = (partner) => {
        const id = partnerDocumentId(partner);
        if (!id)
            return false;
        return formData.partner_ids.some((pid) => String(pid) === id);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(1) || validateStep(2) || validateStep(3);
            if (validationError)
                throw new Error(validationError);
            const weeks = Number(formData.training_period_weeks);
            const startDate = new Date(formData.start_date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (weeks * 7));
            await onSave({
                ...formData,
                max_capacity: parseInt(formData.max_capacity),
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
            });
        }
        catch (error) {
            console.error('Error saving program:', error);
            setSubmitError(error instanceof Error ? error.message : `Failed to save ${COURSE_MODULE_LABELS.moduleSingular}.`);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const toggleTrainingPartner = (partnerId, checked) => {
        setFormData((prev) => {
            const current = new Set(prev.training_partner_ids);
            if (checked)
                current.add(partnerId);
            else
                current.delete(partnerId);
            const training_partner_ids = Array.from(current);
            return {
                ...prev,
                training_partner_ids,
                training_partner_id: training_partner_ids[0] || '',
                partner_ids: prev.partner_ids.filter((id) => !current.has(id)),
            };
        });
    };
    const togglePartner = (partnerId, checked) => {
        setFormData((prev) => {
            const current = new Set(prev.partner_ids);
            if (checked)
                current.add(partnerId);
            else
                current.delete(partnerId);
            return { ...prev, partner_ids: Array.from(current) };
        });
    };
    const handleNext = () => {
        const validationError = validateStep(currentStep);
        if (validationError) {
            setSubmitError(validationError);
            return;
        }
        setSubmitError('');
        setCurrentStep((prev) => Math.min(prev + 1, 3));
    };
    const handleBack = () => {
        setSubmitError('');
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };
    return (<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>{program ? COURSE_MODULE_LABELS.editTitle : COURSE_MODULE_LABELS.addTitle}</DialogTitle>
          <DialogDescription>
            {program
            ? COURSE_MODULE_LABELS.updateDescription
            : COURSE_MODULE_LABELS.createDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => {
            e.preventDefault();
            if (currentStep < totalSteps)
                return;
            void handleSubmit(e);
        }} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 px-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#047857] to-[#ff8829] transition-all duration-300" style={{ width: `${(currentStep / totalSteps) * 100}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {[COURSE_MODULE_LABELS.stepInfo, 'Schedule', 'Assignments'].map((label, idx) => {
            const stepNo = idx + 1;
            const active = currentStep === stepNo;
            const completed = currentStep > stepNo;
            return (<div key={label} className={`rounded-md border px-2 py-1 text-center transition-colors ${completed
                    ? 'border-[#047857]/40 bg-[#047857]/10 text-[#047857]'
                    : active
                        ? 'border-[#ff8829]/40 bg-[#ff8829]/10 text-[#b45309]'
                        : 'border-slate-200 text-slate-500'}`}>
                    {label}
                  </div>);
        })}
            </div>
          </div>
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
          {currentStep === 1 && (<>
          <div className="space-y-2">
            <Label htmlFor="title">{COURSE_MODULE_LABELS.titleField} *</Label>
            <Input id="title" value={formData.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="e.g., Kampala Solar Cohort 2025" disabled={isLoading} maxLength={PROGRAM_TITLE_MAX}/>
            <p className="text-xs text-slate-500">{COURSE_MODULE_LABELS.titleHint}</p>
            <p className="text-xs text-slate-500">{String(formData.title || '').length}/{PROGRAM_TITLE_MAX}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course">{COURSE_MODULE_LABELS.categoryFieldLabel} *</Label>
            <Select value={formData.course || 'none'} onValueChange={(value) => handleChange('course', value === 'none' ? '' : value)}>
              <SelectTrigger disabled={isLoading}>
                <SelectValue placeholder={COURSE_MODULE_LABELS.categoryPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>{COURSE_MODULE_LABELS.categorySelectDisabled}</SelectItem>
                {getCourseFormSelectOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Training partners *</Label>
              <p className="mt-0.5 text-xs text-slate-500">Select all partner organizations delivering this course (one or more).</p>
            </div>
            <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {partners.length === 0 && (<p className="text-sm text-slate-500">
                  {isPartnersLoading ? 'Loading partners...' : 'No partners available'}
                </p>)}
              {partners.map((partner) => {
                const pid = partnerDocumentId(partner);
                return (<label key={pid || partner.$id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={isTrainingPartnerChecked(partner)} onCheckedChange={(checked) => toggleTrainingPartner(pid, checked === true)} disabled={isLoading || isPartnersLoading || !pid}/>
                  <span>{partner.name}</span>
                </label>);
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Other partners</Label>
              <p className="mt-0.5 text-xs text-slate-500">Additional collaborating partners (not listed above).</p>
            </div>
            <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {partners.length === 0 && (<p className="text-sm text-slate-500">
                  {isPartnersLoading ? 'Loading partners...' : 'No partners available'}
                </p>)}
              {partners.length > 0 && otherPartnersList.length === 0 && (<p className="text-sm text-slate-500">
                  No other partners to add — add more partner records, or pick a different partner.
                </p>)}
              {otherPartnersList.map((partner) => {
                const pid = partnerDocumentId(partner);
                return (<label key={pid || partner.$id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={isOtherPartnerChecked(partner)} onCheckedChange={(checked) => togglePartner(pid, checked === true)} disabled={isLoading || isPartnersLoading || !pid}/>
                  <span>{partner.name}</span>
                </label>);
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Course description..." disabled={isLoading} maxLength={PROGRAM_DESCRIPTION_MAX} className="min-h-24 resize-y break-all [overflow-wrap:anywhere]"/>
            <p className="text-xs text-slate-500">{String(formData.description || '').length}/{PROGRAM_DESCRIPTION_MAX}</p>
          </div>
          </>)}

          {currentStep === 2 && (<>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => handleChange('start_date', e.target.value)} disabled={isLoading}/>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="training_period_weeks">Training Period (Weeks) *</Label>
              <Input id="training_period_weeks" type="number" min="1" step="1" value={formData.training_period_weeks} onChange={(e) => handleChange('training_period_weeks', e.target.value)} placeholder="e.g., 4" disabled={isLoading}/>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="training_location">Training Location</Label>
            <Input id="training_location" value={formData.training_location} onChange={(e) => handleChange('training_location', e.target.value)} placeholder="e.g., Kampala Centre" disabled={isLoading}/>
          </div>
          </>)}

          {currentStep === 3 && (<>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="max_capacity">Max Capacity *</Label>
              <Input id="max_capacity" type="number" value={formData.max_capacity} onChange={(e) => handleChange('max_capacity', e.target.value)} placeholder="50" disabled={isLoading}/>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger disabled={isLoading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProgramStatus.UPCOMING}>Upcoming</SelectItem>
                  <SelectItem value={ProgramStatus.ONGOING}>Ongoing</SelectItem>
                  <SelectItem value={ProgramStatus.COMPLETED}>Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer_id">{RETC_FACILITATOR_LABELS.leadOnCourse}</Label>
            <Select value={formData.trainer_id || 'none'} onValueChange={(value) => handleChange('trainer_id', value === 'none' ? '' : value)}>
              <SelectTrigger disabled={isLoading || isTrainersLoading}>
                <SelectValue placeholder={isTrainersLoading ? `Loading ${RETC_FACILITATOR_LABELS.modulePlural}...` : `Select ${RETC_FACILITATOR_LABELS.moduleSingular}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{RETC_FACILITATOR_LABELS.leadOnCourseNone}</SelectItem>
                {trainers.map((trainer) => (<SelectItem key={trainer.$id} value={trainer.$id}>
                    {trainer.name || trainer.email || trainer.$id}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          </>)}
          </div>

          <div className="flex shrink-0 gap-3 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            {currentStep > 1 && (<Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="flex-1">
                Back
              </Button>)}
            {currentStep < 3 ? (<Button type="button" onClick={(e) => {
                    e.preventDefault();
                    handleNext();
                }} disabled={isLoading} className="flex-1">
                Next
              </Button>) : (<Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Saving...' : COURSE_MODULE_LABELS.saveButton}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
