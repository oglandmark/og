<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BuyerPortalActionsTest extends TestCase
{
    use RefreshDatabase;

    private function seedData(array $data): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode($data),
        ]);
        JsonStore::reset();
    }

    private function user(int $id, string $email, string $role = 'Buyer'): array
    {
        $password = 'TestPassword123';
        $salt = 'buyer-portal-' . $id;
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);

        return [
            'id' => $id,
            'email' => $email,
            'name' => 'Buyer ' . $id,
            'role' => $role,
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
        ];
    }

    private function token(string $email): string
    {
        $response = $this->postJson('/api/auth/login', [
            'identifier' => $email,
            'password' => 'TestPassword123',
        ])->assertOk();

        return (string) $response->json('token');
    }

    private function property(int $id = 31): array
    {
        return [
            'id' => $id,
            'title' => 'Lakeview family home',
            'type' => 'House',
            'purpose' => 'For Sale',
            'city' => 'Lahore',
            'address' => 'DHA Phase 6',
            'price' => 18000000,
            'approvalStatus' => 'Active',
            'listingStatus' => 'Active',
            'featured' => true,
            'sellerId' => 3,
        ];
    }

    public function test_buyer_can_save_and_remove_a_home_without_duplicates_and_only_sees_their_own_saved_homes(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer-one@example.com'),
                $this->user(2, 'buyer-two@example.com'),
            ],
            'properties' => [$this->property()],
            'savedProperties' => [],
        ]);
        $buyerOneSession = ['api_token' => $this->token('buyer-one@example.com')];
        $buyerTwoSession = ['api_token' => $this->token('buyer-two@example.com')];

        $this->withSession($buyerOneSession)
            ->get('/properties')
            ->assertOk()
            ->assertSee('Save this home');
        $this->withSession($buyerOneSession)
            ->get('/properties/31')
            ->assertOk()
            ->assertSee('Save this home');

        $this->from('/properties')->withSession($buyerOneSession)
            ->post('/properties/31/saved')
            ->assertRedirect('/properties')
            ->assertSessionHas('success', 'Home saved to your shortlist.');
        $this->assertSame([31], JsonStore::read()['savedProperties'][1]);

        $this->from('/properties')->withSession($buyerOneSession)
            ->post('/properties/31/saved')
            ->assertRedirect('/properties');
        $this->assertSame([31], JsonStore::read()['savedProperties'][1]);

        $this->withSession($buyerOneSession)
            ->get('/properties/31')
            ->assertOk()
            ->assertSee('Remove from saved homes');
        $this->withSession($buyerOneSession)
            ->get('/portal/buyer/saved-homes')
            ->assertOk()
            ->assertSee('Lakeview family home')
            ->assertSee('Remove');

        $this->withSession($buyerTwoSession)
            ->get('/portal/buyer/saved-homes')
            ->assertOk()
            ->assertDontSee('Lakeview family home');
        $this->withSession($buyerTwoSession)
            ->get('/properties/31')
            ->assertOk()
            ->assertSee('Save this home')
            ->assertDontSee('Remove from saved homes');

        $this->from('/properties')->withSession($buyerOneSession)
            ->delete('/properties/31/saved')
            ->assertRedirect('/properties')
            ->assertSessionHas('success', 'Home removed from your saved homes.');
        $this->assertSame([], JsonStore::read()['savedProperties'][1]);

        $this->from('/properties')->withSession($buyerOneSession)
            ->delete('/properties/31/saved')
            ->assertRedirect('/properties');
        $this->assertSame([], JsonStore::read()['savedProperties'][1]);
    }

    public function test_buyer_enquiry_is_authenticated_persisted_and_private_in_my_inquiries(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer-one@example.com'),
                $this->user(2, 'buyer-two@example.com'),
                $this->user(3, 'seller@example.com', 'Seller'),
            ],
            'properties' => [$this->property()],
            'inquiries' => [[
                'id' => 'other-buyer-inquiry',
                'propertyId' => 31,
                'propertyTitle' => 'Lakeview family home',
                'buyerId' => 2,
                'userId' => 2,
                'message' => 'Private message from another buyer.',
                'createdAt' => '2026-10-01T12:00:00+00:00',
            ]],
            'conversations' => [],
        ]);
        $buyerOneSession = ['api_token' => $this->token('buyer-one@example.com')];
        $buyerTwoSession = ['api_token' => $this->token('buyer-two@example.com')];

        $this->from('/properties/31')->withSession($buyerOneSession)
            ->post('/properties/31/inquiries', [
                'message' => 'Could I arrange a visit this weekend?',
                'buyerId' => 2,
                'clientName' => 'An untrusted name',
                'clientEmail' => 'spoof@example.com',
            ])
            ->assertRedirect('/properties/31')
            ->assertSessionHas('success', 'Your enquiry has been sent and saved to My inquiries.');

        $inquiries = JsonStore::read()['inquiries'];
        $created = collect($inquiries)->first(fn ($item) => is_array($item) && ($item['message'] ?? '') === 'Could I arrange a visit this weekend?');
        $this->assertIsArray($created);
        $this->assertSame(1, $created['buyerId']);
        $this->assertSame(1, $created['userId']);
        $this->assertSame('Buyer 1', $created['clientName']);
        $this->assertSame('buyer-one@example.com', $created['clientEmail']);
        $this->assertSame('Lakeview family home', $created['propertyTitle']);

        $this->withSession($buyerOneSession)
            ->get('/portal/buyer/inquiries')
            ->assertOk()
            ->assertSee('Could I arrange a visit this weekend?')
            ->assertDontSee('Private message from another buyer.');
        $this->withSession($buyerTwoSession)
            ->get('/portal/buyer/inquiries')
            ->assertOk()
            ->assertSee('Private message from another buyer.')
            ->assertDontSee('Could I arrange a visit this weekend?');

        $this->from('/properties/31')->withSession($buyerOneSession)
            ->post('/properties/31/inquiries', ['message' => ''])
            ->assertRedirect('/properties/31')
            ->assertSessionHasErrors('message');
    }

    public function test_any_user_account_can_save_homes_and_send_enquiries(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer@example.com'),
                $this->user(3, 'seller@example.com', 'Seller'),
            ],
            'properties' => [$this->property()],
            'savedProperties' => [],
            'inquiries' => [],
        ]);
        $buyerSession = ['api_token' => $this->token('buyer@example.com')];
        $sellerSession = ['api_token' => $this->token('seller@example.com')];

        $this->from('/properties')->post('/properties/31/saved')
            ->assertRedirect(route('auth.login'));
        $this->from('/properties')->withSession($sellerSession)
            ->post('/properties/31/saved')
            ->assertRedirect('/properties');
        $this->from('/properties/31')->withSession($sellerSession)
            ->post('/properties/31/inquiries', ['message' => 'Please arrange a visit.'])
            ->assertRedirect('/properties/31')
            ->assertSessionHas('success');

        $this->from('/properties')->withSession($buyerSession)
            ->post('/properties/999/saved')
            ->assertRedirect('/properties')
            ->assertSessionHasErrors('property');
        $this->withSession($buyerSession)
            ->get('/properties')
            ->assertOk()
            ->assertSee('This listing is no longer available to save.');

        $this->from('/properties/31')->withSession($buyerSession)
            ->post('/properties/999/inquiries', ['message' => 'Please arrange a visit.'])
            ->assertRedirect('/properties/31')
            ->assertSessionHasErrors('property');
    }
}