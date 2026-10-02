<?php

$smtpUsername = env('MAIL_USERNAME') ?: env('SMTP_USER');
$smtpPassword = env('MAIL_PASSWORD') ?: env('SMTP_PASS');
$hasSmtpCredentials = (bool) ($smtpUsername && $smtpPassword);
$configuredMailer = env('MAIL_MAILER');
$rawMailHost = trim((string) (env('MAIL_HOST') ?: ''));
$mailHostWasLocal = in_array(strtolower($rawMailHost), ['127.0.0.1', 'localhost', '0.0.0.0'], true);
$smtpHost = trim((string) (env('SMTP_HOST') ?: ''));
$smtpHost = $smtpHost !== '' ? $smtpHost : ($hasSmtpCredentials ? 'smtp.hostinger.com' : '');
$mailHost = $rawMailHost === '' || $mailHostWasLocal
    ? ($smtpHost !== '' ? $smtpHost : ($rawMailHost !== '' ? $rawMailHost : '127.0.0.1'))
    : $rawMailHost;
$smtpPort = env('SMTP_PORT')
    ?: (($mailHostWasLocal && $hasSmtpCredentials)
        ? 465
        : (env('MAIL_PORT') ?: (strtolower($mailHost) === 'smtp.hostinger.com' ? 465 : 2525)));
$smtpScheme = env('MAIL_SCHEME')
    ?: ((bool) env('SMTP_SECURE') || strtolower($mailHost) === 'smtp.hostinger.com' || ($mailHostWasLocal && $hasSmtpCredentials)
        ? 'smtps'
        : null);
$mailFromAddress = trim((string) (env('MAIL_FROM_ADDRESS') ?: ''));
if ($mailFromAddress === '' || str_ends_with(strtolower($mailFromAddress), '@example.com')) {
    $mailFromAddress = $smtpUsername ?: 'hello@example.com';
}

return [

    /*
    |--------------------------------------------------------------------------
    | Default Mailer
    |--------------------------------------------------------------------------
    |
    | This option controls the default mailer that is used to send all email
    | messages unless another mailer is explicitly specified when sending
    | the message. All additional mailers can be configured within the
    | "mailers" array. Examples of each type of mailer are provided.
    |
    */

    'default' => $configuredMailer === 'log' && $hasSmtpCredentials
        ? 'smtp'
        : ($configuredMailer ?: ($hasSmtpCredentials ? 'smtp' : 'log')),

    /*
    |--------------------------------------------------------------------------
    | Mailer Configurations
    |--------------------------------------------------------------------------
    |
    | Here you may configure all of the mailers used by your application plus
    | their respective settings. Several examples have been configured for
    | you and you are free to add your own as your application requires.
    |
    | Laravel supports a variety of mail "transport" drivers that can be used
    | when delivering an email. You may specify which one you're using for
    | your mailers below. You may also add additional mailers if needed.
    |
    | Supported: "smtp", "sendmail", "mailgun", "ses", "ses-v2",
    |            "postmark", "resend", "log", "array",
    |            "failover", "roundrobin"
    |
    */

    'mailers' => [

        'smtp' => [
            'transport' => 'smtp',
            'scheme' => $smtpScheme,
            'url' => env('MAIL_URL') ?: env('SMTP_URL'),
            'host' => $mailHost,
            'port' => $smtpPort,
            'username' => $smtpUsername,
            'password' => $smtpPassword,
            'timeout' => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
        ],

        'ses' => [
            'transport' => 'ses',
        ],

        'postmark' => [
            'transport' => 'postmark',
            // 'message_stream_id' => env('POSTMARK_MESSAGE_STREAM_ID'),
            // 'client' => [
            //     'timeout' => 5,
            // ],
        ],

        'resend' => [
            'transport' => 'resend',
        ],

        'sendmail' => [
            'transport' => 'sendmail',
            'path' => env('MAIL_SENDMAIL_PATH', '/usr/sbin/sendmail -bs -i'),
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],

        'array' => [
            'transport' => 'array',
        ],

        'failover' => [
            'transport' => 'failover',
            'mailers' => [
                'smtp',
                'log',
            ],
            'retry_after' => 60,
        ],

        'roundrobin' => [
            'transport' => 'roundrobin',
            'mailers' => [
                'ses',
                'postmark',
            ],
            'retry_after' => 60,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Global "From" Address
    |--------------------------------------------------------------------------
    |
    | You may wish for all emails sent by your application to be sent from
    | the same address. Here you may specify a name and address that is
    | used globally for all emails that are sent by your application.
    |
    */

    'from' => [
        'address' => $mailFromAddress,
        'name' => env('MAIL_FROM_NAME') ?: env('APP_NAME', 'OG Landmark'),
    ],

];
