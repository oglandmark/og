<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WebsiteBladeTest extends TestCase
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

    private function seller(): array
    {
        $password = 'TestPassword123';
        $salt = 'website-blade-seller';
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);

        return [
            'passwordPlaintext' => $password,
            'user' => [
                'id' => 91,
                'email' => 'seller@example.com',
                'name' => 'Website Seller',
                'role' => 'Seller',
                'status' => 'Active',
                'password' => "pbkdf2:{$salt}:{$hash}",
            ],
        ];
    }

    public function test_public_blade_pages_legal_pages_and_assets_load(): void
    {
        $this->get('/')->assertOk()->assertSee('Find a place');
        $this->get('/properties')->assertOk()->assertSee('Property filters');
        $this->get('/login?role=admin')->assertOk()->assertSee('Administrator email');
        $this->get('/register')->assertOk()->assertSee('Mobile number');
        $this->get('/auth?role=buyer')->assertRedirect('/register?role=buyer');
        $this->get('/register?role=buyer')->assertOk()->assertSee('value="buyer" selected', false);
        $this->get('/privacy-policy')->assertOk();
        $this->get('/terms')->assertOk();
        $this->get('/account-deletion')->assertOk();
        $this->assertFileExists(public_path('css/landmark.css'));
        $this->assertFileExists(public_path('css/portal.css'));
        $this->assertFileExists(public_path('js/landmark.js'));
        $this->assertFileExists(public_path('images/mobile-banners/homes.jpg'));
    }

    public function test_contact_form_keeps_the_lead_when_smtp_is_not_ready(): void
    {
        $this->seedData(['users' => [], 'properties' => [], 'websiteLeads' => []]);
        config(['mail.default' => 'log']);

        $this->from('/contact')->post('/contact', [
            'name' => 'A Test Visitor',
            'email' => 'visitor@example.com',
            'phone' => '03001234567',
            'subject' => 'Buying',
            'message' => 'Please call me about a home in Lahore.',
        ])
            ->assertRedirect('/contact')
            ->assertSessionHas('mail_error');

        $lead = JsonStore::read()['websiteLeads'][0] ?? null;
        $this->assertIsArray($lead);
        $this->assertSame('visitor@example.com', $lead['email']);
        $this->assertSame('failed', $lead['emailStatus']);
        $this->assertSame('Please call me about a home in Lahore.', $lead['message']);
    }

    public function test_seller_can_submit_a_property_from_the_blade_portal(): void
    {
        $seller = $this->seller();
        $this->seedData(['users' => [$seller['user']], 'properties' => []]);

        $this->from('/login')->post('/login', [
            'role' => 'seller',
            'identifier' => 'seller@example.com',
            'password' => $seller['passwordPlaintext'],
        ])->assertRedirect('/portal/seller/dashboard');

        $this->get('/portal/seller/add-property')
            ->assertOk()
            ->assertSee('Submit for review');

        $this->from('/portal/seller/add-property')->post('/portal/seller/properties', [
            'title' => 'Test family home',
            'type' => 'House',
            'purpose' => 'For Sale',
            'city' => 'Lahore',
            'address' => 'DHA Phase 6',
            'price' => '18000000',
            'area' => '10 marla',
            'bedrooms' => '4',
            'bathrooms' => '4',
            'description' => 'A well-maintained family home.',
            'image_urls' => '',
        ])->assertRedirect('/portal/seller/listings')
            ->assertSessionHas('success');

        $property = JsonStore::read()['properties'][0] ?? null;
        $this->assertIsArray($property);
        $this->assertSame('Test family home', $property['title']);
        $this->assertSame(91, $property['sellerId']);
        $this->assertSame('Pending', $property['approvalStatus']);
        $this->assertSame('Pending', $property['listingStatus']);
        $this->assertSame(18000000.0, $property['price']);
        $this->assertSame(4, $property['bedrooms']);
    }
}