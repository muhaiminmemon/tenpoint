-- The edge axis is gone: a finish now prints as its stock alone ("Filmstrip"),
-- where it used to print as "<stock> <edge>" ("Filmstrip Gold"). Rows written
-- under the old naming can never match a finish again, so they would sit in
-- held_variants unreachable — a person's history quietly losing entries.
--
-- Someone who held "Filmstrip Gold" did genuinely hold Filmstrip stock, so the
-- honest migration is to collapse rather than delete. Ordering matters: the
-- de-duplication runs first, so the surviving row is the oldest one under
-- either naming and first_held_at keeps meaning "when they first held it".

-- 1. Collapse each user's rows-per-stock down to the oldest, counting the bare
--    name and its composites as the same finish. Without this the rename below
--    would violate held_variants_user_variant_uq.
DELETE FROM "held_variants"
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT
			h."id",
			row_number() OVER (
				PARTITION BY h."user_id", s."name"
				ORDER BY h."first_held_at" ASC, h."id" ASC
			) AS rn
		FROM "held_variants" h
		JOIN (VALUES
			('Vellum'), ('Neon Rain'), ('Filmstrip'), ('Marble'), ('Nebula'), ('Bare')
		) AS s("name")
			ON h."variant_name" = s."name"
			OR h."variant_name" LIKE s."name" || ' %'
	) ranked
	WHERE ranked.rn > 1
);
--> statement-breakpoint
-- 2. Rename the survivors onto the stock they were always printed on.
UPDATE "held_variants" h
SET "variant_name" = s."name"
FROM (VALUES
	('Vellum'), ('Neon Rain'), ('Filmstrip'), ('Marble'), ('Nebula'), ('Bare')
) AS s("name")
WHERE h."variant_name" LIKE s."name" || ' %';
