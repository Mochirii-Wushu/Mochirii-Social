@extends('settings.template')

@section('section')

  <div class="title">
    <h3 class="font-weight-bold">Delete Your Account</h3>
  </div>
  <hr>
  <div class="mt-3">
	<p>Hi <span class="font-weight-bold">{{Auth::user()->username}}</span>,</p>

	<p>We're sorry to hear you'd like to delete your account.</p>

	<p class="pb-1">If you're just looking to take a break, you can always <a href="{{route('settings.remove.temporary')}}">temporarily disable</a> your account instead.</p>

    <p class="">When you press the button below, your photos, comments, likes, friendships and all other data will be removed permanently and will not be recoverable. If you decide to create another Mochirii Social account in the future, you cannot sign up with the same username again on this community.</p>

    <div class="alert alert-danger my-5">
      <span class="font-weight-bold">Warning:</span> Deletion is permanent. Review your saved media before continuing.
    </div>

	<p>
      <form method="post">
        @csrf
        <div class="custom-control custom-switch mb-3">
          <input type="checkbox" class="custom-control-input" id="confirm-check" name="confirm">
          <label class="custom-control-label font-weight-bold" for="confirm-check">I confirm that this action is not reversible, and will result in the permanent deletion of my account.</label>
        </div>
        <button type="submit" class="btn btn-danger font-weight-bold py-0 delete-btn" disabled="">Permanently delete my account</button>
      </form>
	</p>
  </div>


@endsection

@push('scripts')
<script type="text/javascript">
$(document).ready(function() {
  $('#confirm-check').on('change', function() {
    let el = $(this);
    let state = el.prop('checked');
    if(state == true) {
      $('.delete-btn').removeAttr('disabled');
    } else {
      $('.delete-btn').attr('disabled', '');
    }
  });
});
</script>
@endpush
