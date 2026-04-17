"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type DateInputProps = React.InputHTMLAttributes<HTMLInputElement>

const formatDateString = (value: string): string => {
  const digits = value.replace(/\D/g, "")
  let formatted = ""

  if (digits.length > 0) {
    formatted += digits.substring(0, 2)
  }
  if (digits.length > 2) {
    formatted += "/" + digits.substring(2, 4)
  }
  if (digits.length > 4) {
    formatted += "/" + digits.substring(4, 8)
  }
  return formatted
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, onChange, value, ...props }, ref) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateString(e.target.value)
      if (onChange) {
        // Create a synthetic event to pass to the original onChange
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: formatted,
          },
        }
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
      }
    }

    return (
      <Input
        {...props}
        ref={ref}
        value={(value as string) || ""}
        onChange={handleInputChange}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        className={cn("font-mono", className)}
      />
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }
