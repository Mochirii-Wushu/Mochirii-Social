@extends('settings.template')

@section('section')

  <div class="title">
    <h3 class="font-weight-bold">Data Import</h3>
    <p class="lead">Step 1</p>
  </div>
  <hr>
  <section>
    <p class="lead">Before you proceed, confirm the archive was provided through an approved Mochirii Social administrator workflow.</p>
  </section>
  <section class="mt-5 col-md-8 offset-md-2">
    <div class="card mb-3 step-one">
      <div class="card-body text-center">
        <p class="h5 font-weight-bold">Import <b>photos</b> directory</p>
        <p class="text-muted">250mb limit, if your photos directory exceeds that amount, you will have to wait until we support larger imports.</p>
        <hr>
        <form enctype="multipart/form-data" class="" method="post">
          @csrf
          <input type="file" name="media[]" multiple="" directory="" webkitdirectory="" mozdirectory="" accept="image/*">
          <button type="submit" class="mt-4 btn btn-primary btn-block font-weight-bold">Upload Photos</button>
        </form>
      </div>
    </div>
  </section>

@endsection
