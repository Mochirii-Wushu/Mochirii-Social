@extends('layouts.app')

@section('content')
<div class="container mt-5">
	<div class="col-12">
		<p class="font-weight-bold text-lighter text-uppercase">Terms of Use</p>
		<div class="card border shadow-none">
			<div class="card-body p-md-5 text-justify mx-md-3">
				@if($page && $page->content)
				{!! $page->content !!}
				@else
				<div class="terms">
					<h5 class="font-weight-bold">1. Terms</h5>
					<p>By accessing Mochirii Social at <a href="{{config('app.url')}}">{{config('app.url')}}</a>, you agree to follow these terms, applicable laws, and our community rules. If you do not agree, you may not use this service.</p>

					<h5 class="font-weight-bold mt-5">2. Use License</h5>
					<p>Mochirii Social is provided for guild communication, community sharing, and member expression. You may not misuse the service, attempt to reverse engineer private systems, remove ownership notices, or mirror member content outside approved community use.</p>

					<h5 class="font-weight-bold mt-5">3. Disclaimer</h5>
					<p>Mochirii Social is provided as-is for the Mochirii community. We work to keep the service reliable, respectful, and safe, but we do not guarantee uninterrupted availability or error-free operation.</p>

					<h5 class="font-weight-bold mt-5">4. Limitations</h5>
					<p>Mochirii and its operators are not liable for indirect, incidental, or consequential damages related to your use of the service, to the fullest extent allowed by law.</p>

					<h5 class="font-weight-bold mt-5">5. Accuracy of Materials</h5>
					<p>Community pages, help text, and service details may change as Mochirii Social evolves. We may update these materials at any time.</p>

					<h5 class="font-weight-bold mt-5">6. Links</h5>
					<p>Members may share links as part of community discussion. A link does not mean Mochirii endorses the linked site or content.</p>

					<h5 class="font-weight-bold mt-5">7. Modifications</h5>
					<p>We may revise these terms as the guild social platform changes. Continued use of Mochirii Social means you accept the current terms.</p>

					<h5 class="font-weight-bold mt-5">8. Community Guidelines</h5>
					<p>You can view our Community Guidelines <a href="{{route('help.community-guidelines')}}">here</a>.</p>
				</div>
				@endif
			</div>
		</div>
	</div>
</div>
@endsection

@push('meta')
<meta property="og:description" content="Terms of Use">
@endpush
