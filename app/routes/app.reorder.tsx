import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Badge, BlockStack, Card, DataTable, EmptyState, Layout, Page, Text } from "@shopify/polaris";
import prisma from "../db.server";
import { suggestReorders } from "../lib/reorder/velocity";
import { fetchAllVariants, fetchSalesSince, toStockLines } from "../lib/shopify/catalog";
import { authenticate } from "../shopify.server";

/**
 * What is about to run out, and how much to buy.
 *
 * The formula is deliberately visible in the UI. A merchant who can see
 * "2.0/day, 5 days left, 14 day lead time" can tell us when it is wrong;
 * a merchant shown only a number has to either trust it or ignore it.
 */

const WINDOW_DAYS = 30;
const COVER_TARGET_DAYS = 14;
const DEFAULT_LEAD_TIME_DAYS = 14;

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    update: {},
    create: { domain: session.shop },
  });

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const client = admin as unknown as { graphql: typeof admin.graphql };

  const [variants, sales, items] = await Promise.all([
    fetchAllVariants(client),
    fetchSalesSince(client, since),
    prisma.supplierItem.findMany({
      where: { supplier: { shopId: shop.id }, variantId: { not: null } },
      include: { supplier: true },
    }),
  ]);

  const leadTimes = new Map<string, number>();
  const supplierNames = new Map<string, string>();
  for (const item of items) {
    if (!item.variantId) continue;
    leadTimes.set(item.variantId, item.supplier.leadTimeDays);
    supplierNames.set(item.variantId, item.supplier.name);
  }

  const suggestions = suggestReorders(toStockLines(variants, leadTimes, DEFAULT_LEAD_TIME_DAYS), sales, {
    windowDays: WINDOW_DAYS,
    coverTargetDays: COVER_TARGET_DAYS,
    now,
  });

  const rows = suggestions
    .filter((s) => s.needsReorder)
    .sort((a, b) => a.daysOfCover - b.daysOfCover)
    .map((s) => ({
      title: s.title ?? s.variantId,
      supplier: supplierNames.get(s.variantId) ?? null,
      unitsPerDay: Number(s.unitsPerDay.toFixed(2)),
      available: s.available,
      daysOfCover: Number(s.daysOfCover.toFixed(1)),
      suggestedQty: s.suggestedQty,
      reason: s.reason,
    }));

  return { rows, mappedCount: leadTimes.size };
}

export default function Reorder() {
  const { rows, mappedCount } = useLoaderData<typeof loader>();

  if (rows.length === 0) {
    return (
      <Page title="Reorder">
        <Card>
          <EmptyState heading="Nothing needs reordering" image="">
            <Text as="p">
              Every product has enough cover for its supplier lead time, based on the last {WINDOW_DAYS} days of sales.
            </Text>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Reorder" subtitle={`Based on the last ${WINDOW_DAYS} days of sales`}>
      <Layout>
        {mappedCount === 0 && (
          <Layout.Section>
            <Card>
              <Text as="p" tone="subdued">
                No products are mapped to a supplier yet, so these use a {DEFAULT_LEAD_TIME_DAYS} day lead time.
                Import your suppliers to make these numbers real.
              </Text>
            </Card>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <DataTable
                columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "numeric"]}
                headings={["Product", "Supplier", "Sold/day", "In stock", "Days left", "Order"]}
                rows={rows.map((r) => [
                  r.title,
                  r.supplier ?? "—",
                  r.unitsPerDay,
                  r.available,
                  <Badge key={r.title} tone={r.daysOfCover < 7 ? "critical" : "attention"}>
                    {String(r.daysOfCover)}
                  </Badge>,
                  r.suggestedQty,
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
