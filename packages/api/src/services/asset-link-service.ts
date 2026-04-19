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
 * Ownership is enforced at the service layer: the asset must belong to `userId`
 * or the call throws. This is defense-in-depth so agent tools, batch jobs, or
 * future callers cannot bypass route-layer authorization. The idempotency
 * contract relies on the `asset_project_links_uniq` unique index on
 * `(asset_id, project_id)` plus `onConflictDoNothing()`.
 *
 * NOTE: `unlinkAssetFromProject` and `listProjectAssets` currently rely on the
 * route layer for authorization — cross-entity ownership (link may point at a
 * project the user owns but an asset they don't, or vice versa) is trickier and
 * out of scope for this service. The creation side is the main attack surface.
 */
export async function linkAssetToProject(
  input: LinkInput,
): Promise<typeof assetProjectLinks.$inferSelect> {
  // Service-layer ownership: asset must belong to userId. Defense-in-depth so
  // agent tools / batch jobs / future callers can't bypass route-layer checks.
  const [owned] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, input.assetId), eq(assets.userId, input.userId)))
    .limit(1);
  if (!owned) {
    throw new Error(
      `asset ${input.assetId} not found or not owned by user ${input.userId}`,
    );
  }

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
    // the first or Nth call for the pair. The unique index on
    // `(assetId, projectId)` guarantees at most one matching row, so a plain
    // `where + limit(1)` is sufficient.
    const [existing] = await db
      .select()
      .from(assetProjectLinks)
      .where(
        and(
          eq(assetProjectLinks.assetId, input.assetId),
          eq(assetProjectLinks.projectId, input.projectId),
        ),
      )
      .limit(1);
    return existing;
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
 *
 * @remarks
 * Ownership is NOT enforced here — the route layer is responsible for checking
 * that `userId` is allowed to touch this link. See `linkAssetToProject` for
 * the rationale.
 */
export async function unlinkAssetFromProject(
  input: Omit<LinkInput, 'addedVia'>,
): Promise<boolean> {
  const rows = await db
    .delete(assetProjectLinks)
    .where(
      and(
        eq(assetProjectLinks.assetId, input.assetId),
        eq(assetProjectLinks.projectId, input.projectId),
      ),
    )
    .returning({ id: assetProjectLinks.id });
  const removed = rows.length > 0;
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
 *
 * @remarks
 * Ownership is NOT enforced here — the route layer is responsible for checking
 * that `userId` is allowed to read this project's assets.
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
