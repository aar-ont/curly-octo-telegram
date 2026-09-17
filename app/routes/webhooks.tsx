import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Shopify verifies these are handled before approving the listing, and the
 * GDPR topics are a common rejection reason. Deleting on uninstall is also
 * simply correct: we hold a merchant's supplier list and cost prices.
 */
export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) await prisma.session.deleteMany({ where: { shop } });
      // Cascades to suppliers, POs and events.
      await prisma.shop.deleteMany({ where: { domain: shop } });
      break;

    case "SHOP_REDACT":
      await prisma.shop.deleteMany({ where: { domain: shop } });
      break;

    // We store no customer data — suppliers are businesses, not customers —
    // so there is nothing to return or erase. Acknowledge explicitly rather
    // than falling through, so the intent is on the record.
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
}
