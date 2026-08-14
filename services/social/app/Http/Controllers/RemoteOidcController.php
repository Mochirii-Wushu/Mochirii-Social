<?php

namespace App\Http\Controllers;

use App\Models\UserOidcMapping;
use App\Rules\EmailNotBanned;
use App\Rules\PixelfedUsername;
use App\Services\EmailService;
use App\Services\MochiriiSocialSyncService;
use App\Services\UserOidcService;
use App\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Purify;

class RemoteOidcController extends Controller
{
    protected $fractal;

    public function start(UserOidcService $provider, Request $request)
    {
        abort_unless((bool) config('remote-auth.oidc.enabled'), 404);
        if ($request->user()) {
            return redirect('/');
        }

        $url = $provider->getAuthorizationUrl([
            'scope' => $provider->getDefaultScopes(),
        ]);

        $request->session()->put('oauth2state', $provider->getState());
        $request->session()->put('oauth2pkceCode', $provider->getPkceCode());

        return redirect($url);
    }

    public function handleCallback(UserOidcService $provider, MochiriiSocialSyncService $socialSync, Request $request)
    {
        abort_unless((bool) config('remote-auth.oidc.enabled'), 404);

        if ($request->user()) {
            return redirect('/');
        }

        abort_unless($request->input('state'), 400);
        abort_unless($request->input('code'), 400);

        abort_unless(hash_equals($request->session()->pull('oauth2state'), $request->input('state')), 400, 'invalid state');

        $provider->setPkceCode($request->session()->pull('oauth2pkceCode'));

        $accessToken = $provider->getAccessToken('authorization_code', [
            'code' => $request->get('code'),
        ]);

        $userInfo = $provider->getResourceOwner($accessToken);
        $userInfoId = $userInfo->getId();
        $userInfoData = $userInfo->toArray();

        $mappedUser = UserOidcMapping::where('oidc_id', $userInfoId)->first();
        if ($mappedUser) {
            $this->guarder()->login($mappedUser->user);
            $socialSync->sync($mappedUser->user, $userInfoId, 'login');

            return redirect('/');
        }

        abort_if(EmailService::isBanned($userInfoData['email']), 400, 'Banned email.');

        $username = $this->usernameFromUserInfo($userInfoData, $userInfoId);

        $user = $this->createUser([
            'username' => $username,
            'name' => $userInfoData['name'] ?? $userInfoData['display_name'] ?? $username,
            'email' => $userInfoData['email'],
        ]);

        UserOidcMapping::create([
            'user_id' => $user->id,
            'oidc_id' => $userInfoId,
        ]);

        $socialSync->sync($user, $userInfoId, 'account_created');

        return redirect('/');
    }

    protected function usernameFromUserInfo(array $userInfoData, $userInfoId)
    {
        $configuredField = config('remote-auth.oidc.field_username');
        $configuredValue = $this->claimValue($userInfoData, $configuredField);

        if ($configuredValue) {
            return $this->normalizeUsername($configuredValue, $userInfoId);
        }

        foreach (['preferred_username', 'username', 'nickname'] as $field) {
            $value = $this->claimValue($userInfoData, $field);
            if ($value) {
                return $this->normalizeUsername($value, $userInfoId);
            }
        }

        foreach (['name', 'display_name'] as $field) {
            $value = $this->claimValue($userInfoData, $field);
            if ($value) {
                return $this->normalizeUsername($value, $userInfoId, true);
            }
        }

        $email = $this->claimValue($userInfoData, 'email');
        if ($email && str_contains($email, '@')) {
            return $this->normalizeUsername(Str::before($email, '@'), $userInfoId, true);
        }

        return $this->normalizeUsername('member', $userInfoId, true);
    }

    protected function claimValue(array $claims, $field)
    {
        if (! is_string($field) || ! array_key_exists($field, $claims)) {
            return null;
        }

        $value = $claims[$field];
        if (! is_scalar($value)) {
            return null;
        }

        return trim((string) $value);
    }

    protected function normalizeUsername($value, $userInfoId, $withSuffix = false)
    {
        $base = strtolower(Str::ascii(trim((string) $value)));
        $base = preg_replace('/[^a-z0-9]+/', '', $base) ?: 'member';

        if ($withSuffix || strlen($base) < 2) {
            $suffix = substr(sha1((string) $userInfoId), 0, 8);
            $base = substr($base, 0, 21) ?: 'member';

            return "{$base}_{$suffix}";
        }

        return substr($base, 0, 30);
    }

    protected function createUser($data)
    {
        $this->validate(new Request($data), [
            'email' => [
                'required',
                'string',
                'email:strict,filter_unicode,dns,spoof',
                'max:255',
                'unique:users',
                new EmailNotBanned,
            ],
            'username' => [
                'required',
                'min:2',
                'max:30',
                'unique:users,username',
                new PixelfedUsername,
            ],
            'name' => 'nullable|max:30',
        ]);

        event(new Registered($user = User::create([
            'name' => Purify::clean($data['name']),
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => Hash::make(Str::password()),
            'email_verified_at' => now(),
            'app_register_ip' => request()->ip(),
            'register_source' => 'oidc',
        ])));

        $this->guarder()->login($user);

        return $user;
    }

    protected function guarder()
    {
        return Auth::guard();
    }
}
