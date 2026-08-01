"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, error, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[#5E5E5E] mb-1">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {hint && <span className="ml-1 font-normal text-[#5E5E5E]/50">({hint})</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function inputCls(isInvalid: boolean) {
  return cn(
    "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#3D4430]/40 transition-colors",
    isInvalid ? "border-red-300 bg-red-50/30" : "border-[#E9E9E7]"
  )
}

export function inputAriaProps(field: string, hasError: boolean) {
  return {
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? `${field}-error` : undefined,
  } as const
}
