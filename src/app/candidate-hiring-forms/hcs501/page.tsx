
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HCS501Page() {
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
            </CardContent>
        </Card>
    );
}
