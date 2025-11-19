
"use client";

import { useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelOfCareSchema, type LevelOfCareFormData } from "@/lib/level-of-care.actions";
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc } from 'firebase/firestore';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { saveLevelOfCare } from "@/lib/level-of-care.actions";
import { Loader2, Save } from "lucide-react";

interface LevelOfCareFormProps {
    initialContactId: string;
    assessmentId: string | null;
    onSave: () => void;
}

const levels = [
    {
        title: "Level 0: Independent",
        fields: [
            { id: "level_0_independent_in_emergency", label: "Independent in Emergency" },
            { id: "level_0_able_to_negotiate_stairs", label: "Able to negotiate stairs" },
            { id: "level_0_able_to_bathe", label: "Able to bathe" },
            { id: "level_0_able_to_dress", label: "Able to dress" },
            { id: "level_0_able_to_groom", label: "Able to groom" },
            { id: "level_0_able_to_transfer_and_ambulate", label: "Able to transfer and ambulate" },
            { id: "level_0_able_to_use_toilet", label: "Able to use toilet" },
            { id: "level_0_take_medications", label: "Take medications" },
            { id: "level_0_able_to_prepare_and_eat_meals", label: "Able to prepare and eat meals" },
            { id: "level_0_light_housekeeping", label: "Light housekeeping" },
            { id: "level_0_able_to_plan_social_activities", label: "Able to plan social activities" },
            { id: "level_0_little_to_no_family_concern", label: "Little to no family concern" },
        ]
    },
    {
        title: "Level 1: Minimum Assist",
        fields: [
            { id: "level_1_able_to_respond_in_emergency", label: "Able to respond in an emergency" },
            { id: "level_1_ambulates_independently", label: "Ambulates independently" },
            { id: "level_1_infrequent_falls", label: "Infrequent falls" },
            { id: "level_1_independent_to_verbal_reminders", label: "Independent to verbal reminders for ADLS" },
            { id: "level_1_continent_bladder_bowel", label: "Continent bladder/bowel" },
            { id: "level_1_independent_baths", label: "Independent baths" },
            { id: "level_1_meal_prep_assistance_helpful", label: "Meal prep assistance maybe helpful" },
            { id: "level_1_housekeeping_assistance_helpful", label: "Housekeeping assistance may be helpful" },
            { id: "level_1_some_encouragement_for_social_activities", label: "Some encouragement for social activities" },
            { id: "level_1_oriented_to_self", label: "Oriented to self" },
            { id: "level_1_little_memory_impairment", label: "Little memory impairment" },
            { id: "level_1_family_slightly_concerned", label: "Family slightly concerned" },
        ]
    },
    {
        title: "Level 2: Stand-by Assist",
        fields: [
            { id: "level_2_may_need_assistance_in_emergency", label: "May need assistance in an emergency" },
            { id: "level_2_transfer_stand_by_assist", label: "Transfer: stand-by assist may be needed" },
            { id: "level_2_needs_reminders_for_adls", label: "Needs reminders for ADLs" },
            { id: "level_2_medication_management_helpful", label: "Medication management helpful" },
            { id: "level_2_some_incontinence_assistance", label: "Some incontinence assistance" },
            { id: "level_2_some_bathing_assistance", label: "Some bathing assistance" },
            { id: "level_2_some_meal_prep_planning_assistance", label: "Some meal prep/planning assistance" },
            { id: "level_2_some_housekeeping_assistance", label: "Some housekeeping assistance" },
            { id: "level_2_reminders_encourage_participation", label: "Reminders/ encourage participation" },
            { id: "level_2_mild_memory_impairment", label: "Mild memory impairment" },
            { id: "level_2_sometimes_disoriented", label: "Sometimes disoriented" },
            { id: "level_2_family_concerned", label: "Family Concerned" },
        ]
    },
    {
        title: "Level 3: Hands-on Assist",
        fields: [
            { id: "level_3_needs_assistance_in_emergency", label: "Needs assistance in an emergency" },
            { id: "level_3_transfer_one_person_assist", label: "Transfer: one person assist" },
            { id: "level_3_verbal_cues_to_hands_on_assist", label: "Verbal cues to hands-on assist for ADLS" },
            { id: "level_3_medication_management", label: "Medication management" },
            { id: "level_3_incontinence_management", label: "Incontinence management" },
            { id: "level_3_needs_bathing_assistance", label: "Needs bathing assistance" },
            { id: "level_3_meal_prep_assistance_needed", label: "Meal prep assistance needed" },
            { id: "level_3_housekeeping_assistance_needed", label: "Housekeeping assistance needed" },
            { id: "level_3_encouragement_escort_to_social_activities", label: "Encouragement/ escort to social activities" },
            { id: "level_3_impaired_memory", label: "Impaired memory" },
            { id: "level_3_poor_orientation", label: "Poor orientation" },
            { id: "level_3_mild_confusion", label: "Mild confusion" },
            { id: "level_3_family_very_concerned", label: "Family very concerned" },
        ]
    },
    {
        title: "Level 4: Total Assist",
        fields: [
            { id: "level_4_needs_supervision_in_emergency", label: "Needs supervision in an emergency" },
            { id: "level_4_transfer_two_person_or_mechanical_lift", label: "Transfer: two person or mechanical lift" },
            { id: "level_4_hands_on_assistance_with_adls", label: "Hands-on assistance with ADLS" },
            { id: "level_4_medication_management", label: "Medication management" },
            { id: "level_4_behavior_management", label: "Behavior management" },
            { id: "level_4_bathing_assistance", label: "Bathing assistance" },
            { id: "level_4_verbal_cues_hands_on_assistance_to_eat", label: "Verbal cues/hands-on assistance to eat" },
            { id: "level_4_needs_housekeeping", label: "Needs housekeeping" },
            { id: "level_4_encouragement_escort_or_one_on_one", label: "Encouragement/ escort or one-on-one" },
            { id: "level_4_needs_24_hour_supervision", label: "Needs 24-hour supervision" },
            { id: "level_4_needs_skilled_services", label: "Needs skilled services (PT, OT, ST)" },
            { id: "level_4_severe_cognitive_and_memory_impairment", label: "Severe cognitive and memory impairment" },
        ]
    }
];

export function LevelOfCareForm({ initialContactId, assessmentId, onSave }: LevelOfCareFormProps) {
    const [isSaving, startSavingTransition] = useTransition();
    const { toast } = useToast();

    const assessmentDocRef = useMemoFirebase(() => assessmentId ? doc(firestore, 'level_of_care_assessments', assessmentId) : null, [assessmentId]);
    const { data: existingData, isLoading } = useDoc<LevelOfCareFormData>(assessmentDocRef);

    const form = useForm<LevelOfCareFormData>({
        resolver: zodResolver(levelOfCareSchema),
        defaultValues: {},
    });

    useEffect(() => {
        if (existingData) {
            form.reset(existingData);
        }
    }, [existingData, form]);

    const onSubmit = (data: LevelOfCareFormData) => {
        startSavingTransition(async () => {
            const result = await saveLevelOfCare({
                initialContactId,
                assessmentId,
                formData: data,
            });
            if (result.error) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            } else {
                toast({ title: "Success", description: result.message });
                onSave();
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[60vh] overflow-y-auto pr-4">
                    {levels.map(level => (
                        <Card key={level.title}>
                            <CardHeader className="p-4">
                                <CardTitle className="text-md">{level.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                {level.fields.map(field => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={field.id as keyof LevelOfCareFormData}
                                        render={({ field: formField }) => (
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={formField.value}
                                                        onCheckedChange={formField.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="text-sm font-normal">
                                                    {field.label}
                                                </FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
                 <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                        Save Level of Care
                    </Button>
                </div>
            </form>
        </Form>
    );
}
