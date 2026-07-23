/**
 * Map a tenant user row to a select-option label (IMP-011-PX1).
 */
export type BindUserOption = {
  readonly id: string;
  readonly email?: string | null;
  readonly displayName?: string | null;
};

export function formatUserBindLabel(user: BindUserOption): string {
  const name = user.displayName?.trim();
  if (name !== undefined && name !== '') {
    const email = user.email?.trim();
    if (email !== undefined && email !== '') {
      return `${name} (${email})`;
    }
    return name;
  }
  const email = user.email?.trim();
  if (email !== undefined && email !== '') {
    return email;
  }
  const id = user.id;
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
