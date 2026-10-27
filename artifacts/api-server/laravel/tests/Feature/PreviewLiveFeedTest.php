<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class PreviewLiveFeedTest extends TestCase
{
    public function test_live_preview_proxy_is_disabled_outside_local_environment(): void
    {
        config(['app.env' => 'production']);
        Http::fake();

        $this->getJson('/api-legacy/api/preview/live/mobile/settings')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_cors_pattern_allows_only_replit_expo_preview_hosts(): void
    {
        $patterns = config('cors.allowed_origins_patterns');

        $this->assertTrue(collect($patterns)->contains(
            fn (string $pattern): bool => preg_match($pattern, 'https://preview-123.expo.pike.replit.dev') === 1
        ));
        $this->assertFalse(collect($patterns)->contains(
            fn (string $pattern): bool => preg_match($pattern, 'https://preview.example.com') === 1
        ));
    }

    public function test_live_property_api_accepts_replit_expo_get_preflight(): void
    {
        $origin = 'https://preview-123.expo.pike.replit.dev';
        $response = $this->call('OPTIONS', '/api/properties', [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
        ]);

        $response->assertNoContent();
        $response->assertHeader('Access-Control-Allow-Origin', $origin);
    }
}
