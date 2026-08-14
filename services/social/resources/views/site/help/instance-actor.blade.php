@extends('site.help.partial.template', ['breadcrumb'=>'Instance Actor'])

@section('section')

  <div class="title">
    <h3 class="font-weight-bold">Service Account</h3>
  </div>
  <hr>
  <p class="lead">Mochirii Social uses a reserved service account for platform operations.</p>
  <div class="py-4">
    <p class="font-weight-bold h5 pb-3">For Admins</p>
    <p class="mb-0">This reserved account is not a member profile and should not be used for normal posting or messaging.</p>
  </div>
  <hr>
  <div class="card bg-primary border-primary" style="box-shadow: none !important;border: 3px solid #08d!important;">
    <div class="card-header text-light font-weight-bold h4 p-4 bg-primary">Service Account Tips</div>
    <div class="card-body bg-white p-3">
      <ul class="pt-3">
        <li class="lead  mb-4">The service account will not appear in search results.</li>
        <li class="lead  mb-4">You cannot follow the service account.</li>
        <li class="lead  mb-4">The service account does not follow accounts.</li>
        <li class="lead">The service account does not post or share member content.</li>
      </ul>
    </div>
  </div>
@endsection
