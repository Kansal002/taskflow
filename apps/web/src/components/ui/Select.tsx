import { ChevronDown } from 'lucide-react';
import type { Ref, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Field, controlStyles } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  options: readonly SelectOption[];
  containerClassName?: string;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * Styled *native* select. Native selects get keyboard, touch and screen-reader
 * support for free, which beats re-implementing a listbox for simple choices.
 */
export function Select({
  label,
  hideLabel,
  hint,
  error,
  options,
  className,
  containerClassName,
  ref,
  ...props
}: SelectProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlStyles, 'h-9 cursor-pointer appearance-none pr-8', className)}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-zinc-400"
          />
        </div>
      )}
    </Field>
  );
}
