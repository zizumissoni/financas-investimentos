/**
 * Fallback localStorage store for patrimony item owners.
 * Used when the 'owner' column doesn't exist in the DB yet.
 * Once the column is added via SQL migration, the DB value takes priority.
 */
const key = (uid: string) => `pat_owners_${uid}`

export function getOwnerMap(uid: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function saveOwner(uid: string, itemId: string, owner: string): void {
  try {
    const map = getOwnerMap(uid)
    map[itemId] = owner
    localStorage.setItem(key(uid), JSON.stringify(map))
  } catch {}
}
