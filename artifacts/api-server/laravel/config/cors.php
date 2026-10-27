<?php

$allowedOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,https://oglandmark.com,https://www.oglandmark.com')),
)));

if (env('APP_ENV', 'production') === 'local') {
    $allowedOrigins = array_values(array_unique([
        ...$allowedOrigins,
        'http://localhost:25189',
        'http://127.0.0.1:25189',
    ]));
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $allowedOrigins,
    // Expo web previews call the public live property API directly. This
    // grants read-only CORS access to the Replit Expo preview hostname family.
    'allowed_origins_patterns' => [
        '#^https://[a-z0-9-]+\.expo\.pike\.replit\.dev$#i',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['X-Total-Count', 'X-Page-Offset', 'X-Page-Size', 'X-Has-More'],
    'max_age' => 600,
    'supports_credentials' => false,
];
