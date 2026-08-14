<?php

namespace App\Http\Middleware;

use Auth;
use Closure;

class AdminOrNotFound
{
    /**
     * Hide staging/admin-only routes from ordinary members.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        abort_if(Auth::check() == false || Auth::user()->is_admin == false, 404);

        return $next($request);
    }
}
