/**
 * Reads from Shopify that feed the pure modules.
 *
 * Nothing here decides anything — it fetches variants for the matcher and sales
 * for the velocity calculation. Keeping the API surface this thin is what lets
 * the interesting logic be tested without a store.
 */

import type { VariantCandidate } from "../matching/match";
import type { SaleEvent, StockLine } from "../reorder/velocity";

/** The subset of Shopify's admin client we use; makes this testable with a fake. */
export interface GraphQLClient {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

const VARIANTS_QUERY = `#graphql
  query Variants($cursor: String) {
    productVariants(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        sku
        title
        displayName
        inventoryQuantity
      }
    }
  }
`;

interface VariantNode {
  id: string;
  sku: string | null;
  title: string;
  displayName: string;
  inventoryQuantity: number | null;
}

/**
 * Pulls the whole catalogue. Paginated at Shopify's maximum page size because
 * the matcher needs every candidate — a partial catalogue produces confident
 * "no match" results, which is the one failure mode we are trying to avoid.
 */
export async function fetchAllVariants(client: GraphQLClient): Promise<VariantNode[]> {
  const nodes: VariantNode[] = [];
  let cursor: string | null = null;

  do {
    const response = await client.graphql(VARIANTS_QUERY, { variables: { cursor } });
    const body = (await response.json()) as {
      data?: { productVariants: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: VariantNode[] } };
      errors?: unknown;
    };
    if (!body.data) throw new Error(`Shopify rejected the catalogue query: ${JSON.stringify(body.errors)}`);

    nodes.push(...body.data.productVariants.nodes);
    cursor = body.data.productVariants.pageInfo.hasNextPage ? body.data.productVariants.pageInfo.endCursor : null;
  } while (cursor);

  return nodes;
}

export function toMatchCandidates(variants: VariantNode[]): VariantCandidate[] {
  return variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    // displayName is "Product - Variant", which is what a supplier document
    // usually resembles; bare `title` is often just "Default Title".
    title: v.displayName || v.title,
  }));
}

export function toStockLines(
  variants: VariantNode[],
  leadTimeByVariant: Map<string, number>,
  defaultLeadTimeDays: number,
): StockLine[] {
  return variants.map((v) => ({
    variantId: v.id,
    title: v.displayName || v.title,
    onHand: v.inventoryQuantity ?? 0,
    leadTimeDays: leadTimeByVariant.get(v.id) ?? defaultLeadTimeDays,
  }));
}

const ORDERS_QUERY = `#graphql
  query Orders($query: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        lineItems(first: 100) {
          nodes {
            quantity
            variant { id }
          }
        }
      }
    }
  }
`;

/**
 * Sales events over a trailing window, flattened for the velocity calculation.
 *
 * Cancelled orders are excluded at the query level: a cancelled order is not
 * demand, and counting it would have us reorder stock nobody bought.
 */
export async function fetchSalesSince(client: GraphQLClient, since: Date): Promise<SaleEvent[]> {
  const sales: SaleEvent[] = [];
  let cursor: string | null = null;
  const query = `created_at:>=${since.toISOString()} AND cancelled_at:null`;

  do {
    const response = await client.graphql(ORDERS_QUERY, { variables: { query, cursor } });
    const body = (await response.json()) as {
      data?: {
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: { createdAt: string; lineItems: { nodes: { quantity: number; variant: { id: string } | null }[] } }[];
        };
      };
      errors?: unknown;
    };
    if (!body.data) throw new Error(`Shopify rejected the orders query: ${JSON.stringify(body.errors)}`);

    for (const order of body.data.orders.nodes) {
      const occurredAt = new Date(order.createdAt);
      for (const line of order.lineItems.nodes) {
        // Deleted products leave line items with no variant. They are real
        // history but cannot be reordered, so they are not demand we can act on.
        if (!line.variant) continue;
        sales.push({ variantId: line.variant.id, quantity: line.quantity, occurredAt });
      }
    }

    cursor = body.data.orders.pageInfo.hasNextPage ? body.data.orders.pageInfo.endCursor : null;
  } while (cursor);

  return sales;
}
