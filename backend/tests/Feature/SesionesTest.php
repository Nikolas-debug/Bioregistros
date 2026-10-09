<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SesionesTest extends TestCase
{
    use RefreshDatabase;

    public function test_varios_dispositivos_y_logout(): void
    {
        $u = User::factory()->create();
        $tokens = array_map(fn () => $u->generarToken(), range(1, User::MAX_SESIONES + 1));

        $this->assertNull(User::porToken($tokens[0]), 'el mas viejo sale');
        foreach (array_slice($tokens, 1) as $t) {
            $this->assertTrue($u->is(User::porToken($t)));
        }

        $this->withToken($tokens[1])->postJson('/api/auth/logout')->assertOk();
        $this->assertNull(User::porToken($tokens[1]));
        $this->assertNotNull(User::porToken($tokens[2]));
    }
}
