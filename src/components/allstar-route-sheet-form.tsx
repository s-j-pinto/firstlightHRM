

'use client';

import * as React from "react";
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DateInput } from '@/components/ui/date-input';
import { Edit2, RefreshCw } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AllstarRouteSheetFormProps {
  mode: 'caregiver' | 'admin';
  clientName?: string;
  caregiverName?: string;
}

const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    signatureData,
    title
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    signatureData: string | undefined | null;
    title: string;
}) => {
    const sigPadRef = React.useRef<SignatureCanvas>(null);

    React.useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => sigPadRef.current?.clear();
    
    const handleDone = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            onSave(sigPadRef.current.toDataURL('image/png'));
        } else {
             onSave(""); 
        }
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow p-2">
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor='black'
                        canvasProps={{ className: 'w-full h-full bg-white rounded-md' }}
                    />
                </div>
                <div className="flex justify-between p-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleClear}><RefreshCw className="mr-2"/>Clear</Button>
                    <Button type="button" onClick={handleDone}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const SignatureField = ({ fieldName, title, disabled }: { fieldName: 'patientSignature' | 'employeeSignature'; title: string; disabled: boolean; }) => {
    const { watch, setValue, formState: { errors } } = useFormContext();
    const signatureData = watch(fieldName);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    return (
        <>
            <FormItem>
                <FormLabel>{title}</FormLabel>
                <div className="relative rounded-md border bg-muted/30 h-24 flex items-center justify-center">
                    {signatureData ? (
                        <Image src={signatureData as string} alt="Signature" layout="fill" objectFit="contain" />
                    ) : (
                        <span className="text-muted-foreground">Not Signed</span>
                    )}
                    {!disabled && (
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                     )}
                </div>
                 <FormMessage />
            </FormItem>
            <SignaturePadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={(dataUrl) => setValue(fieldName, dataUrl, { shouldValidate: true, shouldDirty: true })}
                signatureData={signatureData}
                title={title}
            />
        </>
    );
};


export const AllstarRouteSheetForm = ({ mode, clientName, caregiverName }: AllstarRouteSheetFormProps) => {
  const { control, setValue } = useFormContext();
  
  React.useEffect(() => {
    if (caregiverName) {
        setValue('employeeName', caregiverName);
    }
  }, [caregiverName, setValue]);

  React.useEffect(() => {
    if (clientName && mode === 'caregiver') {
        setValue('patientName', clientName);
    }
  }, [clientName, mode, setValue]);

  const isAdmin = mode === 'admin';

  return (
    <div className="space-y-6">
        <h3 className="text-lg font-semibold">Visit Details</h3>
        <div className="p-4 border rounded-lg space-y-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
            control={control}
            name="serviceDate"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Service Date</FormLabel>
                <FormControl><DateInput name="serviceDate" /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={control}
            name="timeIn"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Time In</FormLabel>
                <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={control}
            name="timeOut"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Time Out</FormLabel>
                <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <FormField
                control={control}
                name="patientName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Patient Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''}/></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
                <FormField
                control={control}
                name="typeOfVisit"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Type of Visit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select visit type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Follow-up">Follow-up</SelectItem>
                            <SelectItem value="SOC">SOC</SelectItem>
                            <SelectItem value="ROC">ROC</SelectItem>
                            <SelectItem value="Recert">Recert</SelectItem>
                            <SelectItem value="Discharge">Discharge</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <SignatureField fieldName="patientSignature" title="Patient/PCG Signature" disabled={mode !== 'caregiver'} />
        </div>
        </div>
      
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-semibold">Employee Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-4">
                 <FormField
                    control={control}
                    name="employeeName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Employee Name</FormLabel>
                        <FormControl><Input {...field} value={field.value || ''} disabled={!isAdmin} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Title</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={isAdmin}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a title" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Caregiver">Caregiver</SelectItem>
                                <SelectItem value="HCA">HCA</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <SignatureField fieldName="employeeSignature" title="Employee Signature" disabled={mode !== 'caregiver'} />
        </div>
      </div>
      
      {isAdmin && (
        <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold">Office Use Only</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={control}
                    name="dateSubmitted"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Date Submitted</FormLabel>
                        <FormControl><DateInput name="dateSubmitted" /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="checkedBy"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Checked By</FormLabel>
                        <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="checkedDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Checked Date</FormLabel>
                        <FormControl><DateInput name="checkedDate" /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
                control={control}
                name="remarks"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl><Textarea {...field} rows={3} value={field.value || ''} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
      )}
    </div>
  );
};
