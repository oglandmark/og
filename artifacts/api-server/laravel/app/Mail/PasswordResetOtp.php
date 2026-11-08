<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

final class PasswordResetOtp extends Mailable
{
    public function __construct(public readonly string $code) {}

    public function build(): static
    {
        $code = htmlspecialchars($this->code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return $this->subject('Your OG Landmark password reset code')
            ->html('<div style="font-family:Arial,sans-serif;color:#0B1F3A">'
                .'<h2>Reset your password</h2>'
                .'<p>Enter this code in the OG Landmark app to choose a new password:</p>'
                .'<p style="font-size:32px;letter-spacing:8px;font-weight:bold">'.$code.'</p>'
                .'<p>This code expires in 15 minutes. If you did not request a password reset, ignore this email.</p>'
                .'</div>');
    }
}
