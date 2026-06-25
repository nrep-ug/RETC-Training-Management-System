'use client';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneNumberInput } from '@/components/phone-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getCourseFormSelectOptions } from '@/lib/renewable-energy-courses';
import { getSpecializationsFromTrainer } from '@/lib/trainer-specializations';
import {
    getTechnologyInputsFromTrainer,
    technologySelectionsFromInputs,
} from '@/lib/trainer-technologies';
import { getRetcFacilitatorRoleLabel, RETC_FACILITATOR_LABELS } from '@/lib/retc-partner-labels';
import { getTrainerOptionalPhone, getTrainerPrimaryPhone } from '@/lib/trainer-contact-fields';
import { hasMeaningfulPhoneDigits } from '@/lib/phone';
import {
    openFacilitatorDocument,
    getTrainerCvFileId,
    getTrainerCvFileName,
} from '@/lib/trainer-documents';
import { FileUploadZone } from '@/components/file-upload-zone';

export function TrainerDialog({ open, onOpenChange, trainer, onSave, partners = [], isPartnersLoading = false, }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;
    const specializationOptions = getCourseFormSelectOptions();
    const [formData, setFormData] = useState({
        name: '',
        years_of_experience: '',
        specializations: [],
        technology_inputs: {},
        training_partner: '',
        role: 'trainer',
        email: '',
        optional_email: '',
        phone: '',
        optional_phone: '',
        status: 'active',
    });
    const [cvFile, setCvFile] = useState(null);
    const [removeCv, setRemoveCv] = useState(false);
    const [cvFileId, setCvFileId] = useState('');
    const [cvFileName, setCvFileName] = useState('');
    const lastTrainerKeyRef = useRef('');
    useEffect(() => {
        const id = trainer?.$id ?? trainer?.documentId ?? trainer?.id;
        const key = id != null && String(id) !== '' ? `edit:${id}` : 'new';
        if (!open) {
            lastTrainerKeyRef.current = '';
            return;
        }
        if (key !== lastTrainerKeyRef.current) {
            lastTrainerKeyRef.current = key;
        }
        else {
            return;
        }
        setSubmitError('');
        setCurrentStep(1);
        setCvFile(null);
        setRemoveCv(false);
        if (trainer) {
            setCvFileId(getTrainerCvFileId(trainer));
            setCvFileName(getTrainerCvFileName(trainer));
            setFormData({
                name: trainer.name || '',
                years_of_experience: String(trainer.years_of_experience ?? ''),
                specializations: getSpecializationsFromTrainer(trainer),
                technology_inputs: getTechnologyInputsFromTrainer(trainer),
                training_partner: trainer.training_partner || trainer.trainingPartner || trainer['training-partners'] || trainer.training_partners || trainer.organization || '',
                role: trainer.role || 'trainer',
                email: trainer.email || '',
                optional_email: trainer.optional_email || '',
                phone: getTrainerPrimaryPhone(trainer),
                optional_phone: getTrainerOptionalPhone(trainer),
                status: trainer.status || 'active',
            });
        }
        else {
            setCvFileId('');
            setCvFileName('');
            setFormData({
                name: '',
                years_of_experience: '',
                specializations: [],
                technology_inputs: {},
                training_partner: '',
                role: 'trainer',
                email: '',
                optional_email: '',
                phone: '',
                optional_phone: '',
                status: 'active',
            });
        }
    }, [trainer, open]);
    const validateStep = (step) => {
        if (step === 1) {
            if (!String(formData.name || '').trim()) {
                return `${RETC_FACILITATOR_LABELS.moduleSingular} name is required.`;
            }
            const years = Number(formData.years_of_experience);
            if (!Number.isInteger(years) || years < 0) {
                return 'Years of experience must be a non-negative whole number.';
            }
            if (!Array.isArray(formData.specializations) || formData.specializations.length === 0) {
                return 'Select at least one specialization category.';
            }
            for (const categoryKey of formData.specializations) {
                const typed = String(formData.technology_inputs?.[categoryKey] || '').trim();
                if (!typed) {
                    const label = specializationOptions.find((opt) => opt.value === categoryKey)?.label || categoryKey;
                    return `Enter at least one technology under ${label}.`;
                }
            }
            if (!String(formData.training_partner || '').trim()) {
                return 'Training partner is required.';
            }
            return '';
        }
        if (step === 2) {
            if (!String(formData.email || '').trim()) {
                return 'Email is required.';
            }
            const email = String(formData.email || '').trim();
            if (!email.includes('@')) {
                return 'Please enter a valid email address.';
            }
            const optionalEmail = String(formData.optional_email || '').trim();
            if (optionalEmail && !optionalEmail.includes('@')) {
                return 'Please enter a valid additional email address.';
            }
            if (optionalEmail && optionalEmail.toLowerCase() === email.toLowerCase()) {
                return 'Additional email must be different from the primary email.';
            }
            if (!hasMeaningfulPhoneDigits(formData.phone)) {
                const existingPhone = trainer ? getTrainerPrimaryPhone(trainer) : '';
                if (!hasMeaningfulPhoneDigits(existingPhone)) {
                    return 'Primary phone is required.';
                }
            }
            return '';
        }
        if (step === 3) {
            if (removeCv || (!cvFile && !cvFileId)) {
                return 'CV is required.';
            }
            return '';
        }
        return '';
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(1) || validateStep(2) || validateStep(3);
            if (validationError)
                throw new Error(validationError);
            const years = Number(formData.years_of_experience);
            await onSave({
                name: formData.name,
                years_of_experience: years,
                specializations: formData.specializations,
                technology_selections: technologySelectionsFromInputs(
                    formData.technology_inputs || {},
                    formData.specializations,
                ),
                training_partner: formData.training_partner,
                role: formData.role,
                email: formData.email,
                optional_email: formData.optional_email,
                phone: formData.phone,
                optional_phone: formData.optional_phone,
                status: formData.status,
                cv_file: cvFile,
                cv_file_id: removeCv ? '' : cvFileId,
                cv_file_name: cvFileName,
                remove_cv: removeCv,
            });
        }
        catch (error) {
            console.error('Error saving trainer:', error);
            setSubmitError(error instanceof Error ? error.message : `Failed to save ${RETC_FACILITATOR_LABELS.moduleSingular}.`);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const toggleSpecialization = (courseKey, checked) => {
        setFormData((prev) => {
            const current = new Set(prev.specializations || []);
            const technologyInputs = { ...(prev.technology_inputs || {}) };
            if (checked)
                current.add(courseKey);
            else {
                current.delete(courseKey);
                delete technologyInputs[courseKey];
            }
            return {
                ...prev,
                specializations: Array.from(current),
                technology_inputs: technologyInputs,
            };
        });
    };
    const setTechnologyInput = (categoryKey, value) => {
        setFormData((prev) => ({
            ...prev,
            technology_inputs: {
                ...(prev.technology_inputs || {}),
                [categoryKey]: value,
            },
        }));
    };
    const handleNext = () => {
        const validationError = validateStep(currentStep);
        if (validationError) {
            setSubmitError(validationError);
            return;
        }
        setSubmitError('');
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    };
    const handleBack = () => {
        setSubmitError('');
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };
    return (<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{trainer ? RETC_FACILITATOR_LABELS.editTitle : RETC_FACILITATOR_LABELS.addTitle}</DialogTitle>
          <DialogDescription>
            {trainer ? `Update ${RETC_FACILITATOR_LABELS.moduleSingular} information` : `Create a new ${RETC_FACILITATOR_LABELS.moduleSingular} record`}
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
              {['Profile', 'Contacts', 'CV'].map((label, idx) => {
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
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={`${RETC_FACILITATOR_LABELS.moduleSingular} name`} disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="years_of_experience">Years of Experience *</Label>
            <Input id="years_of_experience" type="number" min="0" value={formData.years_of_experience} onChange={(e) => handleChange('years_of_experience', e.target.value)} placeholder="e.g., 5" disabled={isLoading}/>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Specialization categories *</Label>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose each area this facilitator can deliver, then type the technologies they can train in.
              </p>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
              {specializationOptions.map((opt) => {
                const categorySelected = (formData.specializations || []).includes(opt.value);
                return (
                  <div key={opt.value} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <Checkbox
                        checked={categorySelected}
                        onCheckedChange={(checked) => toggleSpecialization(opt.value, checked === true)}
                        disabled={isLoading}
                      />
                      <span>{opt.label}</span>
                    </label>
                    {categorySelected && (
                      <div className="mt-3 space-y-1.5 border-l-2 border-[#047857]/30 pl-3">
                        <Label htmlFor={`technologies-${opt.value}`} className="text-xs font-medium text-slate-500">
                          Technologies *
                        </Label>
                        <Input
                          id={`technologies-${opt.value}`}
                          value={formData.technology_inputs?.[opt.value] || ''}
                          onChange={(e) => setTechnologyInput(opt.value, e.target.value)}
                          placeholder="e.g. Lucas-Nülle, Grid-tied PV, Off-grid systems"
                          disabled={isLoading}
                        />
                        <p className="text-xs text-slate-500">
                          Separate multiple technologies with commas. Add as many as needed.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="training_partner">Partner *</Label>
            <Select value={formData.training_partner || ''} onValueChange={(value) => handleChange('training_partner', value)}>
              <SelectTrigger disabled={isLoading || isPartnersLoading}>
                <SelectValue placeholder={isPartnersLoading ? 'Loading partners...' : 'Select partner'} />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (<SelectItem key={partner.$id} value={partner.name}>
                    {partner.name}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formData.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger disabled={isLoading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trainer">{getRetcFacilitatorRoleLabel('trainer')}</SelectItem>
                  <SelectItem value="senior_trainer">{getRetcFacilitatorRoleLabel('senior_trainer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger disabled={isLoading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </>)}

          {currentStep === 2 && (<>
          <div className="space-y-2">
            <Label htmlFor="email">Primary email *</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="work@organisation.org" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="optional_email">Additional email</Label>
            <Input id="optional_email" type="email" value={formData.optional_email} onChange={(e) => handleChange('optional_email', e.target.value)} placeholder="personal@example.com (optional)" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Primary phone *</Label>
            <PhoneNumberInput id="phone" value={formData.phone} onChange={(phone) => handleChange('phone', phone)} disabled={isLoading}/>
            <p className="text-xs text-slate-500">Required — enter the full number after +256.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="optional_phone">Additional contact</Label>
            <PhoneNumberInput id="optional_phone" value={formData.optional_phone} onChange={(phone) => handleChange('optional_phone', phone)} disabled={isLoading}/>
            <p className="text-xs text-slate-500">Optional — delete the digits after +256 to remove this number.</p>
          </div>
          </>)}

          {currentStep === 3 && (<>
          <div className="space-y-2">
            <Label htmlFor="trainer_cv">CV *</Label>
            <FileUploadZone
              id="trainer_cv"
              disabled={isLoading}
              selectedFile={cvFile}
              existingFileName={!removeCv ? cvFileName : ''}
              existingFileId={!removeCv ? cvFileId : ''}
              onFileSelect={(file) => {
                setCvFile(file);
                setRemoveCv(false);
              }}
              onRemove={() => {
                setCvFile(null);
                if (cvFileId) {
                    setRemoveCv(true);
                    setCvFileId('');
                    setCvFileName('');
                }
              }}
              onViewExisting={cvFileId ? async () => {
                try {
                    await openFacilitatorDocument(cvFileId);
                }
                catch (error) {
                    setSubmitError(error instanceof Error ? error.message : 'Could not open CV.');
                }
              } : undefined}
              hint="Any file type is accepted"
            />
          </div>
          </>)}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            {currentStep > 1 && (<Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="flex-1">
                Back
              </Button>)}
            {currentStep < totalSteps ? (<Button type="button" onClick={(e) => {
                    e.preventDefault();
                    handleNext();
                }} disabled={isLoading} className="flex-1">
                Next
              </Button>) : (<Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Saving...' : RETC_FACILITATOR_LABELS.saveButton}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
