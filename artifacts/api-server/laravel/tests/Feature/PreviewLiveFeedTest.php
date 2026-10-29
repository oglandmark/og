<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class PreviewLiveFeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode(['mobileAgents' => []], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }

    public function test_live_preview_proxy_is_disabled_outside_local_environment(): void
    {
        config(['app.env' => 'production']);
        Http::fake();

        $this->getJson('/api-legacy/api/preview/live/mobile/settings')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_preview_property_feed_proxies_only_public_reads_to_live_api(): void
    {
        config(['app.env' => 'local']);
        Http::fake([
            'www.oglandmark.com/api/properties*' => Http::response([
                ['id' => 501, 'approvalStatus' => 'Active', 'featured' => true],
            ]),
        ]);

        $this->getJson('/api-legacy/api/preview/live/properties?limit=5&sort=latest')
            ->assertOk()
            ->assertJsonPath('0.id', 501);

        Http::assertSent(fn (\Illuminate\Http\Client\Request $request): bool =>
            $request->url() === 'https://www.oglandmark.com/api/properties?limit=5&sort=latest'
        );
    }

    public function test_preview_property_detail_proxies_to_the_fixed_live_property_path(): void
    {
        config(['app.env' => 'local']);
        Http::fake([
            'www.oglandmark.com/api/properties/501' => Http::response([
                'id' => 501, 'approvalStatus' => 'Active',
            ]),
        ]);

        $this->getJson('/api-legacy/api/preview/live/properties/501')
            ->assertOk()
            ->assertJsonPath('id', 501);
    }

    public function test_preview_agent_directory_proxies_only_city_and_limit_filters(): void
    {
        config(['app.env' => 'local']);
        Http::fake([
            'www.oglandmark.com/api/mobile-agents*' => Http::response([
                ['id' => 27, 'name' => 'OG Landmark'],
            ]),
        ]);

        $this->getJson('/api-legacy/api/preview/live/mobile-agents?city=Okara&limit=5&ignored=x')
            ->assertOk()
            ->assertJsonPath('0.id', 27);

        Http::assertSent(fn (\Illuminate\Http\Client\Request $request): bool =>
            $request->url() === 'https://www.oglandmark.com/api/mobile-agents?city=Okara&limit=5'
        );
    }

    public function test_preview_agent_directory_includes_approved_local_admin_agents_and_honors_local_hides(): void
    {
        config(['app.env' => 'local']);
        DB::table('app_data')->where('id', 1)->update(['data' => json_encode([
            'mobileAgents' => [
                [
                    'id' => 1001, 'name' => 'Local Admin Agent', 'city' => 'Okara',
                    'status' => 'Active', 'approvalStatus' => 'Approved', 'visible' => true,
                    'email' => 'private@example.test', 'password' => 'never-return-this',
                ],
                [
                    'id' => 1002, 'name' => 'Pending Agent', 'status' => 'Active',
                    'approvalStatus' => 'Pending', 'visible' => true,
                ],
                [
                    'id' => 1003, 'name' => 'Hidden Agent', 'status' => 'Active',
                    'approvalStatus' => 'Approved', 'visible' => false,
                ],
                [
                    'id' => 1004, 'name' => 'Edited Live Agent', 'sourcePreviewId' => '28',
                    'city' => 'Okara', 'status' => 'Active', 'approvalStatus' => 'Approved', 'visible' => true,
                ],
            ],
            'mobileAgentPreviewHiddenIds' => ['29'],
        ], JSON_THROW_ON_ERROR)]);
        Http::fake([
            'www.oglandmark.com/api/mobile-agents*' => Http::response([
                ['id' => 27, 'name' => 'Remote Agent', 'city' => 'Okara'],
                ['id' => 28, 'name' => 'Old Live Snapshot', 'city' => 'Okara'],
                ['id' => 29, 'name' => 'Deleted Live Agent', 'city' => 'Okara'],
            ]),
        ]);

        $this->getJson('/api-legacy/api/preview/live/mobile-agents?city=Okara&limit=10')
            ->assertOk()
            ->assertJsonCount(3)
            ->assertJsonPath('0.id', 1001)
            ->assertJsonPath('0.displayName', 'Local Admin Agent')
            ->assertJsonMissingPath('0.email')
            ->assertJsonMissingPath('0.password')
            ->assertJsonPath('1.id', 1004)
            ->assertJsonMissingPath('1.sourcePreviewId')
            ->assertJsonPath('2.id', 27);
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
