@extends('site.help.partial.template', ['breadcrumb'=>'Instance User Limit'])

@section('section')

	<div class="title">
		<h3 class="font-weight-bold">Instance User Limit</h3>
	</div>
	<hr>
	@if(config('pixelfed.max_users'))
	<p class="lead">We have a limit on how many users can join Mochirii Social to keep our community healthy.</p>

	<p class="lead">If you have been redirected to this page, that means we've reached our user limit or we are not accepting new account registrations at this time.</p>

	<p class="lead">Please try again later or contact a Mochirii admin for access guidance.</p>
	@else
	<p class="lead">We do not have a limit on how many users can join Mochirii Social.</p>

	<p class="lead">If Mochirii Social is not available to your account, contact a Mochirii admin for access guidance.</p>
	@endif
@endsection
