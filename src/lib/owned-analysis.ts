// Database-independent boundary so ownership behavior can be tested without an
// auth cookie or live Neon access. The trusted caller supplies the session ID.
export async function findOwnedAnalysis<T extends { userId: string }>(
  fetchRecord: (where: { id: string; userId: string }) => Promise<T | null>,
  userId: string | null | undefined,
  id: string,
): Promise<T | null> {
  if (!userId || !id || id.length > 128) return null;
  const record = await fetchRecord({ id, userId });
  return record?.userId === userId ? record : null;
}

// Ownership is part of the mutation itself, avoiding a read/delete race.
export async function deleteOwnedAnalysis(
  deleteRecords: (where: { id: string; userId: string }) => Promise<{ count: number }>,
  userId: string | null | undefined,
  id: string,
): Promise<boolean> {
  if (!userId || !id || id.length > 128) return false;
  const result = await deleteRecords({ id, userId });
  return result.count === 1;
}
