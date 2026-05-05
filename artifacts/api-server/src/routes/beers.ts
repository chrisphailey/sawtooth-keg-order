import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, beersTable } from "@workspace/db";
import {
  ListBeersQueryParams,
  CreateBeerBody,
  GetBeerParams,
  UpdateBeerParams,
  UpdateBeerBody,
  DeleteBeerParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/beers", async (req, res): Promise<void> => {
  const parsed = ListBeersQueryParams.safeParse(req.query);
  const beers = await db.select().from(beersTable).orderBy(beersTable.name);
  const filtered =
    parsed.success && parsed.data.availableOnly
      ? beers.filter((b) => b.available)
      : beers;
  res.json(
    filtered.map((b) => ({
      ...b,
      price: Number(b.price),
    })),
  );
});

router.post("/beers", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBeerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [beer] = await db
    .insert(beersTable)
    .values({
      ...parsed.data,
      price: String(parsed.data.price),
    })
    .returning();
  res.status(201).json({ ...beer, price: Number(beer.price) });
});

router.get("/beers/:id", async (req, res): Promise<void> => {
  const params = GetBeerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [beer] = await db
    .select()
    .from(beersTable)
    .where(eq(beersTable.id, params.data.id));
  if (!beer) {
    res.status(404).json({ error: "Beer not found" });
    return;
  }
  res.json({ ...beer, price: Number(beer.price) });
});

router.patch("/beers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateBeerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBeerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) {
    updateData.price = String(parsed.data.price);
  }
  const [beer] = await db
    .update(beersTable)
    .set(updateData)
    .where(eq(beersTable.id, params.data.id))
    .returning();
  if (!beer) {
    res.status(404).json({ error: "Beer not found" });
    return;
  }
  res.json({ ...beer, price: Number(beer.price) });
});

router.delete("/beers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBeerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [beer] = await db
    .delete(beersTable)
    .where(eq(beersTable.id, params.data.id))
    .returning();
  if (!beer) {
    res.status(404).json({ error: "Beer not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
