@extends('site.help.partial.template', ['breadcrumb'=>'Timelines'])

@section('section')

	<div class="title">
		<h3 class="font-weight-bold">Timelines</h3>
	</div>
	<hr>
	<p class="lead">Timelines are chronological feeds of posts.</p>
	<ul class="list-unstyled">
		<li class="lead mb-2">
			<span class="font-weight-bold"><i class="fas fa-home mr-2"></i> Home</span>
			<span class="px-2">&mdash;</span>
			<span class="font-weight-light">Timeline with content from accounts you follow</span>
		</li>
		<li class="lead mb-2">
			<span class="font-weight-bold"><i class="fas fa-stream mr-2"></i> Guild Feed</span>
			<span class="px-2">&mdash;</span>
			<span class="font-weight-light">Timeline with public posts from Mochirii members</span>
		</li>
		@auth
		@if(Auth::user()->is_admin)
		<li class="lead">
			<span class="font-weight-bold"><i class="fas fa-globe mr-2"></i> Network</span>
			<span class="px-2">&mdash;</span>
			<span class="font-weight-light">Timeline with unmoderated content from other servers</span>
		</li>
		@endif
		@endauth
	</ul>
	<div class="py-3"></div>
	<div class="card bg-primary border-primary" style="box-shadow: none !important;border: 3px solid #08d!important;">
		<div class="card-header text-light font-weight-bold h4 p-4 bg-primary">Timeline Tips</div>
		<div class="card-body bg-white p-3">
			<ul class="pt-3">
				<li class="lead mb-4">You can mute or block accounts to prevent them from appearing in Home and Guild Feed.</li>
				<li class="lead mb-4">You can create <span class="font-weight-bold">Unlisted</span> posts that do not appear in Guild Feed.</li>

			</ul>
		</div>
	</div>
@endsection
