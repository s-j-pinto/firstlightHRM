

"use client";

import { useState, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SignatureCanvas from 'react-signature-canvas';
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type GeneratedForm, type GeneratedField, type FormBlock } from "@/lib/types";

// Placeholder for the server action
async function saveAndSendForSignature(data: any): Promise<{ error?: string; message?: string }> {
  console.log("Saving form data and sending for signature:", data);
  // This is where the logic to save to 'client_signups' and email the link would go.
  // For the prototype, we just simulate a success.
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { message: "Client intake form has been saved and an invitation to sign has been sent to the client." };
}

const DynamicFormRenderer = ({ formDefinition }: { formDefinition: GeneratedForm }) => {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const sigPadRef = useRef<SignatureCanvas>(null);

  const allFields = formDefinition.blocks
    .filter((block): block is { type: 'fields'; rows: { columns: { fields: GeneratedField[] }[] }[] } => block.type === 'fields')
    .flatMap(block => block.rows.flatMap(row => row.columns.flatMap(col => col.fields)));

  // Add a field for the client's email to ensure we can send the signature link
  const dynamicSchema = z.object(
    allFields.reduce((schema, field) => {
      let fieldSchema: z.ZodTypeAny;

      switch (field.fieldType) {
        case 'checkbox':
          fieldSchema = field.required ? z.literal(true, { errorMap: () => ({ message: "This must be checked." }) }) : z.boolean();
          break;
        case 'email':
          fieldSchema = z.string().email({ message: "Invalid email." });
          if (field.required) {
            schema['clientEmail'] = fieldSchema.min(1, "Client email is required for sending the signature link.");
          }
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.required && field.fieldType !== 'checkbox') {
        fieldSchema = fieldSchema.min(1, { message: `${field.label} is required.` });
      }

      schema[field.fieldName] = fieldSchema;
      return schema;
    }, { clientEmail: z.string().email("A valid client email is required to send the signature link.") } as Record<string, z.ZodTypeAny>)
  );


  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: allFields.reduce((values, field) => {
      values[field.fieldName] = field.fieldType === 'checkbox' ? false : '';
      return { ...values };
    }, {} as Record<string, any>),
  });

  const onSubmit = (data: any) => {
    // For this prototype stage, the owner does not sign.
    // The signature pad is just a visual placeholder for what the client will see.
    startTransition(async () => {
      const result = await saveAndSendForSignature(data);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
        form.reset();
      }
    });
  };


  const renderField = (field: GeneratedField) => {
    return (
      <FormField
        key={field.fieldName}
        control={form.control}
        name={field.fieldName}
        render={({ field: formField }) => {
            return (
                 <FormItem>
                    <FormLabel>{field.label}</FormLabel>
                    <FormControl>
                        {
                        field.fieldType === 'textarea' ? <Textarea {...formField} /> :
                        field.fieldType === 'checkbox' ? <div className="flex items-center space-x-2 pt-2"><Checkbox checked={formField.value} onCheckedChange={formField.onChange} /><label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Confirm</label></div> :
                        field.fieldType === 'radio' ? <RadioGroup onValueChange={formField.onChange} defaultValue={formField.value} className="flex gap-4">{field.options?.map(o => <FormItem key={o} className="flex items-center space-x-2"><FormControl><RadioGroupItem value={o} /></FormControl><FormLabel className="font-normal">{o}</FormLabel></FormItem>)}</RadioGroup> :
                        field.fieldType === 'select' ? <Select onValueChange={formField.onChange} defaultValue={formField.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{field.options?.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select> :
                        <Input type={field.fieldType} {...formField} />
                        }
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )
        }}
      />
    );
  };
  
  const renderBlock = (block: FormBlock, index: number) => {
    switch(block.type) {
        case 'heading':
            const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
            return <Tag key={index} className="font-bold text-xl my-4">{block.content}</Tag>;
        case 'paragraph':
            return <p key={index} className="text-muted-foreground my-2">{block.content}</p>;
        case 'html':
             return <div key={index} dangerouslySetInnerHTML={{ __html: block.content }} className="prose prose-sm text-muted-foreground my-2" />;
        case 'fields':
            return (
                <div key={index} className="space-y-6">
                    {block.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
                            {row.columns.map((column, colIndex) => (
                                <div key={colIndex} className="space-y-6">
                                    {column.fields.map(field => renderField(field))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText /> {formDefinition.formName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {formDefinition.blocks.map((block, index) => renderBlock(block, index))}
            
            <div className="pt-6">
                <p className="text-sm text-muted-foreground">The signature section below is a preview of what the client will see. The client will provide their signature after you send the form.</p>
                <div className="mt-2 w-full h-40 rounded-md border bg-muted pointer-events-none" />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                Save and Send for Signature
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};


export default function ClientSignupForm() {
  const templateRef = useMemoFirebase(() => doc(firestore, "settings", "clientIntakeFormTemplate"), []);
  const { data: template, isLoading, error } = useDoc<GeneratedForm>(templateRef);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading form template...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <Card className="text-center py-10">
        <CardHeader>
          <CardTitle>Template Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A client intake form template has not been saved yet. Please go to Owner Settings, generate a form from a PDF, and save it as a template.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <DynamicFormRenderer formDefinition={template} />;
}
