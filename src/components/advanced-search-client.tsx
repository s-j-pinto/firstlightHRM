
"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
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
import { Loader2, Search, CalendarIcon, SlidersHorizontal, FilterX, PersonStanding, Move, Utensils, Bath, ArrowUpFromLine, ShieldCheck, Droplet, Pill, Stethoscope, HeartPulse, Languages, ScanSearch, Biohazard, UserCheck, Briefcase, Car, Check, X, FileText, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormItem } from '@/components/ui/form';


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
  | 'Rejected after Orientation'
  | 'Hired';

interface EnrichedCandidate extends CaregiverProfile {
  status: CandidateStatus;
}

const hiringStatuses: CandidateStatus[] = [
  'Applied', 'Hired', 'Orientation Scheduled', 'Final Interview Passed', 'Final Interview Pending', 'Final Interview Failed', 'Phone Screen Failed', 'Rejected after Orientation'
];

type FormData = {
    skills: (typeof skillsAndAttributes)[number]['id'][];
    hiringStatus: CandidateStatus | 'any';
    skillMatching: 'any' | 'all';
};

type SortKey = 'fullName' | 'city' | 'createdAt';

const dayAbbreviations: { [key: string]: string } = {
    monday: 'Mo',
    tuesday: 'Tu',
    wednesday: 'We',
    thursday: 'Th',
    friday: 'Fr',
    saturday: 'Sa',
    sunday: 'Su',
};

const ConciseAvailability = ({ availability }: { availability: CaregiverProfile['availability'] | undefined }) => {
    if (!availability) {
        return <span className="text-muted-foreground">N/A</span>;
    }

    const availableDays = (Object.keys(dayAbbreviations) as (keyof typeof dayAbbreviations)[])
        .filter(day => availability[day] && availability[day].length > 0)
        .map(day => dayAbbreviations[day]);

    if (availableDays.length === 0) {
        return <span className="text-muted-foreground">None</span>;
    }
    
    if(availableDays.length === 7) {
        return <Badge variant="secondary">Every Day</Badge>
    }

    return (
        <div className="flex gap-1 flex-wrap">
            {availableDays.map(day => (
                <span key={day} className="font-mono text-xs p-1 bg-muted rounded-sm">{day}</span>
            ))}
        </div>
    );
};

const BooleanDisplay = ({ value }: { value: boolean | undefined }) => 
  value ? <Check className="text-green-500"/> : <X className="text-red-500"/>;

const AvailabilityDisplay = ({ availability }: { availability: CaregiverProfile['availability'] | undefined }) => {
    if (!availability) return <p>Not specified</p>;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
        <div className="space-y-2">
            {days.map(day => {
                const shifts = availability[day as keyof typeof availability];
                if (shifts && shifts.length > 0) {
                    return (
                        <div key={day} className="grid grid-cols-[100px_1fr] items-start">
                            <span className="font-semibold capitalize">{day}:</span>
                            <div className="flex flex-wrap gap-1">
                                {shifts.map(shift => <Badge key={shift} variant="secondary" className="capitalize">{shift}</Badge>)}
                            </div>
                        </div>
                    )
                }
                return null;
            })}
        </div>
    )
}

const ProfileDialog = ({ candidate }: { candidate: CaregiverProfile | null }) => {
    if (!candidate) return null;

    return (
        <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
                <DialogTitle className="text-2xl">{candidate.fullName}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <h3 className="font-semibold text-lg flex items-center"><Briefcase className="mr-2 h-5 w-5 text-accent" />Experience</h3>
                <p><span className="font-semibold">Years:</span> {candidate.yearsExperience}</p>
                <p><span className="font-semibold">Summary:</span> {candidate.summary}</p>
                
                <Separator className="my-2"/>
                
                 <h3 className="font-semibold text-lg flex items-center mb-2"><Stethoscope className="mr-2 h-5 w-5 text-accent" />Skills & Experience</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p className="flex items-center"><span className="font-semibold w-48">Able to change brief:</span> <BooleanDisplay value={candidate.canChangeBrief} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to Transfer:</span> <BooleanDisplay value={candidate.canTransfer} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to prepare meals:</span> <BooleanDisplay value={candidate.canPrepareMeals} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Bed bath/shower assistance:</span> <BooleanDisplay value={candidate.canDoBedBath} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to use Hoyer Lift:</span> <BooleanDisplay value={candidate.canUseHoyerLift} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to use Gait Belt:</span> <BooleanDisplay value={candidate.canUseGaitBelt} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to use a Purwick:</span> <BooleanDisplay value={candidate.canUsePurwick} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to empty catheter:</span> <BooleanDisplay value={candidate.canEmptyCatheter} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to empty colostomy bag:</span> <BooleanDisplay value={candidate.canEmptyColostomyBag} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to give medication:</span> <BooleanDisplay value={candidate.canGiveMedication} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Able to take blood Pressure:</span> <BooleanDisplay value={candidate.canTakeBloodPressure} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Dementia patients experience:</span> <BooleanDisplay value={candidate.hasDementiaExperience} /></p>
                    <p className="flex items-center"><span className="font-semibold w-48">Hospice patients experience:</span> <BooleanDisplay value={candidate.hasHospiceExperience} /></p>
                </div>

                <Separator className="my-2"/>
                
                <h3 className="font-semibold text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-accent" />Certifications</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">HCA:</span> <BooleanDisplay value={candidate.hca} /></p>
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">HHA:</span> <BooleanDisplay value={candidate.hha} /></p>
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">CNA:</span> <BooleanDisplay value={candidate.cna} /></p>
                    <p className="flex items-center gap-2"><ScanSearch className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">Live Scan:</span> <BooleanDisplay value={candidate.liveScan} /></p>
                    <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">TB Test:</span> <BooleanDisplay value={candidate.negativeTbTest} /></p>
                    <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">CPR/First Aid:</span> <BooleanDisplay value={candidate.cprFirstAid} /></p>
                    <p className="flex items-center gap-2"><Biohazard className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">COVID Work:</span> <BooleanDisplay value={candidate.canWorkWithCovid} /></p>
                    <p className='flex items-center gap-2'><Biohazard className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">COVID Vaccine:</span> <BooleanDisplay value={candidate.covidVaccine} /></p>
                </div>
                {candidate.otherLanguages && <p className="flex items-center gap-2"><Languages className="h-4 w-4 mt-1 text-muted-foreground" /><span className="font-semibold">Other Languages:</span> {candidate.otherLanguages}</p>}
                {candidate.otherCertifications && <p><span className="font-semibold">Other:</span> {candidate.otherCertifications}</p>}
                
                <Separator className="my-2"/>
                
                <h3 className="font-semibold text-lg flex items-center">Availability</h3>
                <AvailabilityDisplay availability={candidate.availability} />

                <Separator className="my-2"/>
                
                <h3 className="font-semibold text-lg flex items-center"><Car className="mr-2 h-5 w-5 text-accent" />Transportation</h3>
                 <p><span className="font-semibold">Has Vehicle:</span> {candidate.hasCar}</p>
                 <p><span className="font-semibold">Valid License:</span> {candidate.validLicense}</p>
              </div>
        </DialogContent>
    );
};


export default function AdvancedSearchClient() {
    const { handleSubmit, control, reset } = useForm<FormData>({
        defaultValues: { skills: [], hiringStatus: 'any', skillMatching: 'any' }
    });
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [filteredResults, setFilteredResults] = useState<EnrichedCandidate[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();
    const [viewingCandidate, setViewingCandidate] = useState<EnrichedCandidate | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;
    const router = useRouter();

    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
                if (interview.finalInterviewStatus === 'Rejected after Orientation') return 'Rejected after Orientation';
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


    const onSubmit = useCallback((data: FormData) => {
        startSearchTransition(() => {
            let results = [...candidates];
            
            // Filter by skills
            if (data.skills.length > 0) {
                if (data.skillMatching === 'all') {
                    results = results.filter(candidate => 
                        data.skills.every(skill => (candidate as any)[skill] === true)
                    );
                } else { // 'any'
                    results = results.filter(candidate => 
                        data.skills.some(skill => (candidate as any)[skill] === true)
                    );
                }
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
            setCurrentPage(1); // Reset to first page on new search
            setHasSearched(true);
        });
    }, [candidates, dateRange]);
    
    useEffect(() => {
        if (candidates.length > 0 && !hasSearched) {
            onSubmit({ skills: [], hiringStatus: 'any', skillMatching: 'any' });
        }
    }, [candidates, hasSearched, onSubmit]);
    
    const handleClearFilters = () => {
        reset({ skills: [], hiringStatus: 'any', skillMatching: 'any' });
        setDateRange(undefined);
        setFilteredResults([]);
        setHasSearched(false);
        // Rerun the initial search after clearing
        onSubmit({ skills: [], hiringStatus: 'any', skillMatching: 'any' });
    }

    const sortedResults = useMemo(() => {
        return [...filteredResults].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];

            let compare = 0;
            if (aVal === undefined || aVal === null) compare = -1;
            if (bVal === undefined || bVal === null) compare = 1;

            if (sortKey === 'createdAt') {
                const dateA = (aVal as any)?.toDate() || 0;
                const dateB = (bVal as any)?.toDate() || 0;
                if (dateA < dateB) compare = -1;
                if (dateA > dateB) compare = 1;
            } else {
                if (String(aVal) < String(bVal)) compare = -1;
                if (String(aVal) > String(bVal)) compare = 1;
            }

            return sortDirection === 'asc' ? compare : -compare;
        });
    }, [filteredResults, sortKey, sortDirection]);

    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return sortedResults.slice(startIndex, endIndex);
    }, [sortedResults, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(sortedResults.length / rowsPerPage);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const SortableHeader = ({ sortKey: key, label }: { sortKey: SortKey, label: string }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => handleSort(key)} className="px-2 py-1">
                {label}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );
    
    const isLoading = profilesLoading || interviewsLoading || employeesLoading;
    
    const isActionable = (status: CandidateStatus) => {
        return !['Hired', 'Final Interview Failed', 'Phone Screen Failed', 'Rejected after Orientation'].includes(status);
    }

    const handleManageInterviewClick = (candidateName: string) => {
        router.push(`/admin/manage-interviews?search=${encodeURIComponent(candidateName)}`);
    };

    return (
        <div className="space-y-6">
            <Form {...control}>
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
                                <Label>Skills & Attributes</Label>
                                <div className="flex items-center gap-4">
                                    <Controller
                                        name="skillMatching"
                                        control={control}
                                        render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="any" id="any" /></FormControl>
                                                    <Label htmlFor="any" className="font-normal">Any Selected</Label>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="all" id="all" /></FormControl>
                                                    <Label htmlFor="all" className="font-normal">All Selected</Label>
                                                </FormItem>
                                            </RadioGroup>
                                        )}
                                    />
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
                                                    ? field.onChange([...(field.value || []), skill.id])
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
            </Form>

            {(hasSearched || isLoading) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results</CardTitle>
                        <CardDescription>
                            {isSearching ? 'Applying filters...' : `Found ${sortedResults.length} candidates matching your criteria.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isSearching || isLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                            </div>
                        ) : sortedResults.length > 0 ? (
                            <>
                            <Dialog onOpenChange={(isOpen) => !isOpen && setViewingCandidate(null)}>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <SortableHeader sortKey="fullName" label="Name" />
                                            <SortableHeader sortKey="city" label="City" />
                                            <TableHead>Phone</TableHead>
                                            <SortableHeader sortKey="createdAt" label="Application Date" />
                                            <TableHead>Status</TableHead>
                                            <TableHead>Availability</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedResults.map(candidate => (
                                            <TableRow key={candidate.id}>
                                                <TableCell>
                                                    <DialogTrigger asChild>
                                                        <button onClick={() => setViewingCandidate(candidate)} className="text-left">
                                                            <div className="font-medium hover:underline">{candidate.fullName}</div>
                                                            <div className="text-sm text-muted-foreground">{candidate.email}</div>
                                                        </button>
                                                    </DialogTrigger>
                                                </TableCell>
                                                <TableCell>{candidate.city}</TableCell>
                                                <TableCell>{candidate.phone}</TableCell>
                                                <TableCell>
                                                    {candidate.createdAt ? format((candidate.createdAt as any).toDate(), 'PP') : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={candidate.status === 'Hired' ? 'default' : 'secondary'}>{candidate.status}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <ConciseAvailability availability={candidate.availability} />
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
                                <ProfileDialog candidate={viewingCandidate} />
                            </Dialog>
                             <div className="flex items-center justify-between mt-4">
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                            </>
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
