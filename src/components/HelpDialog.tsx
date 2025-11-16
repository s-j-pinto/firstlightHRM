"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import helpContent from "@/lib/help-content.json";

interface HelpDialogProps {
  topic: keyof typeof helpContent;
}

export function HelpDialog({ topic }: HelpDialogProps) {
  const content = helpContent[topic];

  if (!content) {
    return null;
  }
  
  const renderContent = () => {
    return content.content.map((item, index) => {
      switch (item.type) {
        case 'paragraph':
          return <p key={index} className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: item.text }} />;
        case 'heading':
          return <h3 key={index} className="font-semibold text-md mt-4 mb-2" dangerouslySetInnerHTML={{ __html: item.text }} />;
        case 'list':
          return (
            <ul key={index} className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {item.items.map((li, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: li }} />
              ))}
            </ul>
          );
        default:
          return null;
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Open Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
