import assert from 'node:assert/strict';
import { execPath } from 'node:process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { pbkdf2Sync } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildCreatePropertyPayload } from '../lib/listingPayload';

type JsonRecord = Record<string, unknown>;
type ApiResponse = { status: number; body: JsonRecord | JsonRecord[] };

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, '../../og-landmark-web/server.js');
const seedPath = join(here, '../../og-landmark-web/runtime-data.json');

function fixturePassword(password: string): string {
  const salt = 'task31-fixture-salt';
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

async function freePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(child: ChildProcess, baseUrl: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok || response.status === 503) return;
    } catch {
      // The server is still binding or initializing.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the API server.');
}

async function request(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: JsonRecord } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json() as JsonRecord | JsonRecord[],
  };
}

function objectBody(response: ApiResponse): JsonRecord {
  assert.equal(Array.isArray(response.body), false);
  return response.body as JsonRecord;
}

function tokenFrom(response: ApiResponse): string {
  const body = objectBody(response);
  assert.equal(response.status, 200);
  assert.equal(typeof body.token, 'string');
  return body.token as string;
}

test('authenticated listing lifecycle keeps media, seller review context, and status sync intact', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'og-landmark-task31-'));
  const dataPath = join(tempDir, 'runtime-data.json');
  let child: ChildProcess | undefined;

  try {
    const seed = JSON.parse(await readFile(seedPath, 'utf8')) as JsonRecord;
    seed.users = [
      {
        id: 1,
        name: 'Task 31 Admin',
        email: 'task31-admin@example.com',
        role: 'Admin',
        status: 'Active',
        password: fixturePassword('Task31AdminPass123!'),
      },
      {
        id: 2,
        name: 'Task 31 Seller',
        email: 'task31-seller@example.com',
        role: 'Seller',
        status: 'Active',
        password: fixturePassword('Task31SellerPass123!'),
      },
    ];
    seed.properties = [];
    seed.nextId = 1000;
    await writeFile(dataPath, JSON.stringify(seed));

    const port = await freePort();
    child = spawn(execPath, [serverPath], {
      cwd: dirname(serverPath),
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        REPLIT_ENVIRONMENT: '1',
        LARAVEL_API_URL: '',
        DATABASE_URL: '',
        NEON_DATABASE_URL: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        PORT: String(port),
        OG_LANDMARK_RUNTIME_DATA: dataPath,
      },
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(child, baseUrl);

    const sellerToken = tokenFrom(await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'task31-seller@example.com', password: 'Task31SellerPass123!' },
    }));
    const adminToken = tokenFrom(await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'task31-admin@example.com', password: 'Task31AdminPass123!' },
    }));

    const validListing = buildCreatePropertyPayload({
      title: 'Task 31 Lifecycle House',
      type: 'House',
      status: 'For Sale',
      price: 25000000,
      area: 10,
      areaUnit: 'Marla',
      bedrooms: 3,
      bathrooms: 2,
      city: 'Okara',
      neighborhood: 'Model Town',
      locality: 'Model Town',
      district: 'Okara District',
      tehsil: 'Okara',
      streetAddress: '12 Main Road',
      fullAddress: '12 Main Road, Model Town, Okara',
      description: 'A complete lifecycle integration fixture.',
      latitude: 30.8077123,
      longitude: 73.4561988,
      images: [
        'https://cdn.example.com/task31-front.jpg',
        'https://cdn.example.com/task31-garden.jpg',
      ],
      coverImage: 'https://cdn.example.com/task31-garden.jpg',
      features: ['Parking', 'Security'],
    });

    const created = await request(baseUrl, '/api/properties', {
      method: 'POST',
      token: sellerToken,
      body: validListing as unknown as JsonRecord,
    });
    assert.equal(created.status, 201);
    const createdProperty = objectBody(created);
    const propertyId = Number(createdProperty.id);
    assert.equal(createdProperty.approvalStatus, 'Pending');
    assert.deepEqual(createdProperty.images, validListing.images);
    assert.equal(createdProperty.coverImage, validListing.coverImage);
    assert.equal(createdProperty.sellerId, 2);
    assert.equal(createdProperty.lat, 30.8077123);
    assert.equal(createdProperty.lng, 73.4561988);
    assert.equal((createdProperty.location as JsonRecord).latitude, 30.8077123);
    assert.equal((createdProperty.location as JsonRecord).longitude, 73.4561988);

    const adminList = await request(baseUrl, '/api/admin/properties?status=Pending', {
      token: adminToken,
    });
    assert.equal(adminList.status, 200);
    assert.ok(Array.isArray(adminList.body));
    const listedProperty = adminList.body.find(item => Number(item.id) === propertyId) as JsonRecord | undefined;
    assert.ok(listedProperty);
    assert.equal(listedProperty.lat, 30.8077123);
    assert.equal(listedProperty.lng, 73.4561988);
    assert.equal((listedProperty.location as JsonRecord).latitude, 30.8077123);
    assert.equal((listedProperty.location as JsonRecord).longitude, 73.4561988);

    const review = await request(baseUrl, `/api/admin/properties/${propertyId}/review`, {
      token: adminToken,
    });
    assert.equal(review.status, 200);
    const reviewBody = objectBody(review);
    const reviewedProperty = reviewBody.property as JsonRecord;
    const seller = reviewBody.seller as JsonRecord;
    assert.equal(reviewedProperty.id, propertyId);
    assert.equal(reviewedProperty.sellerName, 'Task 31 Seller');
    assert.deepEqual(reviewedProperty.images, validListing.images);
    assert.equal(reviewedProperty.coverImage, validListing.coverImage);
    assert.equal(reviewedProperty.lat, 30.8077123);
    assert.equal(reviewedProperty.lng, 73.4561988);
    assert.equal((reviewedProperty.location as JsonRecord).latitude, 30.8077123);
    assert.equal((reviewedProperty.location as JsonRecord).longitude, 73.4561988);
    assert.equal(seller.id, 2);
    assert.equal(seller.email, 'task31-seller@example.com');
    assert.equal('password' in seller, false);
    assert.ok(Array.isArray(reviewBody.audit));

    const approved = await request(baseUrl, `/api/properties/${propertyId}/approve`, {
      method: 'PATCH',
      token: adminToken,
    });
    assert.equal(approved.status, 200);

    const sellerListingsAfterApproval = await request(baseUrl, '/api/my-properties', {
      token: sellerToken,
    });
    assert.equal(sellerListingsAfterApproval.status, 200);
    const approvedListing = (sellerListingsAfterApproval.body as JsonRecord[]).find(item => item.id === propertyId);
    assert.equal(approvedListing?.approvalStatus, 'Active');
    assert.equal(approvedListing?.listingStatus, 'Active');
    assert.equal(approvedListing?.rejectionReason, null);

    const rejectedCreate = await request(baseUrl, '/api/properties', {
      method: 'POST',
      token: sellerToken,
      body: {
        ...validListing,
        title: 'Task 31 Rejection House',
        coverImage: validListing.images?.[0],
      } as unknown as JsonRecord,
    });
    assert.equal(rejectedCreate.status, 201);
    const rejectedId = Number(objectBody(rejectedCreate).id);
    const rejectionReason = 'Please provide the ownership document before publishing.';
    const rejected = await request(baseUrl, `/api/properties/${rejectedId}/reject`, {
      method: 'PATCH',
      token: adminToken,
      body: { reason: rejectionReason },
    });
    assert.equal(rejected.status, 200);

    const sellerListingsAfterRejection = await request(baseUrl, '/api/my-properties', {
      token: sellerToken,
    });
    const rejectedListing = (sellerListingsAfterRejection.body as JsonRecord[]).find(item => item.id === rejectedId);
    assert.equal(rejectedListing?.approvalStatus, 'Rejected');
    assert.equal(rejectedListing?.listingStatus, 'Paused');
    assert.equal(rejectedListing?.rejectionReason, rejectionReason);

    const invalid = await request(baseUrl, '/api/properties', {
      method: 'POST',
      token: sellerToken,
      body: {
        title: '',
        type: '',
        price: -1,
        area: 0,
        images: [],
        location: { latitude: 0, longitude: 0 },
      },
    });
    assert.equal(invalid.status, 422);
    const invalidBody = objectBody(invalid);
    assert.equal(invalidBody.code, 'LISTING_VALIDATION_FAILED');
    assert.ok(Array.isArray(invalidBody.fields));
    assert.deepEqual(invalidBody.fields, [
      'title is required',
      'type is required',
      'price must be a valid number',
      'area must be greater than zero',
      'an exact latitude and longitude are required',
      'city is required',
      'district is required',
      'tehsil is required',
      'locality is required',
      'address is required',
      'at least one image is required',
    ]);
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => undefined);
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});