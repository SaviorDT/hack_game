export function hasUppercase(label: string): boolean {
  return /[A-Z]/.test(label)
}

export function assertValidLabel(label: string, context = 'label'): void {
  if (hasUppercase(label)) {
    throw new Error(`Invalid ${context}: "${label}" must not contain uppercase letters.`)
  }
}

