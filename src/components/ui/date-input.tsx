"use client";

import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  name: string;
};

const formatDateString = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  let formatted = "";

  if (digits.length > 0) {
    formatted += digits.substring(0, 2);
  }
  if (digits.length > 2) {
    formatted += "/" + digits.substring(2, 4);
  }
  if (digits.length > 4) {
    formatted += "/" + digits.substring(4, 8);
  }
  return formatted;
};

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ name, className, ...props }, ref) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value, ...restField } }) => {
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          let input = e.target.value;
          const formatted = formatDateString(input);
          onChange(formatted);
        };

        return (
          <Input
            {...props}
            {...restField}
            ref={ref}
            value={value || ""}
            onChange={handleInputChange}
            placeholder="MM/DD/YYYY"
            maxLength={10}
            className={cn("font-mono", className)}
          />
        );
      }}
    />
  );
});
DateInput.displayName = "DateInput";

export { DateInput };
