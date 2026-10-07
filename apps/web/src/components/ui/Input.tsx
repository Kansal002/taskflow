import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '../../lib/cn';
import { Field, controlStyles } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Labelled text input. The label is required; use `hideLabel` for visually-hidden labels. */
export function Input({ label, hideLabel, hint, error, className, containerClassName, ref, ...props }: InputProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlStyles, 'h-9', className)}
          {...props}
        />
      )}
    </Field>
  );
}
