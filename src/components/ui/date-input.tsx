"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { FormFieldContext } from "@/components/ui/form"

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
    const fieldContext = React.useContext(FormFieldContext)
    const form = useFormContext()
    
    // Determine if we should use context or props
    const isFormControlled = form && fieldContext?.name

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateString(e.target.value)
      if (isFormControlled) {
        form.setValue(fieldContext.name, formatted, { shouldValidate: true, shouldDirty: true })
      } else if (onChange) {
        // Fallback for when used as a standard controlled component
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: formatted },
        }
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
      }
    }
    
    // Use the value from the form context if available, otherwise use the prop
    const displayValue = isFormControlled ? form.watch(fieldContext.name) : value;

    return (
      <Input
        {...props}
        ref={ref}
        name={isFormControlled ? fieldContext.name : props.name}
        value={(displayValue as string) || ""}
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
