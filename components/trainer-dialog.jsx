'use client';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
export function TrainerDialog({ open, onOpenChange, trainer, onSave, partners = [], isPartnersLoading = false, }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 2;
    const [formData, setFormData] = useState({
        name: '',
        years_of_experience: '',
        specialization: '',
        training_partner: '',
        role: 'trainer',
        email: '',
        phone: '',
        status: 'active',
    });
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
        if (trainer) {
            setFormData({
                name: trainer.name || '',
                years_of_experience: String(trainer.years_of_experience ?? ''),
                specialization: trainer.specialization || '',
                training_partner: trainer.training_partner || trainer.trainingPartner || trainer['training-partners'] || trainer.training_partners || trainer.organization || '',
                role: trainer.role || 'trainer',
                email: trainer.email || '',
                phone: trainer.phone || '',
                status: trainer.status || 'active',
            });
        }
        else {
            setFormData({
                name: '',
                years_of_experience: '',
                specialization: '',
                training_partner: '',
                role: 'trainer',
                email: '',
                phone: '',
                status: 'active',
            });
        }
    }, [trainer, open]);
    const validateStep = (step) => {
        if (step === 1) {
            if (!String(formData.name || '').trim()) {
                return 'Trainer name is required.';
            }
            const years = Number(formData.years_of_experience);
            if (!Number.isInteger(years) || years < 0) {
                return 'Years of experience must be a non-negative whole number.';
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
            return '';
        }
        return '';
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(1) || validateStep(2);
            if (validationError)
                throw new Error(validationError);
            const years = Number(formData.years_of_experience);
            await onSave({
                ...formData,
                years_of_experience: years,
            });
        }
        catch (error) {
            console.error('Error saving trainer:', error);
            setSubmitError(error instanceof Error ? error.message : 'Failed to save trainer.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const handleNext = () => {
        const validationError = validateStep(currentStep);
        if (validationError) {
            setSubmitError(validationError);
            return;
        }
        setSubmitError('');
        setCurrentStep((prev) => Math.min(prev + 1, 2));
    };
    const handleBack = () => {
        setSubmitError('');
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };
    return (<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{trainer ? 'Edit Trainer' : 'Add New Trainer'}</DialogTitle>
          <DialogDescription>
            {trainer ? 'Update trainer information' : 'Create a new trainer record'}
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
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {['Profile', 'Contacts'].map((label, idx) => {
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
            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Trainer name" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="years_of_experience">Years of Experience *</Label>
            <Input id="years_of_experience" type="number" min="0" value={formData.years_of_experience} onChange={(e) => handleChange('years_of_experience', e.target.value)} placeholder="e.g., 5" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialization">Specialization</Label>
            <Input id="specialization" value={formData.specialization} onChange={(e) => handleChange('specialization', e.target.value)} placeholder="e.g., Solar PV" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="training_partner">Training Partner *</Label>
            <Select value={formData.training_partner || ''} onValueChange={(value) => handleChange('training_partner', value)}>
              <SelectTrigger disabled={isLoading || isPartnersLoading}>
                <SelectValue placeholder={isPartnersLoading ? 'Loading partners...' : 'Select training partner'} />
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
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="senior_trainer">Senior Trainer</SelectItem>
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
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="trainer@example.com" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+256..." disabled={isLoading}/>
          </div>
          </>)}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            {currentStep > 1 && (<Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="flex-1">
                Back
              </Button>)}
            {currentStep < 2 ? (<Button type="button" onClick={(e) => {
                    e.preventDefault();
                    handleNext();
                }} disabled={isLoading} className="flex-1">
                Next
              </Button>) : (<Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Saving...' : 'Save Trainer'}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
