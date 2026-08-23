<?php

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
| Permite que la PWA servida por Vite (http://localhost:3000) y los
| celulares en la red de la clinica llamen a la API.
|
| En produccion reemplace allowed_origins_patterns por los dominios reales.
*/

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => explode(',', env('CORS_ORIGENES', 'http://localhost:3000,http://localhost:5173')),

    // Cualquier equipo de la LAN de la clinica (192.168.x.x / 10.x.x.x).
    'allowed_origins_patterns' => [
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
