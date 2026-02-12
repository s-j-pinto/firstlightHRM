
"use client";

import { useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import SignatureCanvas from 'react-signature-canvas';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function HCS501Page() {
    const sigPadRef = useRef<SignatureCanvas>(null);

    const clearSignature = () => {
        sigPadRef.current?.clear();
    };

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="text-sm text-muted-foreground">
                        State of California – Health and Human Services Agency
                        <br />
                        California Department of Social Services
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                        Community Care Licensing Division
                        <br />
                        Home Care Services Bureau
                    </div>
                </div>
                <CardTitle className="text-center pt-4 tracking-wider">
                    PERSONNEL RECORD
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="border p-4 rounded-md space-y-4">
                    <p className="text-center text-xs text-muted-foreground">(Form to be kept current at all times) FOR HOME CARE ORGANIZATION (HCO) USE ONLY</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hcoNumber">HCO Number</Label>
                            <Input id="hcoNumber" value="364700059" readOnly />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="perId">Employee’s PER ID</Label>
                            <Input id="perId" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hireDate">Hire Date</Label>
                            <Input id="hireDate" type="date" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="separationDate">Date of Separation</Label>
                            <Input id="separationDate" type="date" />
                        </div>
                    </div>
                </div>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Personal
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name (Last First Middle)</Label>
                            <Input id="name" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="telephone">Area Code/Telephone</Label>
                            <Input id="telephone" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input id="address" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dob">Date of Birth</Label>
                            <Input id="dob" type="date" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="ssn">Social Security Number <span className="text-muted-foreground">(Voluntary for ID only)</span></Label>
                        <Input id="ssn" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="tbDate">Date of TB Test Upon Hire</Label>
                            <Input id="tbDate" type="date" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="tbResults">Results of Last TB Test</Label>
                            <Input id="tbResults" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="additionalTbDates">Additional TB Test Dates (Please include test results)</Label>
                        <Textarea id="additionalTbDates" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="alternateNames">Please list any alternate names used (For example - maiden name)</Label>
                        <Input id="alternateNames" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div className="space-y-2">
                            <Label>Do you possess a valid California driver’s license?</Label>
                            <RadioGroup className="flex gap-4 pt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="yes" id="cdl-yes" />
                                    <Label htmlFor="cdl-yes" className="font-normal">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="no" id="cdl-no" />
                                    <Label htmlFor="cdl-no" className="font-normal">No</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cdlNumber">CDL Number:</Label>
                            <Input id="cdlNumber" />
                        </div>
                    </div>
                </div>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        POSITION INFORMATION
                        </span>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="titleOfPosition">Title of Position</Label>
                        <Input id="titleOfPosition" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="notes">Notes:</Label>
                        <Textarea id="notes" rows={5} />
                    </div>
                    <div className="border p-4 rounded-md space-y-4">
                        <p className="text-sm font-bold">I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Label>Employee Signature</Label>
                                <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                    <SignatureCanvas
                                        ref={sigPadRef}
                                        penColor='black'
                                        canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    />
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Clear Signature
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signatureDate">Date</Label>
                                <Input id="signatureDate" type="date" />
                            </div>
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
