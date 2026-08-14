<x-mail::message>
# You've been invited to join Mochirii Social!

<x-mail::panel>
A parent account with the username **{{ $verify->parent->username }}** has invited you to join Mochirii Social with a special youth account managed by them.

If you do not recognize this account as your parents or a trusted guardian, please check with them first.
</x-mail::panel>

<x-mail::button :url="$verify->inviteUrl()">
Accept Invite
</x-mail::button>

Thanks,<br>
Mochirii Social

<small>This email is automatically generated. Please do not reply to this message.</small>
</x-mail::message>
