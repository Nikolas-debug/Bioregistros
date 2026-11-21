<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Los tests borran y recrean tablas (RefreshDatabase). Si por cualquier
     * motivo la conexion no apunta a la base de prueba local, se detienen
     * ANTES de que el trait toque nada: setUpTraits es justo lo que lo corre.
     */
    protected function setUpTraits()
    {
        $c = config('database.connections.' . config('database.default'));

        if (! empty($c['url'])
            || ! in_array($c['host'] ?? null, ['127.0.0.1', 'localhost'], true)
            || ($c['database'] ?? null) !== 'bioregistros_test') {
            fwrite(STDERR, "\nTests detenidos: la conexion no es la base local de prueba.\n");
            exit(1);
        }

        return parent::setUpTraits();
    }
}
