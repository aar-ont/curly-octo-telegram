import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { BlockStack, Banner, Button, Card, InlineGrid, Layout, Page, Text } from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    update: {},
    create: { domain: session.shop },
  });

  const [supplierCount, openPos, itemCount] = await Promise.all([
    prisma.supplier.count({ where: { shopId: shop.id } }),
    prisma.purchaseOrder.count({ where: { shopId: shop.id, status: { in: ["sent", "confirmed", "partial"] } } }),
    prisma.supplierItem.count({ where: { supplier: { shopId: shop.id } } }),
  ]);

  return { supplierCount, openPos, itemCount };
}

export default function Index() {
  const { supplierCount, openPos, itemCount } = useLoaderData<typeof loader>();

  return (
    <Page title="Restock">
      <Layout>
        {supplierCount === 0 && (
          <Layout.Section>
            <Banner title="Start by rebuilding your supplier list" tone="info">
              <BlockStack gap="200">
                <Text as="p">
                  Stocky could not export supplier records, so they have to be recreated. Upload your old purchase
                  orders — PDFs, scans, spreadsheets, or forwarded emails — and we will pull the suppliers, part
                  numbers and cost prices out of them for you to check.
                </Text>
                <div>
                  <Link to="/app/migrate">
                    <Button variant="primary">Import suppliers</Button>
                  </Link>
                </div>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <Stat label="Suppliers" value={supplierCount} />
            <Stat label="Products mapped" value={itemCount} />
            <Stat label="Open purchase orders" value={openPos} />
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {String(value)}
        </Text>
      </BlockStack>
    </Card>
  );
}
