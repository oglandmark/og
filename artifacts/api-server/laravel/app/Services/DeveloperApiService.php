<?php

namespace App\Services;

use Illuminate\Http\Request;

class DeveloperApiService
{
    private const COLLECTIONS = [
        'projects' => 'developerProjects',
        'blocks' => 'inventoryBlocks',
        'units' => 'inventoryUnits',
        'payment-plans' => 'paymentPlans',
        'documents' => 'developerDocuments',
        'team' => 'developerTeam',
        'leads' => 'developerLeads',
        'site-visits' => 'developerSiteVisits',
    ];

    public function handle(Request $request, array $parts, string $method, array $user)
    {
        $userId = (string) ($user['id'] ?? '');
        $isAdmin = strtolower((string) ($user['role'] ?? '')) === 'admin';
        $role = strtolower((string) ($user['role'] ?? ''));

        if (($parts[0] ?? '') === 'site-visits' && ($parts[1] ?? '') === 'mine' && $method === 'GET') {
            $items = JsonStore::read()['developerSiteVisits'] ?? [];
            return $this->json(collect($items)->filter(fn ($item) =>
                (string) ($item['buyerId'] ?? $item['userId'] ?? '') === $userId
            )->values());
        }

        if (!$isAdmin && !in_array($role, ['developer', 'seller'], true)) {
            return $this->json(['error' => 'A seller or developer account is required.'], 403);
        }

        $data = JsonStore::read();
        $resource = $parts[0] ?? '';

        if ($resource === 'analytics' && $method === 'GET') {
            $projects = collect($data['developerProjects'] ?? [])->filter(fn ($item) => $this->owns($item, $userId, $data, $isAdmin));
            $projectIds = $projects->pluck('id')->map(fn ($id) => (string) $id)->all();
            $relatedCount = fn (string $key) => collect($data[$key] ?? [])->filter(fn ($item) =>
                $this->owns($item, $userId, $data, $isAdmin)
                || in_array((string) ($item['projectId'] ?? ''), $projectIds, true)
            )->count();

            return $this->json([
                'projects' => $projects->count(),
                'leads' => $relatedCount('developerLeads'),
                'units' => $relatedCount('inventoryUnits'),
                'generatedAt' => now()->toISOString(),
            ]);
        }

        if ($resource === 'projects' && isset($parts[2]) && in_array($parts[2], ['blocks', 'units'], true)) {
            $projectId = (string) $parts[1];
            $project = $this->findById($data['developerProjects'] ?? [], $projectId);
            if (!$project || !$this->owns($project, $userId, $data, $isAdmin)) {
                return $this->json(['error' => 'Project not found'], 404);
            }
            if ($method !== 'GET') return $this->json(['error' => 'Method not allowed'], 405);

            $key = self::COLLECTIONS[$parts[2]];
            $items = collect($data[$key] ?? [])->filter(fn ($item) =>
                (string) ($item['projectId'] ?? '') === $projectId
            );
            if ($parts[2] === 'units' && $request->filled('blockId')) {
                $blockId = (string) $request->input('blockId');
                $items = $items->filter(fn ($item) => (string) ($item['blockId'] ?? '') === $blockId);
            }

            return $this->json($items->values());
        }

        $key = self::COLLECTIONS[$resource] ?? null;
        if ($key === null) return $this->json(['error' => 'Not found'], 404);
        $data[$key] ??= [];
        $id = $parts[1] ?? null;

        if ($method === 'GET' && $id === null) {
            $items = collect($data[$key])->filter(fn ($item) => $this->owns($item, $userId, $data, $isAdmin));
            if ($resource === 'projects') $items = $items->filter(fn ($item) => empty($item['deletedAt']));
            return $this->json($items->values());
        }

        if ($method === 'POST' && $id === null) {
            $payload = $request->all();
            if ($resource !== 'projects') {
                $projectId = (string) ($payload['projectId'] ?? '');
                if ($projectId !== '') {
                    $project = $this->findById($data['developerProjects'], $projectId);
                    if (!$project || !$this->owns($project, $userId, $data, $isAdmin)) {
                        return $this->json(['error' => 'Project not found'], 404);
                    }
                }
            }
            $item = array_merge($payload, [
                'id' => JsonStore::nextId($data),
                'userId' => $isAdmin ? ($payload['userId'] ?? $userId) : ($user['id'] ?? null),
                'developerId' => $isAdmin ? ($payload['developerId'] ?? $userId) : ($user['id'] ?? null),
                'createdAt' => now()->toISOString(),
                'updatedAt' => now()->toISOString(),
            ]);
            $data[$key][] = $item;
            JsonStore::write($data);
            return $this->json($item, 201);
        }

        $index = $this->indexById($data[$key], $id);
        if ($index === null) return $this->json(['error' => 'Not found'], 404);
        $item = $data[$key][$index];
        if (!$this->owns($item, $userId, $data, $isAdmin)) return $this->json(['error' => 'Forbidden'], 403);

        if ($method === 'GET') return $this->json($item);
        if ($method === 'PATCH' && $resource === 'team' && ($parts[2] ?? '') === 'active') {
            $data[$key][$index]['active'] = !($item['active'] ?? false);
            $data[$key][$index]['updatedAt'] = now()->toISOString();
            JsonStore::write($data);
            return $this->json($data[$key][$index]);
        }
        if ($method === 'DELETE' && $resource === 'projects') {
            $data[$key][$index]['deletedAt'] = now()->toISOString();
            $data[$key][$index]['status'] = 'Archived';
            $data[$key][$index]['updatedAt'] = now()->toISOString();
            JsonStore::write($data);
            return $this->json(['success' => true]);
        }
        if ($method === 'DELETE') {
            array_splice($data[$key], $index, 1);
            JsonStore::write($data);
            return response()->noContent();
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $patch = $request->except(['id', 'userId', 'developerId', 'createdAt']);
            $data[$key][$index] = array_merge($item, $patch, [
                'updatedAt' => now()->toISOString(),
            ]);
            JsonStore::write($data);
            return $this->json($data[$key][$index]);
        }

        return $this->json(['error' => 'Method not allowed'], 405);
    }

    public function publicProjects(Request $request, array $parts, string $method)
    {
        if ($method !== 'GET') return $this->json(['error' => 'Method not allowed'], 405);
        $projects = collect(JsonStore::read()['developerProjects'] ?? [])
            ->filter(fn ($item) => $this->isPublicProject($item))
            ->values();
        $id = $parts[0] ?? null;
        if ($id === null) return $this->json($projects);
        $project = $projects->first(fn ($item) => (string) ($item['id'] ?? '') === (string) $id);
        return $project ? $this->json($project) : $this->json(['error' => 'Project not found'], 404);
    }

    private function isPublicProject(array $project): bool
    {
        if (!empty($project['deletedAt'])) return false;
        $approval = strtolower((string) ($project['approvalStatus'] ?? ''));
        if ($approval !== '' && !in_array($approval, ['approved', 'active', 'live', 'published'], true)) return false;
        $status = strtolower((string) ($project['status'] ?? ''));
        if ($status !== '' && !in_array($status, ['approved', 'active', 'live', 'published'], true)) return false;
        return $approval !== '' || $status !== '';
    }

    private function owns(array $item, string $userId, array $data, bool $isAdmin): bool
    {
        if ($isAdmin) return true;
        foreach (['developerId', 'userId', 'ownerId', 'createdBy', 'sellerId'] as $field) {
            if (isset($item[$field]) && (string) $item[$field] === $userId) return true;
        }
        $projectId = $item['projectId'] ?? null;
        if ($projectId !== null) {
            $project = $this->findById($data['developerProjects'] ?? [], $projectId);
            if ($project) {
                foreach (['developerId', 'userId', 'ownerId', 'createdBy', 'sellerId'] as $field) {
                    if (isset($project[$field]) && (string) $project[$field] === $userId) return true;
                }
            }
        }
        return false;
    }

    private function findById(array $items, $id): ?array
    {
        foreach ($items as $item) {
            if (is_array($item) && (string) ($item['id'] ?? '') === (string) $id) return $item;
        }
        return null;
    }

    private function indexById(array $items, $id): ?int
    {
        foreach ($items as $index => $item) {
            if (is_array($item) && (string) ($item['id'] ?? '') === (string) $id) return $index;
        }
        return null;
    }

    private function json($data, int $status = 200)
    {
        return response()->json($data, $status)->withHeaders([
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        ]);
    }
}