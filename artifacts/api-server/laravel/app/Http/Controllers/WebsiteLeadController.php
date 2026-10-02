<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Throwable;

class WebsiteLeadController extends Controller
{
    public function contact(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:320'],
            'phone' => ['nullable', 'string', 'max:32'],
            'subject' => ['nullable', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:5000'],
            'propertyId' => ['nullable', 'string', 'max:120'],
            'property_id' => ['nullable', 'string', 'max:120'],
            'website' => ['nullable', 'string', 'max:200'],
        ]);

        if (filled($validated['website'] ?? null)) {
            return back()->with('success', 'Thank you. Your message has been received.');
        }

        $lead = $this->persistLead([
            'type' => filled($validated['propertyId'] ?? $validated['property_id'] ?? null) ? 'property-inquiry' : 'contact',
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
            'phone' => trim((string) ($validated['phone'] ?? '')),
            'subject' => trim((string) ($validated['subject'] ?? 'Website enquiry')),
            'message' => trim($validated['message']),
            'propertyId' => $validated['propertyId'] ?? $validated['property_id'] ?? null,
            'source' => 'website',
        ]);

        try {
            $this->sendLeadEmails($lead);
            $this->setEmailStatus((string) $lead['id'], 'sent');

            return back()->with('success', 'Thank you. Your message has been sent, and a confirmation email is on its way.');
        } catch (Throwable $exception) {
            report($exception);
            $this->setEmailStatus((string) $lead['id'], 'failed');

            return back()->with('mail_error', 'Your message has been saved, but email delivery is not available right now. Our team can still review your request.')
                ->withInput($request->except('website'));
        }
    }

    public function newsletter(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:320'],
            'website' => ['nullable', 'string', 'max:200'],
        ]);

        if (filled($validated['website'] ?? null)) {
            return back()->with('success', 'Thank you for subscribing.');
        }

        $email = strtolower(trim($validated['email']));
        JsonStore::mutate(function (array &$data) use ($email): array {
            $data['newsletterSubscribers'] ??= [];
            $existing = collect($data['newsletterSubscribers'])
                ->first(fn ($item) => is_array($item) && strtolower((string) ($item['email'] ?? '')) === $email);

            if ($existing) {
                return $data;
            }

            $data['newsletterSubscribers'][] = [
                'id' => JsonStore::id('newsletter'),
                'email' => $email,
                'status' => 'subscribed',
                'emailStatus' => 'pending',
                'createdAt' => now()->toISOString(),
            ];

            return $data;
        });

        try {
            $this->assertSmtpReady();
            Mail::raw(
                "You are subscribed to OG Landmark updates. You can contact us if you would like your subscription removed.",
                fn ($message) => $message->to($email)->subject('OG Landmark — Subscription confirmed'),
            );
            $this->updateSubscriberStatus($email, 'sent');

            return back()->with('success', 'You are subscribed. A confirmation email has been sent.');
        } catch (Throwable $exception) {
            report($exception);
            $this->updateSubscriberStatus($email, 'failed');

            return back()->with('mail_error', 'Your subscription was saved, but the confirmation email could not be delivered yet.');
        }
    }

    private function persistLead(array $payload): array
    {
        $lead = $payload + [
            'id' => JsonStore::id('web-lead'),
            'status' => 'new',
            'emailStatus' => 'pending',
            'createdAt' => now()->toISOString(),
        ];

        JsonStore::mutate(function (array &$data) use ($lead): array {
            $data['websiteLeads'] ??= [];
            $data['websiteLeads'][] = $lead;
            return $data;
        });

        return $lead;
    }

    private function sendLeadEmails(array $lead): void
    {
        $this->assertSmtpReady();
        $adminAddress = (string) config('mail.from.address');
        if ($adminAddress === '' || str_ends_with(strtolower($adminAddress), '@example.com')) {
            throw new \RuntimeException('A working reply address is not configured.');
        }

        $body = implode("\n", [
            'A new message was submitted through the OG Landmark website.',
            '',
            'Name: ' . $lead['name'],
            'Email: ' . $lead['email'],
            'Phone: ' . ($lead['phone'] ?: 'Not provided'),
            'Subject: ' . $lead['subject'],
            'Property ID: ' . ($lead['propertyId'] ?: 'Not provided'),
            '',
            'Message:',
            $lead['message'],
            '',
            'Reference: ' . $lead['id'],
        ]);

        Mail::raw($body, fn ($message) => $message
            ->to($adminAddress)
            ->replyTo($lead['email'], $lead['name'])
            ->subject('OG Landmark website enquiry'));

        Mail::raw(
            "Thank you for contacting OG Landmark. Your message has been received, and our team will follow up.",
            fn ($message) => $message->to($lead['email'], $lead['name'])->subject('OG Landmark — We received your message'),
        );
    }

    private function assertSmtpReady(): void
    {
        if (
            config('mail.default') !== 'smtp'
            || !config('mail.mailers.smtp.username')
            || !config('mail.mailers.smtp.password')
            || !config('mail.mailers.smtp.host')
        ) {
            throw new \RuntimeException('Outgoing SMTP delivery is not configured.');
        }
    }

    private function setEmailStatus(string $id, string $status): void
    {
        JsonStore::mutate(function (array &$data) use ($id, $status): array {
            foreach ($data['websiteLeads'] ?? [] as $index => $lead) {
                if (is_array($lead) && (string) ($lead['id'] ?? '') === $id) {
                    $data['websiteLeads'][$index]['emailStatus'] = $status;
                    $data['websiteLeads'][$index]['emailStatusUpdatedAt'] = now()->toISOString();
                    break;
                }
            }
            return $data;
        });
    }

    private function updateSubscriberStatus(string $email, string $status): void
    {
        JsonStore::mutate(function (array &$current) use ($email, $status): array {
            foreach ($current['newsletterSubscribers'] ?? [] as $index => $subscriber) {
                if (is_array($subscriber) && strtolower((string) ($subscriber['email'] ?? '')) === $email) {
                    $current['newsletterSubscribers'][$index]['emailStatus'] = $status;
                    $current['newsletterSubscribers'][$index]['emailStatusUpdatedAt'] = now()->toISOString();
                    break;
                }
            }
            return $current;
        });
    }
}