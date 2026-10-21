<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HideWebsiteMarketingOnApiHost
{
    public function handle(Request $request, Closure $next): Response
    {
        if (strtolower($request->getHost()) !== 'api.oglandmark.com') {
            return $next($request);
        }

        $payload = [
            'message' => 'OG Landmark API server is running.',
            'website' => 'https://oglandmark.com',
        ];

        return response()->json($payload, $request->routeIs('home') ? 200 : 404);
    }
}
