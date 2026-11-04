<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;

final class DeveloperProjectController extends Controller
{
    private const PUBLIC_STATUSES = ['Live', 'Approved', 'Coming Soon', 'Under Development'];

    public function index(LegacyDataStore $store): JsonResponse
    {
        $projects = $store->read()['developerProjects'] ?? [];
        $publicProjects = array_values(array_filter(
            $projects,
            fn ($project): bool => is_array($project)
                && in_array($project['status'] ?? null, self::PUBLIC_STATUSES, true),
        ));

        return response()->json($publicProjects);
    }

    public function show(string $id, LegacyDataStore $store): JsonResponse
    {
        foreach ($store->read()['developerProjects'] ?? [] as $project) {
            if (
                is_array($project)
                && (string) ($project['id'] ?? '') === $id
                && in_array($project['status'] ?? null, self::PUBLIC_STATUSES, true)
            ) {
                return response()->json($project);
            }
        }

        return response()->json(['error' => 'Not found'], 404);
    }
}
