'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ProgramStatus } from '@/lib/types';
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
                training_partner: program.training_partner || program.trainingPartner || program['training-partners'] || program.training_partners || '',
                training_partner_id: program.training_partner_id
                    || program.trainingPartnerId
                    || (program['training-partners'] && typeof program['training-partners'] === 'object'
                        ? (program['training-partners'].$id || program['training-partners'].documentId || program['training-partners'].id || '')
                        : '')
                    || '',
                partner_ids: (() => {
                    const raw = Array.isArray(program.partner_ids) ? program.partner_ids : [];
                    const mainId = program.training_partner_id
                        || program.trainingPartnerId
                        || (program['training-partners'] && typeof program['training-partners'] === 'object'
                            ? (program['training-partners'].$id || program['training-partners'].documentId || program['training-partners'].id || '')
                            : '')
                        || '';
                    return raw.filter((id) => id && id !== mainId);
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
    const validateStep = (step) => {
        if (step === 1 && !String(formData.title || '').trim()) {
            return 'Program title is required.';
        }
        if (step === 1 && !String(formData.training_partner_id || '').trim()) {
            return 'Training partner is required.';
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
    const otherPartnersList = useMemo(() => {
        const mainId = String(formData.training_partner_id || '').trim();
        if (!mainId)
            return partners;
        return partners.filter((p) => p.$id !== mainId);
    }, [partners, formData.training_partner_id]);
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
            setSubmitError(error instanceof Error ? error.message : 'Failed to save program.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>{program ? 'Edit Program' : 'Add New Program'}</DialogTitle>
          <DialogDescription>
            {program
            ? 'Update program information'
            : 'Create a new training program'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => {
            e.preventDefault();
            if (currentStep < totalSteps)
                return;
            void handleSubmit(e);
        }} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#047857] to-[#ff8829] transition-all duration-300" style={{ width: `${(currentStep / totalSteps) * 100}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {['Program Info', 'Schedule', 'Assignments'].map((label, idx) => {
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
          {currentStep === 1 && (<>
          <div className="space-y-2">
            <Label htmlFor="title">Program Title *</Label>
            <Input id="title" value={formData.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="e.g., Advanced React Training" disabled={isLoading} maxLength={PROGRAM_TITLE_MAX}/>
            <p className="text-xs text-slate-500">{String(formData.title || '').length}/{PROGRAM_TITLE_MAX}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="training_partner">Training Partner</Label>
            <Select value={formData.training_partner_id || 'none'} onValueChange={(value) => {
                const id = value === 'none' ? '' : value;
                setFormData((prev) => ({
                    ...prev,
                    training_partner_id: id,
                    partner_ids: id ? prev.partner_ids.filter((pid) => pid !== id) : prev.partner_ids,
                }));
            }}>
              <SelectTrigger disabled={isLoading || isPartnersLoading}>
                <SelectValue placeholder={isPartnersLoading ? 'Loading partners...' : 'Select training partner'} />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (<SelectItem key={partner.$id} value={partner.$id}>
                    {partner.name}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Other partners</Label>
              <p className="mt-0.5 text-xs text-slate-500">Additional collaborating partners (the training partner above is not listed here).</p>
            </div>
            <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {partners.length === 0 && (<p className="text-sm text-slate-500">
                  {isPartnersLoading ? 'Loading partners...' : 'No partners available'}
                </p>)}
              {partners.length > 0 && otherPartnersList.length === 0 && (<p className="text-sm text-slate-500">
                  No other partners to add — add more partner records, or pick a different training partner.
                </p>)}
              {otherPartnersList.map((partner) => (<label key={partner.$id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={formData.partner_ids.includes(partner.$id)} onCheckedChange={(checked) => togglePartner(partner.$id, checked === true)} disabled={isLoading || isPartnersLoading}/>
                  <span>{partner.name}</span>
                </label>))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Program description..." disabled={isLoading} maxLength={PROGRAM_DESCRIPTION_MAX} className="min-h-24 resize-y break-all [overflow-wrap:anywhere]"/>
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
            <Label htmlFor="trainer_id">Lead Trainer</Label>
            <Select value={formData.trainer_id || 'none'} onValueChange={(value) => handleChange('trainer_id', value === 'none' ? '' : value)}>
              <SelectTrigger disabled={isLoading || isTrainersLoading}>
                <SelectValue placeholder={isTrainersLoading ? 'Loading trainers...' : 'Select lead trainer'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lead trainer</SelectItem>
                {trainers.map((trainer) => (<SelectItem key={trainer.$id} value={trainer.$id}>
                    {trainer.name || trainer.email || trainer.$id}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          </>)}

          <div className="flex gap-3 pt-4">
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
                {isLoading ? 'Saving...' : 'Save Program'}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
