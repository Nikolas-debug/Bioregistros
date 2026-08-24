<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;


Route::get('/{cualquiera?}', SpaController::class)
    ->where('cualquiera', '^(?!api|up).*$');
