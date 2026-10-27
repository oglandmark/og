<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

final class PreviewLiveFeedController extends Controller
{
    private const LIVE_API = 'https://www.oglandmark.com/api';

    public function properties(Request $request): JsonResponse
    {
        $allowed = [
            'type', 'city', 'status', 'purpose', 'minPrice', 'maxPrice', 'minBeds',
            'featured', 'search', 'limit', 'offset', 'sort', 'minLat', 'maxLat',
            'minLng', 'maxLng', 'lat', 'lng', 'radiusKm', 'response', 'paginated',
        ];
        $query = array_intersect_key($request->query(), array_flip($allowed));

        return $this->forward('properties', $query);
    }

    public function property(string $id): JsonResponse
    {
        return $this->forward("properties/{$id}");
    }

    public function mobileSettings(): JsonResponse
    {
        return $this->forward('mobile/settings');
    }

    public function mobileBanners(): JsonResponse
    {
        return $this->forward('mobile/banners');
    }

    private function forward(string $path, array $query = []): JsonResponse
    {
        abort_unless(app()->environment('local'), 404);

        try {
            $response = Http::acceptJson()
                ->timeout(12)
                ->get(self::LIVE_API . '/' . $path, $query);
        } catch (ConnectionException) {
            return response()->json(['error' => 'Live preview data is temporarily unavailable.'], 502);
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return response()->json(['error' => 'Live preview returned an invalid response.'], 502);
        }

        return response()->json($payload, $response->status());
    }
}
