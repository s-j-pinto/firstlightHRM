
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { sourceCategories } from "@/lib/sources"

interface SourceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SourceCombobox({ value, onChange, disabled }: SourceComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value
            ? sourceCategories.flatMap(g => g.sources).find((source) => source.value === value)?.label
            : "Select a source..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search for a source..." />
          <CommandList>
            <CommandEmpty>No source found.</CommandEmpty>
            {sourceCategories.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.sources.map((source) => (
                  <CommandItem
                    key={source.value}
                    value={source.label}
                    onSelect={() => {
                      onChange(source.value)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === source.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {source.label}
                  </CommandItem>
                ))}
                <CommandSeparator />
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
