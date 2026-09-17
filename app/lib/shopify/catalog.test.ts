import { describe, expect, it } from "vitest";
import { fetchAllVariants, fetchSalesSince, toMatchCandidates, toStockLines, type GraphQLClient } from "./catalog";

/** Returns each queued payload in turn, so pagination can be exercised. */
function fakeClient(pages: unknown[]): GraphQLClient {
  let call = 0;
  return {
    graphql: async () => new Response(JSON.stringify(pages[call++])),
  };
}

describe("fetchAllVariants", () => {
  it("follows pagination to the end", async () => {
    const client = fakeClient([
      {
        data: {
          productVariants: {
            pageInfo: { hasNextPage: true, endCursor: "c1" },
            nodes: [{ id: "v1", sku: "A", title: "One", displayName: "P - One", inventoryQuantity: 3 }],
          },
        },
      },
      {
        data: {
          productVariants: {
            pageInfo: { hasNextPage: false, endCursor: "c2" },
            nodes: [{ id: "v2", sku: "B", title: "Two", displayName: "P - Two", inventoryQuantity: 0 }],
          },
        },
      },
    ]);
    const variants = await fetchAllVariants(client);
    expect(variants.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("throws rather than returning a partial catalogue on error", async () => {
    const client = fakeClient([{ errors: [{ message: "Throttled" }] }]);
    await expect(fetchAllVariants(client)).rejects.toThrow(/Throttled/);
  });
});

describe("mappers", () => {
  const variants = [
    { id: "v1", sku: "A", title: "Default Title", displayName: "Widget - Blue", inventoryQuantity: 5 },
    { id: "v2", sku: null, title: "Two", displayName: "", inventoryQuantity: null },
  ];

  it("prefers displayName, which is what supplier paperwork resembles", () => {
    expect(toMatchCandidates(variants)[0].title).toBe("Widget - Blue");
  });

  it("falls back to title when displayName is empty", () => {
    expect(toMatchCandidates(variants)[1].title).toBe("Two");
  });

  it("applies per-variant lead times with a default fallback", () => {
    const lines = toStockLines(variants, new Map([["v1", 3]]), 14);
    expect(lines[0].leadTimeDays).toBe(3);
    expect(lines[1].leadTimeDays).toBe(14);
    expect(lines[1].onHand).toBe(0);
  });
});

describe("fetchSalesSince", () => {
  it("flattens line items and skips deleted variants", async () => {
    const client = fakeClient([
      {
        data: {
          orders: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                createdAt: "2026-09-01T00:00:00Z",
                lineItems: {
                  nodes: [
                    { quantity: 2, variant: { id: "v1" } },
                    { quantity: 9, variant: null },
                  ],
                },
              },
            ],
          },
        },
      },
    ]);
    const sales = await fetchSalesSince(client, new Date("2026-08-01T00:00:00Z"));
    expect(sales).toEqual([{ variantId: "v1", quantity: 2, occurredAt: new Date("2026-09-01T00:00:00Z") }]);
  });

  it("excludes cancelled orders at the query level", async () => {
    let captured = "";
    const client: GraphQLClient = {
      graphql: async (_q, options) => {
        captured = String((options?.variables as { query: string }).query);
        return new Response(
          JSON.stringify({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } }),
        );
      },
    };
    await fetchSalesSince(client, new Date("2026-08-01T00:00:00Z"));
    expect(captured).toContain("cancelled_at:null");
  });
});
