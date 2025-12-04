
"use client";

import * as React from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { format } from "date-fns";
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define the shape of the email documents from the 'mail' collection
interface MailDocument {
  id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  message: {
    subject: string;
    html: string;
  };
  delivery?: {
    startTime: any;
    endTime: any;
    state: "SUCCESS" | "ERROR" | "PROCESSING" | "PENDING";
    error?: string;
    leaseExpireTime?: any;
    attempts: number;
    deliveryId?: string;
  };
}

export default function NotificationsClient() {
  const [selectedMail, setSelectedMail] = useState<MailDocument | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const mailQuery = useMemoFirebase(
    () => query(collection(firestore, "mail"), orderBy("delivery.startTime", "desc")),
    []
  );
  const { data: mailDocs, isLoading } = useCollection<MailDocument>(mailQuery);
  
  const filteredMail = useMemo(() => {
    if (!mailDocs) return [];
    
    return mailDocs.filter(mail => {
      const lowerSearch = searchTerm.toLowerCase();
      const recipientMatch = mail.to.some(r => r.toLowerCase().includes(lowerSearch));
      const subjectMatch = mail.message.subject.toLowerCase().includes(lowerSearch);
      
      const status = mail.delivery?.state || "PENDING";
      const statusMatch = statusFilter === 'all' || status.toLowerCase() === statusFilter;
      
      return (recipientMatch || subjectMatch) && statusMatch;
    });
  }, [mailDocs, searchTerm, statusFilter]);

  const StatusIcon = ({ status }: { status?: string }) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "ERROR":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "PROCESSING":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
      {/* Left Pane: Email List */}
      <Card className="md:col-span-1 lg:col-span-1 flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-4">
             <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by recipient or subject..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by status..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SUCCESS">Success</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="flex flex-row-reverse h-full">
            <ScrollArea className="h-full w-full">
              {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                  <Loader2 className="animate-spin text-accent" />
                  </div>
              ) : filteredMail.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No notifications found.</div>
              ) : (
                  <div className="space-y-2 p-4">
                  {filteredMail.map((mail) => (
                      <button
                      key={mail.id}
                      onClick={() => setSelectedMail(mail)}
                      className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          selectedMail?.id === mail.id
                          ? "bg-accent text-accent-foreground border-accent"
                          : "hover:bg-muted/50"
                      )}
                      >
                      <div className="flex justify-between items-start">
                          <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-semibold truncate">{mail.to.join(", ")}</p>
                              <p className="text-xs text-muted-foreground truncate">{mail.message.subject}</p>
                          </div>
                          <StatusIcon status={mail.delivery?.state} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                          {mail.delivery?.startTime ? format((mail.delivery.startTime as any).toDate(), 'PPp') : 'Pending...'}
                      </p>
                      </button>
                  ))}
                  </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Right Pane: Email Preview */}
      <Card className="md:col-span-2 lg:col-span-3 flex flex-col">
        <CardHeader>
          <CardTitle>Email Preview</CardTitle>
          <CardDescription>
            {selectedMail ? `Details for email sent to ${selectedMail.to.join(', ')}` : "Select an email from the list to view its content."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {selectedMail ? (
            <div className="space-y-4">
                {selectedMail.delivery?.state === 'ERROR' && selectedMail.delivery.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Delivery Error</AlertTitle>
                        <AlertDescription className="text-xs whitespace-pre-wrap">
                            {selectedMail.delivery.error}
                        </AlertDescription>
                    </Alert>
                )}
              <div className="border rounded-lg overflow-hidden h-[calc(100vh-20rem)] flex flex-col">
                <div className="p-4 bg-muted/50 text-sm border-b">
                  <p><strong>To:</strong> {selectedMail.to.join(', ')}</p>
                  <p><strong>Subject:</strong> {selectedMail.message.subject}</p>
                </div>
                <div className="p-0 bg-white flex-1">
                  <iframe
                    key={selectedMail.id} // Force re-mount on email change
                    className="w-full h-full border-0"
                    title="Email Content"
                    srcDoc={selectedMail.message.html}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Mail className="h-16 w-16 mb-4" />
                <h3 className="text-lg font-medium">No Email Selected</h3>
                <p>Select an email from the left panel to see its details here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
