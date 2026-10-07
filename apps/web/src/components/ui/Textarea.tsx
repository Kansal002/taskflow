import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Field, controlStyles } from './Field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  containerClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Labelled multi-line input that grows with its content (CSS `field-sizing`). */
export function Textarea({
  label,
  hideLabel,
  hint,
  error,
  className,
  containerClassName,
  ref,
  ...props
}: TextareaProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlStyles, 'resize-y py-2 leading-relaxed [field-sizing:content]', className)}
          {...props}
        />
      )}
    </Field>
  );
}
