<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="csrf-token" content="{{ csrf_token() }}">

	<meta name="mobile-web-app-capable" content="yes">

	<title>{{ config_cache('app.name', 'Mochirii Social') }}</title>

	<link rel="canonical" href="{{ request()->url() }}" />

	<meta property="og:site_name" content="{{ config_cache('app.name', 'Mochirii Social') }}" />
	<meta property="og:title" content="{{ config_cache('app.name', 'Mochirii Social') }}" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{{request()->url()}}" />
	<meta property="og:image" content="{{ url('/img/mochirii-social-card.png') }}" />
	<meta property="og:description" content="{{ config_cache('app.short_description') ?? 'A members-only Mochirii social hall for guild image posts and profiles.' }}" />
	<meta name="description" content="{{ config_cache('app.short_description') ?? 'A members-only Mochirii social hall for guild image posts and profiles.' }}" />
	<meta name="twitter:title" content="{{ config_cache('app.name', 'Mochirii Social') }}" />
    <meta name="twitter:description" content="{{ config_cache('app.short_description') ?? 'A members-only Mochirii social hall for guild image posts and profiles.' }}" />
    <meta name="twitter:image" content="{{ url('/img/mochirii-social-card.png') }}" />
    <meta name="twitter:card" content="summary_large_image" />

	<meta name="medium" content="image">
	<meta name="theme-color" content="#172a23">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<link rel="manifest" href="{{url('/manifest.json')}}" />
	<link rel="icon" type="image/png" href="{{url('/img/mochirii-icon.png')}}">
	<link rel="apple-touch-icon" type="image/png" href="{{url('/img/mochirii-icon.png')}}">
	<link rel="preload" as="image" href="{{ url('/img/mochirii-social-card.png')}}" />
	<style>
		:root { color-scheme: dark; }
		* { box-sizing: border-box; }
		body {
			min-height: 100vh;
			margin: 0;
			color: #f7eddd;
			font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background:
				linear-gradient(180deg, rgba(8, 15, 14, 0.72), rgba(8, 15, 14, 0.92)),
				url('/img/mochirii-social-card.png') center / cover fixed,
				#101c19;
		}
		main {
			min-height: 100vh;
			display: grid;
			place-items: center;
			padding: clamp(1.25rem, 4vw, 3rem);
		}
		.social-landing {
			width: min(680px, 100%);
			padding: clamp(1.5rem, 5vw, 3rem);
			border: 1px solid rgba(223, 190, 113, 0.28);
			border-radius: 24px;
			background: rgba(10, 21, 18, 0.84);
			box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
			backdrop-filter: blur(22px);
		}
		.social-landing img {
			width: 76px;
			height: 76px;
			object-fit: contain;
			filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.42));
		}
		.social-landing__kicker {
			margin: 1rem 0 0.45rem;
			color: #dcb66b;
			font-size: 0.76rem;
			font-weight: 800;
			letter-spacing: 0.16em;
			text-transform: uppercase;
		}
		h1 {
			margin: 0;
			font-size: clamp(2.2rem, 8vw, 4.8rem);
			line-height: 0.95;
		}
		p {
			max-width: 54ch;
			color: rgba(247, 237, 221, 0.82);
			font-size: clamp(1rem, 2vw, 1.15rem);
			line-height: 1.7;
		}
		.social-landing__actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.8rem;
			margin-top: 1.4rem;
		}
		a {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 46px;
			padding: 0.75rem 1.1rem;
			border-radius: 999px;
			color: #fff8e9;
			font-weight: 800;
			text-decoration: none;
		}
		.social-landing__primary {
			border: 1px solid rgba(246, 218, 147, 0.55);
			background: linear-gradient(135deg, #2f6f55, #d0a952);
		}
		.social-landing__secondary {
			border: 1px solid rgba(247, 237, 221, 0.22);
			background: rgba(247, 237, 221, 0.08);
		}
	</style>
</head>
	<body>
		<main id="content">
			<section class="social-landing" aria-labelledby="socialLandingTitle">
				<img src="{{ config('app.logo') }}" alt="Mochirii Social emblem">
				<p class="social-landing__kicker">Guild Social</p>
				<h1 id="socialLandingTitle">Mochirii Social</h1>
				<p>A members-only image hall for Mochirii profiles, gallery posts, and quiet guild sharing. Active members enter through the Mochirii doorway.</p>
				<div class="social-landing__actions">
					<a class="social-landing__primary" href="/login">Login</a>
					<a class="social-landing__secondary" href="https://mochirii.com/social">Return to Mochirii</a>
				</div>
			</section>
		</main>
	</body>
</html>
