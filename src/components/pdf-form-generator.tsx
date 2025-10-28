
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateFormFromPdf } from "@/lib/form-generator.actions";
import { type GeneratedField, type GeneratedForm, type FormBlock } from "@/lib/types";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";


const DynamicFormRenderer = ({ formDefinition }: { formDefinition: GeneratedForm }) => {
  const allFields = formDefinition.blocks
    .filter((block): block is { type: 'fields'; rows: { columns: { fields: GeneratedField[] }[] }[] } => block.type === 'fields')
    .flatMap(block => block.rows.flatMap(row => row.columns.flatMap(col => col.fields)));


  const dynamicSchema = z.object(
    allFields.reduce((schema, field) => {
      let fieldSchema: z.ZodTypeAny;

      switch (field.fieldType) {
        case 'checkbox':
          fieldSchema = field.required ? z.literal(true, { errorMap: () => ({ message: "This checkbox must be checked." }) }) : z.boolean();
          break;
        case 'email':
          fieldSchema = z.string().email({ message: "Invalid email address." });
          break;
        case 'tel':
          fieldSchema = z.string().min(10, { message: "Phone number seems too short." });
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.required && field.fieldType !== 'checkbox') {
        fieldSchema = fieldSchema.min(1, { message: `${field.label} is required.` });
      }

      schema[field.fieldName] = fieldSchema;
      return schema;
    }, {} as Record<string, z.ZodTypeAny>)
  );

  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: allFields.reduce((values, field) => {
      values[field.fieldName] = field.fieldType === 'checkbox' ? false : '';
      return values;
    }, {} as Record<string, any>),
  });

  const { toast } = useToast();
  function onSubmit(data: any) {
    toast({
      title: "Form Submitted!",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }
  
  const renderField = (field: GeneratedField) => {
     return (
       <FormField
        key={field.fieldName}
        control={form.control}
        name={field.fieldName}
        render={({ field: formField }) => {
            let inputComponent;
            switch (field.fieldType) {
                case 'textarea':
                    inputComponent = <Textarea placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} />;
                    break;
                case 'checkbox':
                    return (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                        <FormControl>
                            <Checkbox checked={formField.value} onCheckedChange={formField.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>{field.label}</FormLabel>
                        </div>
                        </FormItem>
                    );
                case 'radio':
                    inputComponent = (
                         <RadioGroup onValueChange={formField.onChange} defaultValue={formField.value} className="flex gap-4">
                            {field.options?.map(option => (
                                <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value={option} /></FormControl>
                                    <FormLabel className="font-normal">{option}</FormLabel>
                                </FormItem>
                            ))}
                        </RadioGroup>
                    );
                    break;
                case 'select':
                    inputComponent = (
                        <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {field.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    );
                    break;
                default:
                    inputComponent = <Input type={field.fieldType} placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} />;
                    break;
            }

            return (
                <FormItem>
                    <FormLabel>{field.label}</FormLabel>
                    <FormControl>{inputComponent}</FormControl>
                    <FormMessage />
                </FormItem>
            );
        }}
      />
     )
  }

  const renderBlock = (block: FormBlock, index: number) => {
    switch (block.type) {
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText /> {formDefinition.formName}</CardTitle>
        <CardDescription>This form was dynamically generated by AI to match the layout of your PDF.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {formDefinition.blocks.map((block, index) => renderBlock(block, index))}
            <Button type="submit">Submit Generated Form</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};


export default function PdfFormGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [generatedForm, setGeneratedForm] = useState<GeneratedForm | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setGeneratedForm(null); // Reset on new file selection
    } else {
      toast({
        title: "Invalid File Type",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
      setFile(null);
    }
  };

  const handleGenerateForm = () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to generate a form from.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const pdfDataUri = reader.result as string;
          const result = await generateFormFromPdf({ pdfDataUri });

          if (result.error) {
            throw new Error(result.error);
          }
          
          if (result.formName && result.blocks) {
            setGeneratedForm(result);
            toast({
              title: "Form Generated Successfully",
              description: `AI has created a form that matches the PDF layout.`,
            });
          } else {
             throw new Error("The AI did not return a valid form structure.");
          }
        };
      } catch (e: any) {
        toast({
          title: "Form Generation Failed",
          description: e.message || "An unknown error occurred.",
          variant: "destructive",
        });
      }
    });
  };


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Generate Form from PDF</CardTitle>
          <CardDescription>
            Upload a PDF document, and the AI will analyze it to generate a corresponding web form that visually matches the PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-upload">PDF Document</Label>
            <Input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileChange} />
          </div>
          <Button onClick={handleGenerateForm} disabled={isPending || !file}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Generate Form
          </Button>
        </CardContent>
      </Card>

      {generatedForm && (
        <DynamicFormRenderer formDefinition={generatedForm} />
      )}
    </>
  );
}
