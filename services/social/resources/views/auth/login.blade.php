@extends('layouts.app')

@section('content')
<div class="container mt-4 mochirii-social-login">
    <div class="row justify-content-center">
        <div class="col-lg-5">
            <div class="card shadow-none border mochirii-social-card">
                <div class="card-header bg-transparent p-4 text-center mochirii-social-card__head">
                    <img src="{{ config('app.logo') }}" width="64" height="64" alt="Mochirii Social emblem">
                    <p class="mochirii-social-kicker">Guild Social</p>
                    <h1 class="font-weight-bold mb-2">Mochirii Social Login</h1>
                    <p class="mb-0">Members enter through the Mochirii doorway. Keep your account close, kind, and guild-only.</p>
                </div>

                @if ($errors->any())
                    @foreach ($errors->all() as $error)
                    <div class="alert alert-danger m-3">
                        <span class="font-weight-bold small"><i class="far fa-exclamation-triangle mr-2"></i> {{ $error }}</span>
                    </div>
                    @endforeach
                @endif
                <div class="card-body">
                    @if( config('remote-auth.oidc.enabled') )
                    <div class="form-group row mb-4">
                        <div class="col-md-12">
                            <a href="/auth/oidc/start" class="btn btn-primary btn-block btn-lg rounded-pill font-weight-bold mochirii-social-primary">
                                Continue with Mochirii
                            </a>
                        </div>
                    </div>
                    <div class="mochirii-social-divider"><span>Direct account login</span></div>
                    @endif

                    <form method="POST" action="{{ route('login') }}">
                        @csrf

                        <div class="form-group row mb-0">

                            <div class="col-md-12">
                                <label for="email" class="small font-weight-bold text-muted mb-0">{{__("auth.emailAddress")}}</label>
                                <input id="email" type="email" class="form-control{{ $errors->has('email') ? ' is-invalid' : '' }}" name="email" value="{{ old('email') }}" placeholder="{{__('Email')}}" required autofocus>

                                @if ($errors->has('email'))
                                    <span class="invalid-feedback">
                                        <strong>{{ $errors->first('email') }}</strong>
                                    </span>
                                @endif

                                <div class="help-text small text-right mb-0">
                                    <a href="{{ route('email.forgot') }}" class="small text-muted font-weight-bold">
                                        {{ __('Forgot Email') }}
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div class="form-group row mb-0">

                            <div class="col-md-12">
                                <label for="password" class="small font-weight-bold text-muted mb-0">{{ __("auth.password")}}</label>
                                <input id="password" type="password" class="form-control{{ $errors->has('password') ? ' is-invalid' : '' }}" name="password" placeholder="{{__('Password')}}" required>

                                @if ($errors->has('password'))
                                    <span class="invalid-feedback">
                                        <strong>{{ $errors->first('password') }}</strong>
                                    </span>
                                @endif

                                <p class="help-text small text-right mb-0">
                                    <a href="{{ route('password.request') }}" class="small text-muted font-weight-bold">
                                        {{ __('auth.forgot') }}
                                    </a>
                                </p>
                            </div>
                        </div>

                        <div class="form-group row">
                            <div class="col-md-12">
                                <div class="checkbox">
                                    <label>
                                        <input type="checkbox" name="remember" {{ old('remember') ? 'checked' : '' }}>
                                        <span class="font-weight-bold ml-1 text-muted">
                                            {{ __('auth.remember') }}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        @if(
	(bool) config_cache('captcha.enabled') &&
	(bool) config_cache('captcha.active.login') ||
	(
		(bool) config_cache('captcha.triggers.login.enabled') &&
		request()->session()->has('login_attempts') &&
		request()->session()->get('login_attempts') >= config('captcha.triggers.login.attempts')
	)
                        )
	                        <div class="d-flex justify-content-center mb-3">
	                            {!! Captcha::display() !!}
	                        </div>
                        @endif

                        <button type="submit" class="btn btn-primary btn-block btn-lg font-weight-bold rounded-pill">
                            {{ __('auth.login') }}
                        </button>

                    </form>
                    @if((bool) config_cache('pixelfed.open_registration') || (bool) config_cache('instance.curated_registration.enabled'))
                    <hr>

                    <p class="text-center font-weight-bold mb-0">
                        <a href="/register">{{ __("auth.register")}}</a>
                    </p>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('styles')
<style>
    body {
        min-height: 100vh;
        color: #f4ead8;
        background:
            linear-gradient(180deg, rgba(8, 15, 14, 0.76), rgba(8, 15, 14, 0.92)),
            url('/img/mochirii-social-card.png') center top / cover fixed,
            #101c19;
    }

    body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 20% 0%, rgba(218, 178, 103, 0.18), transparent 34%),
                    radial-gradient(circle at 80% 20%, rgba(246, 190, 204, 0.13), transparent 30%);
        z-index: -1;
    }

    .navbar-mochirii {
        background: rgba(12, 23, 20, 0.86) !important;
        border-bottom: 1px solid rgba(223, 190, 113, 0.25) !important;
        backdrop-filter: blur(18px);
    }

    .navbar-light .navbar-brand,
    .navbar-light .navbar-brand span,
    .navbar-light .navbar-nav .nav-link {
        color: #f6eddc !important;
    }

    .navbar-brand img {
        width: 42px;
        height: 42px;
        object-fit: contain;
        padding: 0 !important;
        margin-right: 0.65rem;
        filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.36));
    }

    .mochirii-social-login {
        padding-top: clamp(2rem, 5vw, 4rem);
        padding-bottom: clamp(3rem, 8vw, 6rem);
    }

    .mochirii-social-card {
        overflow: hidden;
        color: #f8eddd;
        border-color: rgba(223, 190, 113, 0.28) !important;
        border-radius: 22px;
        background: rgba(10, 21, 18, 0.86);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(22px);
    }

    .mochirii-social-card__head {
        border-bottom: 1px solid rgba(223, 190, 113, 0.2);
        background: linear-gradient(135deg, rgba(23, 49, 39, 0.88), rgba(43, 38, 33, 0.78)) !important;
    }

    .mochirii-social-card__head img {
        object-fit: contain;
        margin-bottom: 0.75rem;
        filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.42));
    }

    .mochirii-social-card h1 {
        font-size: clamp(1.65rem, 4vw, 2.15rem);
        line-height: 1.1;
        color: #fff6e7;
    }

    .mochirii-social-card p,
    .mochirii-social-card label,
    .mochirii-social-card .text-muted,
    .mochirii-social-card .help-text a {
        color: rgba(248, 237, 221, 0.76) !important;
    }

    .mochirii-social-kicker {
        margin: 0 0 0.35rem;
        color: #dcb66b !important;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .mochirii-social-card .form-control {
        min-height: 46px;
        color: #13251f;
        border-color: rgba(223, 190, 113, 0.34);
        border-radius: 12px;
        background: rgba(255, 250, 242, 0.94);
    }

    .mochirii-social-card .form-control:focus {
        border-color: #dcb66b;
        box-shadow: 0 0 0 0.18rem rgba(220, 182, 107, 0.26);
    }

    .mochirii-social-card .btn-primary,
    .mochirii-social-primary {
        border: 1px solid rgba(246, 218, 147, 0.55);
        background: linear-gradient(135deg, #2f6f55, #d0a952) !important;
        color: #fff8e9;
        box-shadow: 0 18px 36px rgba(16, 32, 27, 0.38);
    }

    .mochirii-social-divider {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin: 0.35rem 0 1.2rem;
        color: rgba(248, 237, 221, 0.66);
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
    }

    .mochirii-social-divider::before,
    .mochirii-social-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: rgba(223, 190, 113, 0.24);
    }

    footer a,
    footer .text-muted {
        color: rgba(248, 237, 221, 0.72) !important;
    }

    @media (max-width: 640px) {
        .mochirii-social-login {
            padding-inline: 0.75rem;
        }

        .mochirii-social-card {
            border-radius: 18px;
        }
    }
</style>
@endpush

@push('scripts')
<script>
document.addEventListener("DOMContentLoaded", function() {
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    const email = getQueryParam('email');
    if (email) {
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = email;
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                passwordInput.focus();
            }
        }
    }
});
</script>
@endpush
