
'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Edit2 } from 'lucide-react';
import { DateInput } from './ui/date-input';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from './ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import Image from 'next/image';
import { Label } from './ui/label';

// This component is designed to be used within a FormProvider
export function AllstarRouteSheetForm({ mode }: { mode: 'admin' }) {
  const { control, register } = useFormContext();
  const { fields, remove } = useFieldArray({
    control,
    name: 'visits',
  });

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Date</TableHead>
              <TableHead>Time In</TableHead>
              <TableHead>Time Out</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Patient/PCG Signature</TableHead>
              <TableHead>Type of Visit</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="min-w-[150px]">
                  <FormField
                    control={control}
                    name={`visits.${index}.serviceDate`}
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <DateInput {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input type="time" {...register(`visits.${index}.timeIn`)} />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input type="time" {...register(`visits.${index}.timeOut`)} />
                </TableCell>
                <TableCell className="min-w-[180px]">
                  <Input {...register(`visits.${index}.patientName`)} />
                </TableCell>
                <TableCell>
                   <Controller
                    control={control}
                    name={`visits.${index}.patientSignature`}
                    render={({ field }) => (
                      <div className="relative w-32 h-16 bg-muted/50 rounded-md">
                        {field.value ? (
                          <Image src={field.value} alt="Signature" layout="fill" objectFit="contain" />
                        ) : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">No Sig</span>}
                      </div>
                    )}
                  />
                </TableCell>
                <TableCell className="min-w-[180px]">
                   <Controller
                    control={control}
                    name={`visits.${index}.typeOfVisit`}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
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
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold">For Official Use Only</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField
              control={control}
              name="dateSubmitted"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Submitted</FormLabel>
                  <FormControl><DateInput {...field} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><DateInput {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
         <FormField
          control={control}
          name="remarks"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Remarks</FormLabel>
              <FormControl><Textarea {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
