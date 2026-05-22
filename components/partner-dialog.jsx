'use client';
import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PARTNER_LABELS } from '@/lib/partner-labels';
export function PartnerDialog({ open, onOpenChange, partner, onSave }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 2;
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        status: 'active',
    });
    const lastPartnerKeyRef = useRef('');
    useEffect(() => {
        const key = partner?.$id ? `edit:${partner.$id}` : 'new';
        if (!open) {
            lastPartnerKeyRef.current = '';
            return;
        }
        const shouldInit = key !== lastPartnerKeyRef.current;
        if (!shouldInit)
            return;
        lastPartnerKeyRef.current = key;
        setSubmitError('');
        setCurrentStep(1);
        if (partner) {
            setFormData({
                name: partner.name || '',
                contact_person: partner.contact_person || partner.contactPerson || '',
                email: partner.email || '',
                phone: partner.phone || '',
                status: partner.status || 'active',
            });
        }
        else {
            setFormData({
                name: '',
                contact_person: '',
                email: '',
                phone: '',
                status: 'active',
            });
        }
    }, [partner, open]);
    const validateStep = (step) => {
        if (step === 1 && !String(formData.name || '').trim()) {
            return 'Partner name is required.';
        }
        return '';
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(1);
            if (validationError) {
                throw new Error(validationError);
            }
            await onSave({
                ...formData,
            });
        }
        catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to save partner.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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
          <DialogTitle>{partner ? PARTNER_LABELS.editTitle : PARTNER_LABELS.addTitle}</DialogTitle>
          <DialogDescription>
            {partner ? 'Update partner details.' : 'Create a new partner profile.'}
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
              {['Identity', 'Contact & Status'].map((label, idx) => {
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
          {submitError && (<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>)}
          {currentStep === 1 && (<>
          <div className="space-y-2">
            <Label htmlFor="partner_name">Partner Name *</Label>
            <Input id="partner_name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Partner organization name" disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input id="contact_person" value={formData.contact_person} onChange={(e) => handleChange('contact_person', e.target.value)} placeholder="Main focal person" disabled={isLoading}/>
          </div>
          </>)}
          {currentStep === 2 && (<>
          <div className="space-y-2">
            <Label htmlFor="partner_email">Email</Label>
            <Input id="partner_email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="partner@example.com" disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner_phone">Phone</Label>
            <Input id="partner_phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+256..." disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
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
          </>)}
          <div className="flex gap-3 pt-2">
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
                {isLoading ? 'Saving...' : 'Save Partner'}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
