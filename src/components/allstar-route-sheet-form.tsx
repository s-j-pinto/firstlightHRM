'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DateInput } from '@/components/ui/date-input';
import { PlusCircle, Trash2, Edit2, RefreshCw } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface AllstarRouteSheetFormProps {
  mode: 'caregiver' | 'admin';
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
            onSave(sigPadRef.current.toDataURL());
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
                        canvasProps={{ className: 'w-full h-full bg-muted/50 rounded-md' }}
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

const SignatureField = ({ fieldName, title, disabled }: { fieldName: `templateData.allstar_route_sheet.visits.${number}.patientSignature` | 'templateData.allstar_route_sheet.employeeSignature'; title: string; disabled: boolean; }) => {
    const { watch, setValue } = useFormContext();
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


export const AllstarRouteSheetForm = ({ mode }: AllstarRouteSheetFormProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "templateData.allstar_route_sheet.visits",
  });
  
  const isCaregiver = mode === 'caregiver';
  const isAdmin = mode === 'admin';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Visits</h3>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
             <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name={`templateData.allstar_route_sheet.visits.${index}.serviceDate`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Date</FormLabel>
                    <FormControl><DateInput name={field.name} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`templateData.allstar_route_sheet.visits.${index}.timeIn`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time In</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`templateData.allstar_route_sheet.visits.${index}.timeOut`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Out</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <FormField
                    control={control}
                    name={`templateData.allstar_route_sheet.visits.${index}.patientName`}
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Patient Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name={`templateData.allstar_route_sheet.visits.${index}.typeOfVisit`}
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type of Visit</FormLabel>
                         <FormControl>
                            <Input {...field} />
                         </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <SignatureField fieldName={`templateData.allstar_route_sheet.visits.${index}.patientSignature`} title="Patient/PCG Signature" disabled={!isCaregiver} />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ serviceDate: '', timeIn: '', timeOut: '', patientName: '', patientSignature: '', typeOfVisit: '' })}
        >
          <PlusCircle className="mr-2" /> Add Visit
        </Button>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-semibold">Employee Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-4">
                 <FormField
                    control={control}
                    name="templateData.allstar_route_sheet.employeeName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Employee Name</FormLabel>
                        <FormControl><Input {...field} disabled={!isCaregiver} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="templateData.allstar_route_sheet.title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input {...field} disabled={!isCaregiver} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <SignatureField fieldName="templateData.allstar_route_sheet.employeeSignature" title="Employee Signature" disabled={!isCaregiver} />
        </div>
      </div>
      
      {isAdmin && (
        <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold">Office Use Only</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={control}
                    name="templateData.allstar_route_sheet.dateSubmitted"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Date Submitted</FormLabel>
                        <FormControl><DateInput name={field.name} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="templateData.allstar_route_sheet.checkedBy"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Checked By</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="templateData.allstar_route_sheet.checkedDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Checked Date</FormLabel>
                        <FormControl><DateInput name={field.name} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
                control={control}
                name="templateData.allstar_route_sheet.remarks"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
      )}
    </div>
  );
};
