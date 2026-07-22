import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { withRoute } from "@/lib/server/http";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { ALLOWED_MIME, MAX_FILE_BYTES, mimeMatchesContent, safeName, writeFileBuffer } from "@/lib/server/storage";

const CATEGORIES = new Set(["xray", "photo", "document", "medical"]);

/** List files for a patient: GET /api/admin/patient-files?patientKey=pt-xxx */
export const GET = withRoute("patient-files.GET", patientFilesGet);

async function patientFilesGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const patientKey = new URL(req.url).searchParams.get("patientKey");
  if (!patientKey) return NextResponse.json({ error: "missing_patientKey" }, { status: 400 });

  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 500 });
  const where = { patientKey };
  const files = await prisma.patientFile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pg.take,
    skip: pg.skip,
    select: {
      id: true,
      category: true,
      title: true,
      fileName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
  });
  const total = pg.applied ? await prisma.patientFile.count({ where }) : files.length;
  return jsonWithPagination({ files }, total, pg);
}

/** Upload a file (multipart form-data): fields file, patientKey, category?, title?, patientName? */
export const POST = withRoute("patient-files.POST", patientFilesPost);

async function patientFilesPost(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }

  const file = form.get("file");
  const patientKey = String(form.get("patientKey") ?? "").trim();
  const patientName = String(form.get("patientName") ?? "").trim() || null;
  const categoryRaw = String(form.get("category") ?? "xray").trim();
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "document";
  const title = String(form.get("title") ?? "").trim() || null;

  if (!patientKey) return NextResponse.json({ error: "missing_patientKey" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "bad_type", type: file.type }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());

  // Content-based validation: the magic bytes must match the declared type,
  // and the sanitized name must not contain traversal components.
  if (!mimeMatchesContent(file.type, buf)) {
    return NextResponse.json({ error: "content_mismatch", type: file.type }, { status: 415 });
  }
  const safe = safeName(file.name);
  if (safe.includes("..") || safe.startsWith(".")) {
    return NextResponse.json({ error: "invalid_filename" }, { status: 400 });
  }
  const stored = `${randomUUID()}__${safe}`;
  await writeFileBuffer(stored, buf);

  const rec = await prisma.patientFile.create({
    data: {
      patientKey,
      patientName,
      category,
      title,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath: stored,
    },
    select: { id: true, category: true, title: true, fileName: true, mimeType: true, size: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, file: rec });
}
