"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import type { LevelOfCareFormData } from '@/lib/types';

const levelOfCareFields = [
    // Level 1
    { id: "level_1_independent_to_verbal_reminders", label: "Needs Verbal Reminders for ADLs" },
    // Level 2
    { id: "level_2_transfer_stand_by_assist", label: "Stand-by Transfer Assist" },
    { id: "level_2_some_bathing_assistance", label: "Some Bathing Assistance" },
    { id: "level_2_mild_memory_impairment", label: "Mild Memory Impairment" },
    // Level 3
    { id: "level_3_transfer_one_person_assist", label: "One-Person Transfer Assist" },
    { id: "level_3_incontinence_management", label: "Incontinence Management" },
    { id: "level_3_needs_bathing_assistance", label: "Needs Bathing Assistance" },
    { id: "level_3_impaired_memory", label: "Impaired Memory" },
    // Level 4
    { id: "level_4_transfer_two_person_or_mechanical_lift", label: "Two-Person/Hoyer Lift Transfer" },
    { id: "level_4_hands_on_assistance_with_adls", label: "Hands-on ADL Assistance" },
    { id: "level_4_behavior_management", label: "Behavior Management" },
    { id: "level_4_severe_cognitive_and_memory_impairment", label: "Severe Cognitive Impairment" },
];

export default function LevelOfCareReport() {
  const assessmentsQuery = useMemoFirebase(() => query(collection(firestore, 'level_of_care_assessments')), []);
  const { data: assessments, isLoading } = useCollection<LevelOfCareFormData>(assessmentsQuery);

  const needsSummary = useMemo(() => {
    if (!assessments || assessments.length === 0) return [];

    const totalAssessments = assessments.length;
    const needsCount: { [key: string]: number } = {};

    levelOfCareFields.forEach(field => {
        needsCount[field.id] = 0;
    });

    assessments.forEach(assessment => {
      levelOfCareFields.forEach(field => {
        if ((assessment as any)[field.id]) {
          needsCount[field.id]++;
        }
      });
    });

    return levelOfCareFields.map(field => ({
      label: field.label,
      count: needsCount[field.id],
      percentage: (needsCount[field.id] / totalAssessments) * 100,
    })).sort((a, b) => b.count - a.count);

  }, [assessments]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity /> Level of Care Needs Analysis</CardTitle>
        <CardDescription>
          A summary of the most common care needs identified during assessments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsSummary.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Care Need</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Number of Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needsSummary.map(need => (
                <TableRow key={need.label}>
                  <TableCell className="font-medium">{need.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Progress value={need.percentage} className="w-32" />
                        <span>{need.percentage.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{need.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">No Level of Care Assessment data found.</p>
        )}
      </CardContent>
    </Card>
  );
}
