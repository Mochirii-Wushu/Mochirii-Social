@extends('settings.template')

@section('section')

  <div class="title">
    <h3 class="font-weight-bold">Import Posts</h3>
  </div>
  <hr>
  <section>
    <div class="alert alert-info">
      <p class="mb-0 font-weight-bold">Imports are disabled during Mochirii Social staging. Contact a Mochirii admin before importing posts.</p>
    </div>
    <p class="lead font-weight-bold mb-1">Requirements:</p>
    <ul class="lead mb-4">
      <li>outbox.json file</li>
      <li>media_attachments directory</li>
    </ul>
    <p class="lead font-weight-bold mb-1">Process:</p>
    <ol class="lead mb-4">
      <li>Upload outbox.json file</li>
      <li>Upload media_attachments directory</li>
      <li>Confirm each post</li>
      <li>Import Data</li>
    </ol>
    <p>
      <a class="btn btn-primary btn-block font-weight-bold py-1" href="#">Start Import</a>
    </p>
  </section>


@endsection
