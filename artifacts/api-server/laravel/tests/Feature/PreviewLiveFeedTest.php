<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class PreviewLiveFeedTest extends TestCase
{
    public function test_preview_property_feed_proxies_public_live_listings(): void
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

        Http::assertSent(fn (ClientRequest $request): bool =>
            $request->url() === 'https://www.oglandmark.com/api/properties?limit=5&sort=latest'
        );
    }

    public function test_live_preview_proxy_is_disabled_outside_local_environment(): void
    {
        config(['app.env' => 'production']);
        Http::fake();

        $this->getJson('/api-legacy/api/preview/live/mobile/settings')->assertNotFound();
        Http::assertNothingSent();
    }
}
