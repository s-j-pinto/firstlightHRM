
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

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
                <p className="text-center text-muted-foreground">Ready for the first section of fields.</p>
            </CardContent>
        </Card>
    );
}
