
"use client";

import { useState, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { CaregiverProfile } from '@/lib/types';
import { saveInterviewAndSchedule } from '@/lib/interviews.actions';
import { generateInterviewInsights, type InterviewInsightsOutput } from '@/ai/flows/interview-insights-flow';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const interviewFormSchema = z.object({
  interviewNotes: z.string().optional(),
  candidateRating: z.number().min(0).max(5),
  phoneScreenPassed: z.enum(['Yes', 'No']),
  inPersonDate: z.date().optional(),
  inPersonTime: z.string().optional(),
});

type InterviewFormData = z.infer<typeof interviewFormSchema>;

export default function ManageInterviewsClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CaregiverProfile[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);
  const [aiInsights, setAiInsights] = useState<InterviewInsightsOutput | null>(null);
  const [isAiPending, startAiTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const { toast } = useToast();

  const caregiverProfilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
  const { data: allCaregivers, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);
  
  const form = useForm<InterviewFormData>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues: {
      interviewNotes: '',
      candidateRating: 3,
      phoneScreenPassed: 'No',
      inPersonDate: undefined,
      inPersonTime: '',
    },
  });

  const phoneScreenPassed = form.watch('phoneScreenPassed');

  const handleSearch = () => {
    if (!searchTerm.trim() || !allCaregivers) return;
    startSearchTransition(() => {
      const lowercasedTerm = searchTerm.toLowerCase();
      const results = allCaregivers.filter(
        (caregiver) =>
          caregiver.fullName.toLowerCase().includes(lowercasedTerm) ||
          caregiver.phone.includes(searchTerm)
      );
      setSearchResults(results);
    });
  };

  const handleSelectCaregiver = (caregiver: CaregiverProfile) => {
    setSelectedCaregiver(caregiver);
    setSearchResults([]);
    setSearchTerm('');
    setAiInsights(null);
    form.reset({
      interviewNotes: '',
      candidateRating: 3,
      phoneScreenPassed: 'No',
      inPersonDate: undefined,
      inPersonTime: '',
    });
  };

  const handleGenerateInsights = () => {
    if (!selectedCaregiver) return;
    const { interviewNotes, candidateRating } = form.getValues();

    if (!interviewNotes) {
      toast({
        title: "Missing Information",
        description: "Please provide interview notes before generating insights.",
        variant: "destructive"
      });
      return;
    }

    startAiTransition(async () => {
      const result = await generateInterviewInsights({
        caregiverProfile: selectedCaregiver,
        interviewNotes,
        candidateRating,
      });
      setAiInsights(result);
    });
  };
  
  const onSubmit = (data: InterviewFormData) => {
    if (!selectedCaregiver) return;

    startSubmitTransition(async () => {
        let inPersonDateTime: Date | undefined = undefined;
        if (data.phoneScreenPassed === 'Yes' && data.inPersonDate && data.inPersonTime) {
            const [hours, minutes] = data.inPersonTime.split(':').map(Number);
            inPersonDateTime = setMinutes(setHours(data.inPersonDate, hours), minutes);
        } else if (data.phoneScreenPassed === 'Yes' && (!data.inPersonDate || !data.inPersonTime)) {
            toast({
                title: "Incomplete Information",
                description: "Please select a date and time for the in-person interview.",
                variant: "destructive"
            });
            return;
        }

        const result = await saveInterviewAndSchedule({
            caregiverProfile: selectedCaregiver,
            interviewData: {
                interviewNotes: data.interviewNotes,
                candidateRating: data.candidateRating,
                phoneScreenPassed: data.phoneScreenPassed,
                aiSummary: aiInsights?.summary,
                aiRecommendation: aiInsights?.recommendation,
            },
            inPersonDateTime: inPersonDateTime,
        });

        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
            setSelectedCaregiver(null);
            setAiInsights(null);
            form.reset();
        }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search for a Caregiver</CardTitle>
          <CardDescription>
            Search by full name or phone number to begin the interview process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>
              {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          {(isSearching || caregiversLoading) && <p className="text-sm text-muted-foreground mt-2">Loading...</p>}
          {searchResults.length > 0 && (
            <ul className="mt-4 border rounded-md divide-y">
              {searchResults.map((caregiver) => (
                <li key={caregiver.id} className="p-2 hover:bg-muted">
                  <button
                    onClick={() => handleSelectCaregiver(caregiver)}
                    className="w-full text-left flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold">{caregiver.fullName}</p>
                      <p className="text-sm text-muted-foreground">{caregiver.email}</p>
                    </div>
                    <p className="text-sm">{caregiver.phone}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedCaregiver && (
        <Card>
            <CardHeader>
                <CardTitle>Phone Screen: {selectedCaregiver.fullName}</CardTitle>
                <CardDescription>Record the results of the phone interview.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                         <FormField
                            control={form.control}
                            name="interviewNotes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interview Notes</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Notes from the phone screen..." {...field} rows={6} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="candidateRating"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Candidate Rating: {field.value}</FormLabel>
                                    <FormControl>
                                        <Slider
                                            min={0}
                                            max={5}
                                            step={1}
                                            value={[field.value]}
                                            onValueChange={(value) => field.onChange(value[0])}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-center">
                          <Button type="button" onClick={handleGenerateInsights} disabled={isAiPending}>
                            {isAiPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate AI Insights
                          </Button>
                        </div>

                        {isAiPending && (
                          <p className="text-sm text-center text-muted-foreground">The AI is analyzing the profile, please wait...</p>
                        )}

                        {aiInsights && (
                          <Alert>
                            <Sparkles className="h-4 w-4" />
                            <AlertTitle>AI-Generated Insights</AlertTitle>
                            <AlertDescription className="space-y-4 mt-2">
                               <div>
                                  <h4 className="font-semibold mb-1">AI Summary</h4>
                                  <p className='text-sm text-foreground'>{aiInsights.summary}</p>
                               </div>
                               <div>
                                  <h4 className="font-semibold mb-1">AI Recommendation</h4>
                                   <p className='text-sm text-foreground'>{aiInsights.recommendation}</p>
                               </div>
                            </AlertDescription>
                          </Alert>
                        )}

                        <FormField
                            control={form.control}
                            name="phoneScreenPassed"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Did the candidate pass the phone screen?</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {phoneScreenPassed === 'Yes' && (
                             <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle>Schedule In-Person Interview</CardTitle>
                                    <CardDescription>Select a date and time for the 2.5 hour in-person interview.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
                                     <FormField
                                        control={form.control}
                                        name="inPersonDate"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Interview Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="inPersonTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Interview Time</FormLabel>
                                                <FormControl>
                                                    <Input type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex justify-end gap-4">
                            <Button variant="outline" onClick={() => setSelectedCaregiver(null)}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save and Complete
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
