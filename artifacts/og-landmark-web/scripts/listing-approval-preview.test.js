'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');
const test = require('node:test');

const webRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(webRoot, '../og-landmark-mobile');
const laravelRoot = path.resolve(webRoot, '../api-server/laravel');
const listingId = 984241;
const listingTitle = 'Browser Preview Flow House';
const projectId = 'preview-project-248';
const adminEmail = 'browser-preview-admin@example.test';
const adminPassword = 'BrowserPreviewOnly123!';

function fixturePassword(password) {
  const salt = 'browser-preview-isolated-fixture';
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function isolatedEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/DATABASE|MYSQL|POSTGRES|NEON|SUPABASE|SECRET|TOKEN|PASSWORD|SMTP|MAIL_(?:USER|PASS)|LARAVEL_.*URL|EXPO_PUBLIC_(?:GOOGLE_MAPS_API_KEY|MAPBOX_ACCESS_TOKEN)/i.test(key)) {
      delete environment[key];
    }
  }
  return {
    ...environment,
    ...overrides,
  };
}

async function runCommand(command, args, cwd, env, description) {
  const child = spawn(command, args, { cwd, env, stdio: 'ignore' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, `${description} must complete successfully`);
}

async function waitForHttp(child, url, description, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${description} exited before it was ready (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 503) return;
    } catch {
      // The process is still binding its local port.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (exited || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGKILL');
  await once(child, 'exit').catch(() => undefined);
}

async function jsonRequest(baseUrl, route, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function fixtureListing() {
  return {
    id: listingId,
    title: listingTitle,
    type: 'House',
    status: 'For Sale',
    purpose: 'Buy',
    price: 25_000_000,
    area: 10,
    areaUnit: 'Marla',
    bedrooms: 3,
    bathrooms: 2,
    city: 'Okara',
    district: 'Okara District',
    tehsil: 'Okara',
    locality: 'Browser Preview Block',
    address: '41 Browser Preview Road',
    description: 'Temporary listing for the isolated Admin-to-mobile browser flow.',
    latitude: 30.8077123,
    longitude: 73.4561988,
    location: {
      latitude: 30.8077123,
      longitude: 73.4561988,
      city: 'Okara',
      district: 'Okara District',
      tehsil: 'Okara',
      locality: 'Browser Preview Block',
      streetAddress: '41 Browser Preview Road',
      address: '41 Browser Preview Road, Browser Preview Block, Okara',
    },
    images: ['https://example.invalid/browser-preview-house.jpg'],
    coverImage: 'https://example.invalid/browser-preview-house.jpg',
    features: ['Parking'],
    amenities: ['Parking'],
    sellerId: 2,
    sellerName: 'Preview Fixture Owner',
    approvalStatus: 'Pending',
    listingStatus: 'Pending',
    submissionState: 'pending',
    isDemo: false,
    isProject: false,
    featured: false,
    recommended: false,
    createdAt: new Date().toISOString(),
    reviewHistory: [],
  };
}

function browserExecutable() {
  return [
    process.env.CHROMIUM_PATH,
    '/repl/tools/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

test('Admin approval syncs a listing to Website pages and Expo Home, Explore, and detail', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-landmark-approval-preview-'));
  const databasePath = path.join(tempDir, 'laravel.sqlite');
  const fixturePath = path.join(tempDir, 'fixture.json');
  const seedScriptPath = path.join(tempDir, 'seed-fixture.php');
  const verificationPath = path.join(tempDir, 'seed-verification.json');
  const apiPort = await freePort();
  const webPort = await freePort();
  const mobilePort = await freePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webBase = `http://127.0.0.1:${webPort}`;
  const mobileBase = `http://127.0.0.1:${mobilePort}`;
  let apiProcess;
  let webProcess;
  let mobileProcess;
  let browser;
  let adminContext;
  let mobileContext;
  let adminToken;
  let fixtureWasRemoved = false;
  let originalFailure;
  let cleanupFailure;

  const apiEnvironment = isolatedEnvironment({
    APP_ENV: 'local',
    APP_KEY: `base64:${crypto.randomBytes(32).toString('base64')}`,
    APP_CONFIG_CACHE: path.join(tempDir, 'config.php'),
    APP_SERVICES_CACHE: path.join(tempDir, 'services.php'),
    APP_PACKAGES_CACHE: path.join(tempDir, 'packages.php'),
    APP_ROUTES_CACHE: path.join(tempDir, 'routes.php'),
    APP_EVENTS_CACHE: path.join(tempDir, 'events.php'),
    APP_URL: apiBase,
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: databasePath,
    DB_URL: '',
    DB_HOST: '',
    DB_PORT: '',
    DB_USERNAME: '',
    DB_PASSWORD: '',
    CACHE_STORE: 'array',
    SESSION_DRIVER: 'array',
    QUEUE_CONNECTION: 'sync',
    MAIL_MAILER: 'array',
    SMTP_USER: '',
    SMTP_PASS: '',
    MAIL_USERNAME: '',
    MAIL_PASSWORD: '',
    MEDIA_STORAGE_DIR: path.join(tempDir, 'media'),
    MEDIA_PUBLIC_BASE_URL: '',
    LOG_CHANNEL: 'stderr',
  });

  try {
    const fixtureData = {
      users: [
        {
          id: 1,
          name: 'Browser Preview Admin',
          email: adminEmail,
          role: 'Admin',
          status: 'Active',
          password: fixturePassword(adminPassword),
        },
        {
          id: 2,
          name: 'Preview Fixture Owner',
          email: 'browser-preview-owner@example.test',
          role: 'User',
          status: 'Active',
          password: fixturePassword('PreviewOwnerOnly123!'),
        },
      ],
      properties: [fixtureListing()],
      mobileAgents: [],
      cityAgents: [],
      developerProjects: [{
        id: projectId,
        name: 'Preview Draft Project 248',
        title: 'Preview Draft Project 248',
        developerName: 'Preview Developer',
        type: 'Housing Society',
        city: 'Okara',
        status: 'Draft',
        shortDescription: 'Isolated project used by the Admin-to-public integration test.',
        createdAt: new Date().toISOString(),
      }],
      notifications: [],
      pushDevices: [],
      adminAuditLog: [],
      adminActivity: [],
      auditLog: [],
      savedProperties: [],
      nextId: listingId + 1,
    };
    fs.writeFileSync(fixturePath, JSON.stringify(fixtureData), { mode: 0o600 });
    fs.writeFileSync(seedScriptPath, `<?php
require ${JSON.stringify(path.join(laravelRoot, 'vendor/autoload.php'))};
$app = require ${JSON.stringify(path.join(laravelRoot, 'bootstrap/app.php'))};
$app->make(\\Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$fixture = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
\\Illuminate\\Support\\Facades\\DB::table('app_data')->updateOrInsert(
    ['id' => 1],
    [
        'data' => json_encode($fixture, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        'updated_at' => now(),
    ],
);
$stored = \\App\\Services\\JsonStore::read();
$admin = collect($stored['users'] ?? [])->firstWhere('email', ${JSON.stringify(adminEmail)});
file_put_contents($argv[2], json_encode([
    'fixtureLoaded' => $admin !== null,
    'adminRole' => $admin['role'] ?? null,
    'passwordMatches' => $admin !== null && hash_equals(
        (string) ($admin['password'] ?? ''),
        'pbkdf2:browser-preview-isolated-fixture:' . hash_pbkdf2('sha512', ${JSON.stringify(adminPassword)}, 'browser-preview-isolated-fixture', 100000, 128, false),
    ),
], JSON_THROW_ON_ERROR));
`, { mode: 0o600 });

    await runCommand(
      'php',
      ['artisan', 'migrate', '--force', '--no-interaction'],
      laravelRoot,
      apiEnvironment,
      'temporary SQLite migrations',
    );
    await runCommand(
      'php',
      [seedScriptPath, fixturePath, verificationPath],
      laravelRoot,
      apiEnvironment,
      'isolated Laravel fixture seeding',
    );
    const seedVerification = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
    assert.equal(seedVerification.fixtureLoaded, true, 'the fixture Admin should be readable from the isolated database');
    assert.equal(seedVerification.adminRole, 'Admin');
    assert.equal(seedVerification.passwordMatches, true, 'the isolated Admin password hash should match');

    apiProcess = spawn('php', [
      '-S',
      `127.0.0.1:${apiPort}`,
      '-t',
      path.join(laravelRoot, 'public'),
      path.join(laravelRoot, 'public/index.php'),
    ], {
      cwd: laravelRoot,
      stdio: 'ignore',
      env: apiEnvironment,
    });
    await waitForHttp(apiProcess, `${apiBase}/api/health`, 'isolated Laravel API');
    const directLoginProbe = await jsonRequest(apiBase, '/api/auth/admin-verify', {
      method: 'POST',
      body: { email: adminEmail, password: adminPassword },
    });
    assert.equal(
      directLoginProbe.response.status,
      200,
      `the isolated Laravel Admin fixture should authenticate (${directLoginProbe.payload?.error || 'no error detail'})`,
    );
    adminToken = directLoginProbe.payload.token;

    webProcess = spawn(process.execPath, [path.join(webRoot, 'server.js')], {
      cwd: webRoot,
      stdio: 'ignore',
      env: isolatedEnvironment({
        NODE_ENV: 'development',
        PORT: String(webPort),
        REPLIT_DEV_DOMAIN: '',
        LARAVEL_API_URL: apiBase,
        LARAVEL_API_PREVIEW_URL: '',
        LARAVEL_WEB_URL: '',
        DATABASE_URL: '',
        NEON_DATABASE_URL: '',
      }),
    });
    await waitForHttp(webProcess, `${webBase}/admin/login`, 'local website preview');

    mobileProcess = spawn('pnpm', ['exec', 'expo', 'start', '--web', '--port', String(mobilePort), '--localhost'], {
      cwd: mobileRoot,
      stdio: 'ignore',
      env: isolatedEnvironment({
        CI: '1',
        EXPO_NO_DOTENV: '1',
        EXPO_TOKEN: '',
        EXPO_PUBLIC_DOMAIN: webBase,
        PORT: String(mobilePort),
        REPLIT_DEV_DOMAIN: '',
        REPLIT_EXPO_DEV_DOMAIN: '',
      }),
    });
    await waitForHttp(mobileProcess, mobileBase, 'Expo web preview');

    const executablePath = browserExecutable();
    assert.ok(executablePath, 'Chromium is required; set CHROMIUM_PATH to its executable.');
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const adminPage = await adminContext.newPage();
    adminPage.setDefaultTimeout(30_000);
    adminPage.setDefaultNavigationTimeout(120_000);
    await adminPage.goto(`${webBase}/admin/login`, { waitUntil: 'domcontentloaded' });
    await adminPage.locator('#email').fill(adminEmail);
    await adminPage.locator('#password').fill(adminPassword);
    const signInResponsePromise = adminPage.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/auth/admin-verify'),
    );
    await adminPage.locator('#root form button[type="submit"]').click();
    const signInResponse = await signInResponsePromise;
    const submittedCredentials = signInResponse.request().postDataJSON();
    assert.equal(submittedCredentials.email, adminEmail);
    assert.equal(submittedCredentials.password, adminPassword);
    assert.equal(
      signInResponse.status(),
      200,
      'the real Admin dashboard sign-in should complete locally',
    );
    await adminPage.waitForURL(url => url.pathname === '/admin/', { timeout: 30_000 });
    adminToken = await adminPage.evaluate(() => localStorage.getItem('og_token'));
    const browserUser = await adminPage.evaluate(() => JSON.parse(localStorage.getItem('og_user') || 'null'));
    assert.equal(typeof adminToken, 'string', 'the Admin dashboard should save the real browser session');
    assert.equal(browserUser?.role, 'Admin');

    await adminPage.goto(`${webBase}/admin/management/reviews`, { waitUntil: 'domcontentloaded' });
    const approveButton = adminPage.locator(
      `[data-action="review-property"][data-operation="approve"][data-id="${listingId}"]`,
    );
    await approveButton.waitFor({ state: 'visible' });
    assert.equal(await approveButton.count(), 1, 'the fixture should have one Reviews approval action');
    adminPage.once('dialog', dialog => dialog.accept());
    const approvalResponsePromise = adminPage.waitForResponse(response =>
      response.request().method() === 'PATCH'
      && response.url().endsWith(`/api/admin/properties/${listingId}/approve`),
    );
    await approveButton.click();
    const approvalResponse = await approvalResponsePromise;
    assert.equal(approvalResponse.status(), 200, 'Admin dashboard should publish the listing through Laravel');

    const published = await jsonRequest(webBase, `/api/properties/${listingId}`);
    assert.equal(published.response.status, 200);
    assert.equal(published.payload?.approvalStatus, 'Active');
    assert.equal(published.payload?.listingStatus, 'Active');

    const websiteListResponse = await fetch(`${apiBase}/properties`);
    assert.equal(websiteListResponse.status, 200, 'the Website property feed should render after Admin approval');
    const websiteListHtml = await websiteListResponse.text();
    assert.ok(websiteListHtml.includes(listingTitle), 'the approved listing should appear on the Website properties page');

    const websiteDetailResponse = await fetch(`${apiBase}/properties/${listingId}`);
    assert.equal(websiteDetailResponse.status, 200, 'the approved listing should have a public Website detail page');
    const websiteDetailHtml = await websiteDetailResponse.text();
    assert.ok(websiteDetailHtml.includes(listingTitle), 'the Website detail page should show the approved title');
    assert.ok(websiteDetailHtml.includes('Temporary listing for the isolated Admin-to-mobile browser flow.'), 'the Website detail page should show updated listing content');

    const agentName = 'Preview Directory Agent 248';
    await adminPage.goto(`${webBase}/admin/mobile/agents`, { waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('button', { name: 'Add mobile Agent' }).click();
    const agentForm = adminPage.locator('#og-mm-agent-form');
    await agentForm.locator('input[name="name"]').fill(agentName);
    await agentForm.locator('input[name="agency"]').fill('Preview Property Group');
    await agentForm.locator('input[name="city"]').fill('Okara');
    await agentForm.locator('input[name="email"]').fill('directory-agent@example.test');
    await agentForm.locator('select[name="status"]').selectOption('Suspended');
    await agentForm.locator('select[name="approvalStatus"]').selectOption('Rejected');
    await agentForm.locator('input[name="visible"]').uncheck();
    const createAgentResponsePromise = adminPage.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/admin/mobile-agents'),
    );
    await agentForm.locator('button[type="submit"]').click();
    const createAgentResponse = await createAgentResponsePromise;
    assert.equal(createAgentResponse.status(), 201, 'Admin should create the inactive Agent through its authenticated API');
    const createdAgent = await createAgentResponse.json();
    const agentId = createdAgent.id;
    assert.ok(agentId, 'the Admin-created Agent should have a persistent directory ID');

    const hiddenWebsiteAgents = await (await fetch(`${apiBase}/agents`)).text();
    assert.equal(hiddenWebsiteAgents.includes(agentName), false, 'inactive or rejected Agents must stay hidden on the Website');
    const hiddenMobileAgents = await jsonRequest(apiBase, '/api/mobile-agents');
    assert.equal(hiddenMobileAgents.response.status, 200);
    assert.equal(hiddenMobileAgents.payload.some(agent => String(agent.id) === String(agentId)), false, 'inactive Agents must stay hidden from Mobile');

    const hiddenProjects = await jsonRequest(webBase, '/api/projects');
    assert.equal(hiddenProjects.response.status, 200);
    assert.equal(hiddenProjects.payload.some(project => String(project.id) === projectId), false, 'Draft projects must stay hidden from the public Website feed');

    const agentRow = adminPage.getByRole('row').filter({ hasText: agentName });
    await agentRow.getByRole('button', { name: 'Edit' }).click();
    const editAgentForm = adminPage.locator('#og-mm-agent-form');
    await editAgentForm.locator('select[name="status"]').selectOption('Active');
    await editAgentForm.locator('select[name="approvalStatus"]').selectOption('Approved');
    await editAgentForm.locator('input[name="visible"]').check();
    const updateAgentResponsePromise = adminPage.waitForResponse(response =>
      response.request().method() === 'PUT'
      && response.url().endsWith(`/api/admin/mobile-agents/${agentId}`),
    );
    await editAgentForm.locator('button[type="submit"]').click();
    const updateAgentResponse = await updateAgentResponsePromise;
    assert.equal(updateAgentResponse.status(), 200, 'Admin should activate the Agent through its authenticated API');

    await adminPage.goto(`${webBase}/admin/management/developer-projects`, { waitUntil: 'domcontentloaded' });
    const projectEditButton = adminPage.locator(
      `[data-action="edit-record"][data-section="projects"][data-id="${projectId}"]`,
    );
    await projectEditButton.waitFor({ state: 'visible' });
    await projectEditButton.click();
    const projectForm = adminPage.locator('#og-mm-record-form-inner');
    await projectForm.locator('input[name="name"]').fill('Preview Live Project 248');
    await projectForm.locator('select[name="status"]').selectOption('Live');
    const updateProjectResponsePromise = adminPage.waitForResponse(response =>
      response.request().method() === 'PUT'
      && response.url().endsWith(`/api/admin/developer-projects/${projectId}`),
    );
    await projectForm.getByRole('button', { name: 'Save project' }).click();
    const updateProjectResponse = await updateProjectResponsePromise;
    assert.equal(updateProjectResponse.status(), 200, 'Admin should activate the project through its authenticated API');

    const websiteAgents = await (await fetch(`${apiBase}/agents`)).text();
    assert.ok(websiteAgents.includes(agentName), 'the active Agent should appear in the Website directory');
    const mobileAgents = await jsonRequest(apiBase, '/api/mobile-agents');
    assert.ok(mobileAgents.payload.some(agent => String(agent.id) === String(agentId)), 'the active Agent should appear in the Mobile directory API');
    const publicProjects = await jsonRequest(webBase, '/api/projects');
    assert.ok(publicProjects.payload.some(project => String(project.id) === projectId && project.status === 'Live'), 'the active project should appear in the Website public project feed');

    mobileContext = await browser.newContext({
      viewport: { width: 402, height: 874 },
      isMobile: true,
      hasTouch: true,
    });
    await mobileContext.addInitScript(() => {
      localStorage.setItem('@og-landmark/onboarding-completed-v1', 'true');
    });
    const mobilePage = await mobileContext.newPage();
    mobilePage.setDefaultTimeout(45_000);
    mobilePage.setDefaultNavigationTimeout(180_000);

    await mobilePage.goto(mobileBase, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText(listingTitle, { exact: true }).first().waitFor({ state: 'visible' });
    assert.equal(new URL(mobilePage.url()).pathname, '/', 'the listing should appear on Home');

    await mobilePage.goto(`${mobileBase}/explore`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText(listingTitle, { exact: true }).first().waitFor({ state: 'visible' });

    await mobilePage.goto(`${mobileBase}/property/${listingId}`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText(listingTitle, { exact: true }).first().waitFor({ state: 'visible' });
    await mobilePage.getByText('Temporary listing for the isolated Admin-to-mobile browser flow.', { exact: true }).waitFor({ state: 'visible' });

    await mobilePage.goto(`${mobileBase}/agent/find`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText(agentName, { exact: true }).waitFor({ state: 'visible' });

    await mobilePage.goto(`${mobileBase}/explore`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText('Projects', { exact: true }).first().click();
    await mobilePage.getByText('Preview Live Project 248', { exact: true }).waitFor({ state: 'visible' });
  } catch (error) {
    originalFailure = error;
    throw error;
  } finally {
    await mobileContext?.close().catch(() => undefined);
    await adminContext?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);

    if (adminToken && webProcess?.exitCode === null) {
      try {
        const removed = await jsonRequest(webBase, `/api/admin/properties/${listingId}`, {
          method: 'DELETE',
          token: adminToken,
        });
        assert.equal(removed.response.status, 204, 'the isolated test listing should be deleted after the browser flow');
        const remaining = await jsonRequest(webBase, '/api/admin/properties', { token: adminToken });
        assert.equal(remaining.response.status, 200);
        assert.equal(
          remaining.payload.some(property => Number(property.id) === listingId),
          false,
          'the isolated listing should be absent after cleanup',
        );
        fixtureWasRemoved = true;
      } catch (cleanupError) {
        cleanupFailure = cleanupError;
      }
    }

    await stopProcess(mobileProcess);
    await stopProcess(webProcess);
    await stopProcess(apiProcess);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (!originalFailure) {
      if (cleanupFailure) throw cleanupFailure;
      assert.ok(fixtureWasRemoved, 'the temporary listing fixture must be explicitly removed');
    }
  }
});
