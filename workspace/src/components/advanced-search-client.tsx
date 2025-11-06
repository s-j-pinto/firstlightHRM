
"use client";

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { collection } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CalendarIcon, SlidersHorizontal, FilterX, PersonStanding, Move, Utensils, Bath, ArrowUpFromLine, ShieldCheck, Droplet, Pill, Stethoscope, HeartPulse, Languages, ScanSearch, Biohazard, UserCheck, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';


const skillsAndAttributes = [
    { id: "canChangeBrief", label: "Change Brief", icon: PersonStanding },
    { id: "canTransfer", label: "Transfer", icon: Move },
    { id: "canPrepareMeals", label: "Prepare Meals", icon: Utensils },
    { id: "canDoBedBath", label: "Bed Bath/Shower", icon: Bath },
    { id: "canUseHoyerLift", label: "Hoyer Lift", icon: ArrowUpFromLine },
    { id: "canUseGaitBelt", label: "Gait Belt", icon: UserCheck },
    { id: "canUsePurwick", label: "Purwick", icon: Droplet },
    { id: "canEmptyCatheter", label: "Empty Catheter", icon: Droplet },
    { id: "canEmptyColostomyBag", label: "Empty Colostomy Bag", icon: Droplet },
    { id: "canGiveMedication", label: "Give Medication", icon: Pill },
    { id: "canTakeBloodPressure", label: "Take Blood Pressure", icon: HeartPulse },
    { id: "hasDementiaExperience", label: "Dementia Exp.", icon: PersonStanding },
    { id: "hasHospiceExperience", label: "Hospice Exp.", icon: HeartPulse },
    { id: "hca", label: "HCA", icon: ShieldCheck },
    { id: "hha", label: "HHA", icon: ShieldCheck },
    { id: "cna", label: "CNA", icon: ShieldCheck },
    { id: "liveScan", label: "Live Scan", icon: ScanSearch },
    { id: "negativeTbTest", label: "Negative TB Test", icon: ShieldCheck },
    { id: "cprFirstAid", label: "CPR/First Aid", icon: HeartPulse },
    { id: "canWorkWithCovid", label: "Can Work With COVID", icon: Biohazard },
    { id: "covidVaccine", label: "COVID Vaccinated", icon: Biohazard },
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
    const router = useRouter();
    const pathname = usePathname();

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
    
    useEffect(() => {
        if (candidates.length > 0 && !hasSearched) {
            onSubmit({ skills: [], hiringStatus: 'any' });
        }
    }, [candidates, hasSearched]);
    
    const handleClearFilters = () => {
        reset({ skills: [], hiringStatus: 'any' });
        setDateRange(undefined);
        setFilteredResults([]);
        setHasSearched(false);
        // Rerun the initial search after clearing
        onSubmit({ skills: [], hiringStatus: 'any' });
    }
    
    const isLoading = profilesLoading || interviewsLoading || employeesLoading;
    
    const isActionable = (status: CandidateStatus) => {
        return !['Hired', 'Final Interview Failed', 'Phone Screen Failed'].includes(status);
    }

    const handleManageInterviewClick = (candidateName: string) => {
        router.push(`/admin/manage-interviews?search=${encodeURIComponent(candidateName)}`);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                           <CardTitle className="flex items-center gap-2 flex-shrink-0"><SlidersHorizontal /> Query Builder</CardTitle>
                           <div className="flex flex-wrap items-end gap-4 flex-grow">
                                <div className="space-y-2 flex-grow min-w-[200px] md:flex-grow-0 md:w-1/3">
                                    <Label>Hiring Status</Label>
                                    <Controller
                                        name="hiringStatus"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
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
                                        )}
                                    />
                                </div>
                                <div className="space-y-2 flex-grow min-w-[240px] md:flex-grow-0 md:w-1/3">
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
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Skills and Attributes */}
                        <div className="space-y-2">
                             <div className="flex justify-between items-center mb-2">
                                <Label>Skills & Attributes (must have all selected)</Label>
                                <div className="flex items-center gap-4">
                                     <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isSearching}>
                                        <FilterX className="mr-2" />
                                        Clear Filters
                                    </Button>
                                    <Button type="submit" disabled={isSearching || isLoading}>
                                        {isSearching ? <Loader2 className="mr-2 animate-spin"/> : <Search className="mr-2" />}
                                        {isLoading ? 'Loading Data...' : 'Search Candidates'}
                                    </Button>
                                </div>
                            </div>
                            <Card className="p-4 bg-muted/50">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3">
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
                                            <Label htmlFor={skill.id} className="font-normal text-sm flex items-center gap-1.5">
                                                <skill.icon className="h-4 w-4 text-muted-foreground" />
                                                {skill.label}
                                            </Label>
                                        </div>
                                        )}
                                    />
                                ))}
                                </div>
                            </Card>
                        </div>
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
                         {isSearching || isLoading ? (
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
                                        <TableHead className="text-right">Action</TableHead>
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
                                             <TableCell className="text-right">
                                                {isActionable(candidate.status) && (
                                                    <Button size="sm" onClick={() => handleManageInterviewClick(candidate.fullName)}>
                                                        <Briefcase className="mr-2 h-4 w-4" />
                                                        Manage Interview
                                                    </Button>
                                                )}
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

    