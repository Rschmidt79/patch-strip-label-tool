export function shouldCommitNumberFieldBlur(
  focusedContextKey: string | undefined,
  currentContextKey: string | undefined,
): boolean {
  return currentContextKey === undefined || focusedContextKey === currentContextKey
}
