import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  DropZone,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import prisma from "../db.server";
import { extractSupplierData } from "../lib/extraction/extract";
import { MAX_DOCUMENT_BYTES, isSupported, type InputDocument } from "../lib/extraction/documents";
import type { ExtractionResult } from "../lib/extraction/schema";
import { matchItems, type MatchResult } from "../lib/matching/match";
import { fetchAllVariants, toMatchCandidates } from "../lib/shopify/catalog";
import { authenticate } from "../shopify.server";

/**
 * Supplier reconstruction — the reason a merchant installs this app.
 *
 * Nothing extracted is written to the database from here. The merchant reviews
 * every row first. That review step is not a nicety: it is what turns a wrong
 * extraction from a support ticket into a five-second correction.
 */

interface ReviewRow {
  supplier: string;
  supplierSku: string | null;
  title: string | null;
  unitCost: number | null;
  match: MatchResult;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    update: {},
    create: { domain: session.shop },
  });

  const jobs = await prisma.importJob.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return { jobs: jobs.map((j) => ({ id: j.id, filename: j.filename, status: j.status, error: j.error })) };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shop = await prisma.shop.upsert({
    where: { domain: session.shop },
    update: {},
    create: { domain: session.shop },
  });

  const formData = await unstable_parseMultipartFormData(
    request,
    unstable_createMemoryUploadHandler({ maxPartSize: MAX_DOCUMENT_BYTES }),
  );

  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "Choose at least one file to import.", rows: null, notes: null };
  }

  const unsupported = files.filter((f) => !isSupported(f.type));
  if (unsupported.length > 0) {
    return {
      error: `Cannot read ${unsupported.map((f) => f.name).join(", ")}. Upload PDFs, images, CSVs or emails.`,
      rows: null,
      notes: null,
    };
  }

  const documents: InputDocument[] = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    })),
  );

  const job = await prisma.importJob.create({
    data: { shopId: shop.id, filename: documents.map((d) => d.filename).join(", "), status: "extracting" },
  });

  try {
    // Catalogue and extraction are independent; no reason to wait twice.
    const [extracted, variants] = await Promise.all([
      extractSupplierData(documents),
      fetchAllVariants(admin as unknown as { graphql: typeof admin.graphql }),
    ]);

    const rows = buildReviewRows(extracted, toMatchCandidates(variants));

    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "review", result: JSON.stringify({ extracted, rows }) },
    });

    return { error: null, rows, notes: extracted.notes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.importJob.update({ where: { id: job.id }, data: { status: "failed", error: message } });
    return { error: message, rows: null, notes: null };
  }
}

function buildReviewRows(extracted: ExtractionResult, candidates: ReturnType<typeof toMatchCandidates>): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const supplier of extracted.suppliers) {
    const matches = matchItems(
      supplier.items.map((i) => ({ supplierSku: i.supplierSku, title: i.title })),
      candidates,
    );
    supplier.items.forEach((item, i) => {
      rows.push({
        supplier: supplier.name,
        supplierSku: item.supplierSku,
        title: item.title,
        unitCost: item.unitCost,
        match: matches[i],
      });
    });
  }
  return rows;
}

export default function Migrate() {
  const { jobs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const [files, setFiles] = useState<File[]>([]);

  return (
    <Page title="Import suppliers" subtitle="Rebuild the supplier data Stocky could not export">
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical" title="Import failed">
              <Text as="p">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Form method="post" encType="multipart/form-data">
              <BlockStack gap="400">
                <Text as="p">
                  Upload old purchase orders, supplier price lists, or exported spreadsheets. Anything readable works —
                  including photos of paper. Nothing is saved until you have reviewed it.
                </Text>

                <DropZone
                  accept="application/pdf,image/*,text/csv,text/plain"
                  onDrop={(accepted: File[]) => setFiles(accepted)}
                >
                  {files.length > 0 ? (
                    <BlockStack gap="100">
                      {files.map((f) => (
                        <Text as="p" key={f.name}>
                          {f.name}
                        </Text>
                      ))}
                    </BlockStack>
                  ) : (
                    <DropZone.FileUpload actionTitle="Add files" actionHint="PDF, image, CSV or email" />
                  )}
                </DropZone>

                {/* DropZone holds the files in React state; this mirrors them
                    into the form so a normal multipart POST carries them. */}
                <input
                  type="file"
                  name="documents"
                  multiple
                  hidden
                  ref={(input) => {
                    if (!input) return;
                    const transfer = new DataTransfer();
                    files.forEach((f) => transfer.items.add(f));
                    input.files = transfer.files;
                  }}
                />

                <div>
                  <Button submit variant="primary" loading={busy} disabled={files.length === 0}>
                    Extract suppliers
                  </Button>
                </div>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>

        {actionData?.notes && (
          <Layout.Section>
            <Banner tone="warning" title="Worth checking">
              <Text as="p">{actionData.notes}</Text>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.rows && <ReviewTable rows={actionData.rows} />}

        {jobs.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Recent imports
                </Text>
                {jobs.map((job) => (
                  <Text as="p" key={job.id}>
                    {job.filename} — {job.status}
                    {job.error ? `: ${job.error}` : ""}
                  </Text>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  const needsAttention = rows.filter((r) => r.match.confidence !== "exact").length;

  return (
    <Layout.Section>
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Review {rows.length} items
          </Text>
          {needsAttention > 0 && (
            <Text as="p" tone="subdued">
              {needsAttention} could not be matched with certainty. Check those before applying — everything else
              matched on an exact SKU.
            </Text>
          )}
          <DataTable
            columnContentTypes={["text", "text", "text", "numeric", "text"]}
            headings={["Supplier", "SKU", "Product", "Cost", "Match"]}
            rows={rows.map((r) => [
              r.supplier,
              r.supplierSku ?? "—",
              r.title ?? "—",
              r.unitCost === null ? "—" : r.unitCost.toFixed(2),
              <MatchBadge key={`${r.supplier}-${r.supplierSku}`} match={r.match} />,
            ])}
          />
        </BlockStack>
      </Card>
    </Layout.Section>
  );
}

function MatchBadge({ match }: { match: MatchResult }) {
  if (match.confidence === "exact") return <Badge tone="success">Matched</Badge>;
  if (match.confidence === "likely") return <Badge tone="attention">{match.reason}</Badge>;
  return <Badge tone="critical">{match.reason}</Badge>;
}
