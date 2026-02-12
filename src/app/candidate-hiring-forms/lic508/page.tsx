
"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function LIC508Page() {
    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="text-sm text-muted-foreground">
                    State of California – Health and Human Services Agency
                    <br />
                    California Department of Social Services
                </div>
                <CardTitle className="text-center pt-4 tracking-wider">
                    CRIMINAL RECORD STATEMENT
                </CardTitle>
            </CardHeader>
        </Card>
    );
}
