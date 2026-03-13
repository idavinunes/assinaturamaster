"use client";

import clsx from "clsx";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  className,
  pendingLabel,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={clsx(className)}
      disabled={pending || props.disabled}
      {...props}
    >
      {pending ? pendingLabel ?? "Salvando..." : children}
    </button>
  );
}
