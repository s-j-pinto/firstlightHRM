
"use client";

import { useState, useMemo, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { collection } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CalendarIcon, SlidersHorizontal, FilterX } from 'lucide-react';
import { cn } from '@/lib/utils';


const skillsAndAttributes = [
    { id: "canChangeBrief", label: "Change Brief" },
    { id: "canTransfer", label: "Transfer" },
    { id: "canPrepareMeals", label: "Prepare Meals" },
    { id: "canDoBedBath", label: "Bed Bath/Shower" },
    { id: "canUseHoyerLift", label: "Hoyer Lift" },
    { id: "canUseGaitBelt", label: "Gait Belt" },
    { id: "canUsePurwick", label: "Purwick" },
    { id: "canEmptyCatheter", label: "Empty Catheter" },
    { id: "canEmptyColostomyBag", label: "Empty Colostomy Bag" },
    { id: "canGiveMedication", label: "Give Medication" },
    { id: "canTakeBloodPressure", label: "Take Blood Pressure" },
    { id: "hasDementiaExperience", label: "Dementia Experience" },
    { id: "hasHospiceExperience", label: "Hospice Experience" },
    { id: "hca", label: "HCA" },
    { id: "hha", label: "HHA" },
    { id: "cna", label: "CNA" },
    { id: "liveScan", label: "Live Scan" },
    { id: "negativeTbTest", label: "Negative TB Test" },
    { id: "cprFirstAid", label: "CPR/First Aid" },
    { id: "canWorkWithCovid", label: "Can Work With COVID" },
    { id: "covidVaccine", label: "COVID Vaccinated" },
] as const;

type CandidateStatus =
  | 'Applied'
  | 'Phone Screen Failed'
  | 'Final Interview Pending'
  | 'Final Interview Failed'
  | 'Final Interview Passed'
  | 'Orientation Scheduled'
  | 'Hired';

interface EnrichedCandidate extends CaregiverProfile {
  status: CandidateStatus;
}

const hiringStatuses: CandidateStatus[] = [
  'Applied', 'Hired', 'Orientation Scheduled', 'Final Interview Passed', 'Final Interview Pending', 'Final Interview Failed', 'Phone Screen Failed'
];

type FormData = {
    skills: (typeof skillsAndAttributes)[number]['id'][];
    hiringStatus: CandidateStatus | 'any';
};

export default function AdvancedSearchClient() {
    const { register, handleSubmit, control, watch, reset } = useForm<FormData>({
        defaultValues: { skills: [], hiringStatus: 'any' }
    });
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [filteredResults, setFilteredResults] = useState<EnrichedCandidate[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();

    const profilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
    const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesRef);

    const interviewsRef = useMemoFirebase(() => collection(firestore, 'interviews'), []);
    const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsRef);

    const employeesRef = useMemoFirebase(() => collection(firestore, 'caregiver_employees'), []);
    const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);

    const candidates = useMemo((): EnrichedCandidate[] => {
        if (!profiles || !interviews || !employees) return [];
        
        const interviewsMap = new Map(interviews.map(i => [i.caregiverProfileId, i]));
        const employeesMap = new Map(employees.map(e => [e.caregiverProfileId, e]));

        const getStatus = (profileId: string): CandidateStatus => {
            if (employeesMap.has(profileId)) return 'Hired';
            const interview = interviewsMap.get(profileId);
            if (interview) {
                if (interview.phoneScreenPassed === 'No') return 'Phone Screen Failed';
                if (interview.orientationScheduled) return 'Orientation Scheduled';
                if (interview.finalInterviewStatus === 'Passed') return 'Final Interview Passed';
                if (interview.finalInterviewStatus === 'Failed') return 'Final Interview Failed';
                return 'Final Interview Pending';
            }
            return 'Applied';
        };

        return profiles.map(profile => ({
            ...profile,
            status: getStatus(profile.id),
        }));
    }, [profiles, interviews, employees]);


    const onSubmit = (data: FormData) => {
        startSearchTransition(() => {
            let results = [...candidates];
            
            // Filter by skills
            if (data.skills.length > 0) {
                results = results.filter(candidate => 
                    data.skills.every(skill => (candidate as any)[skill] === true)
                );
            }

            // Filter by hiring status
            if (data.hiringStatus !== 'any') {
                results = results.filter(candidate => candidate.status === data.hiringStatus);
            }

            // Filter by date range
            if (dateRange?.from && dateRange?.to) {
                const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
                results = results.filter(candidate => 
                    candidate.createdAt && isWithinInterval((candidate.createdAt as any).toDate(), interval)
                );
            }

            setFilteredResults(results);
            setHasSearched(true);
        });
    };
    
    const handleClearFilters = () => {
        reset({ skills: [], hiringStatus: 'any' });
        setDateRange(undefined);
        setFilteredResults([]);
        setHasSearched(false);
    }
    
    const isLoading = profilesLoading || interviewsLoading || employeesLoading;

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Query Builder</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Skills and Attributes */}
                        <div className="space-y-2">
                            <Label>Skills & Attributes (must have all selected)</Label>
                            <Card className="p-4 bg-muted/50">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {skillsAndAttributes.map(skill => (
                                    <Controller
                                        key={skill.id}
                                        name="skills"
                                        control={control}
                                        render={({ field }) => (
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={skill.id}
                                                checked={field.value?.includes(skill.id)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? field.onChange([...field.value, skill.id])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                            (value) => value !== skill.id
                                                        )
                                                        );
                                                }}
                                            />
                                            <Label htmlFor={skill.id} className="font-normal text-sm">{skill.label}</Label>
                                        </div>
                                        )}
                                    />
                                ))}
                                </div>
                            </Card>
                        </div>

                        {/* Status and Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Label>Hiring Status</Label>
                                <Select onValueChange={(val) => control._formValues.hiringStatus = val} defaultValue="any">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any Status</SelectItem>
                                        {hiringStatuses.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Application Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                                                ) : (
                                                    format(dateRange.from, "LLL dd, y")
                                                )
                                            ) : (
                                                <span>Pick a date range</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from}
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                    <CardContent className="flex justify-end gap-4">
                         <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isSearching}>
                            <FilterX className="mr-2" />
                            Clear Filters
                        </Button>
                        <Button type="submit" disabled={isSearching || isLoading}>
                            {isSearching ? <Loader2 className="mr-2 animate-spin"/> : <Search className="mr-2" />}
                            {isLoading ? 'Loading Data...' : 'Search Candidates'}
                        </Button>
                    </CardContent>
                </Card>
            </form>

            {(hasSearched || isLoading) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results</CardTitle>
                        <CardDescription>
                            {isSearching ? 'Applying filters...' : `Found ${filteredResults.length} candidates matching your criteria.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isSearching ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                            </div>
                        ) : filteredResults.length > 0 ? (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Application Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.map(candidate => (
                                        <TableRow key={candidate.id}>
                                            <TableCell>
                                                <div className="font-medium">{candidate.fullName}</div>
                                                <div className="text-sm text-muted-foreground">{candidate.email}</div>
                                            </TableCell>
                                            <TableCell>{candidate.phone}</TableCell>
                                            <TableCell>
                                                {candidate.createdAt ? format((candidate.createdAt as any).toDate(), 'PP') : 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={candidate.status === 'Hired' ? 'default' : 'secondary'}>{candidate.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                             <div className="text-center py-10 border-dashed border-2 rounded-lg">
                                <h3 className="text-lg font-medium">No Matching Candidates Found</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters to find more results.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
