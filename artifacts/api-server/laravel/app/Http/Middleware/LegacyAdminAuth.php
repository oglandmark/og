<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class LegacyAdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('legacyUser', []);
        $permissions = $user['permissions'] ?? [];
        $adminPermission = is_array($permissions)
            && (($permissions['admin'] ?? false) === true || in_array('admin', $permissions, true));
        if (($user['role'] ?? '') !== 'Admin' && ! $adminPermission) {
            return new JsonResponse(['error' => 'Admin access required.'], 403);
        }
        return $next($request);
    }
}
