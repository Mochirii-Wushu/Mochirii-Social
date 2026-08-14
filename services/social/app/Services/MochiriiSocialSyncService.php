<?php

namespace App\Services;

use App\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MochiriiSocialSyncService
{
    public function sync(User $user, string $oidcId, string $event = 'login'): bool
    {
        $endpoint = trim((string) config('remote-auth.social_sync.endpoint'));
        $secret = trim((string) config('remote-auth.social_sync.secret'));

        if (! $endpoint || ! $secret) {
            Log::warning('Mochirii Social account sync is not configured.', [
                'has_endpoint' => (bool) $endpoint,
                'has_secret' => (bool) $secret,
            ]);

            return false;
        }

        $payload = [
            'sub' => $oidcId,
            'provider_user_id' => (string) $user->id,
            'username' => $user->username,
            'profile_url' => url($user->username),
            'event' => $event,
            'timestamp' => now()->toJSON(),
        ];

        try {
            $response = Http::timeout((int) config('remote-auth.social_sync.timeout', 5))
                ->acceptJson()
                ->withHeaders([
                    'x-mochirii-social-sync-secret' => $secret,
                ])
                ->post($endpoint, $payload);
        } catch (\Throwable $error) {
            Log::warning('Mochirii Social account sync request failed.', [
                'message' => $error->getMessage(),
            ]);

            return false;
        }

        if (! $response->successful()) {
            Log::warning('Mochirii Social account sync was rejected.', [
                'status' => $response->status(),
            ]);

            return false;
        }

        return true;
    }
}
