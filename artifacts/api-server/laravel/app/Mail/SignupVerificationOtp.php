<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

final class SignupVerificationOtp extends Mailable
{
    public function __construct(public readonly string $code) {}

    public function build(): static
    {
        return $this->subject('Verify your OG Landmark email')
            ->html('<div style="font-family:Arial,sans-serif;color:#0B1F3A"><h2>Verify your email</h2>'
                .'<p>Enter this code to finish creating your OG Landmark account:</p>'
                .'<p style="font-size:32px;letter-spacing:8px;font-weight:bold">'.$this->code.'</p>'
                .'<p>This code expires in 10 minutes. If you did not start this registration, ignore this email.</p></div>');
    }
}
