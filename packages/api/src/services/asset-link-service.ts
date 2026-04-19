import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assets, assetProjectLinks } from '../db/schema.js';
import { emitAssetEvent } from './asset-events.js';

export type AddedVia = 'upload' | 'chat' | 'generated' | 'library';

export interface LinkInput {
  assetId: string;
  projectId: string;
  userId: string;
  addedVia: AddedVia;
}

/**
 * Links an existing asset to a project. Idempotent: repeated calls with the same
 * `(assetId, projectId)` pair return the pre-existing link row instead of inserting
 * a duplicate. Only the first successful insertion emits a `linked` event; subsequent
 * no-op calls stay silent so SSE consumers do not see phantom link events.
 *
 * @remarks
 * The idempotency contract relies on the `asset_project_links_uniq` unique index on
 * `(asset_id, project_id)` plus `onConflictDoNothing()`. When the insert no-ops,
 * we look up the existing row via an inner join against `assets` so future callers
 * that want to surface asset metadata in the same query have a natural extension
 * point — the current implementation only reads the link side.
 */
export async function linkAssetToProject(
  input: LinkInput,
): Promise<typeof assetProjectLinks.$inferSelect> {
  const [row] = await db
    .insert(assetProjectLinks)
    .values({
      assetId: input.assetId,
      projectId: input.projectId,
      addedVia: input.addedVia,
    })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    // Insert was a no-op — the link already exists. Re-read and return it so
    // callers always get a concrete row back regardless of whether this was
    // the first or Nth call for the pair.
    const rows = await db
      .select()
      .from(assetProjectLinks)
      .innerJoin(assets, eq(assetProjectLinks.assetId, assets.id))
      .where(
        and(
          eq(assetProjectLinks.assetId, input.assetId),
          eq(assetProjectLinks.projectId, input.projectId),
        ),
      )
      .orderBy(desc(assetProjectLinks.addedAt));
    return rows[0].asset_project_links as typeof assetProjectLinks.$inferSelect;
  }

  await emitAssetEvent({
    assetId: input.assetId,
    userId: input.userId,
    projectId: input.projectId,
    type: 'linked',
    payload: { addedVia: input.addedVia },
  });
  return row;
}

/**
 * Removes a link between an asset and a project. Returns `true` when a row was
 * actually deleted, `false` when no matching link existed. Emits an `unlinked`
 * event only on real deletions so repeated unlink calls do not spam subscribers.
 */
export async function unlinkAssetFromProject(
  input: Omit<LinkInput, 'addedVia'>,
): Promise<boolean> {
  const result = await db
    .delete(assetProjectLinks)
    .where(
      and(
        eq(assetProjectLinks.assetId, input.assetId),
        eq(assetProjectLinks.projectId, input.projectId),
      ),
    );
  const removed = (result as unknown as { rowCount: number }).rowCount > 0;
  if (removed) {
    await emitAssetEvent({
      assetId: input.assetId,
      userId: input.userId,
      projectId: input.projectId,
      type: 'unlinked',
      payload: {},
    });
  }
  return removed;
}

/**
 * Lists the non-deleted assets linked to a project, newest link first. Filters by
 * `assets.status = 'ready'` at the SQL layer so half-ingested or soft-deleted
 * assets never leak into project views.
 */
export async function listProjectAssets(
  projectId: string,
): Promise<(typeof assets.$inferSelect)[]> {
  const rows = await db
    .select({ asset: assets })
    .from(assetProjectLinks)
    .innerJoin(assets, eq(assetProjectLinks.assetId, assets.id))
    .where(
      and(
        eq(assetProjectLinks.projectId, projectId),
        eq(assets.status, 'ready'),
      ),
    )
    .orderBy(desc(assetProjectLinks.addedAt));
  return rows.map((r) => r.asset);
}
