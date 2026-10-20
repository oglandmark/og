@extends('layouts.auth')
@section('title', 'Choose a new admin password — OG Landmark')
@section('auth-content')
<span class="eyebrow">Secure account recovery</span>
<h2>Choose a new<br>password.</h2>
<p>Enter the six-digit code sent to your administrator email, then choose a new password.</p>
@if(session('success'))<div class="flash-success" role="status">{{ session('success') }}</div>@endif
@if($errors->any())<div class="form-errors" role="alert">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
<form method="POST" action="{{ route('admin.password.update') }}">
    @csrf
    <div class="field" style="margin-bottom:16px">
        <label for="reset-email">Administrator email</label>
        <input id="reset-email" name="email" type="email" value="{{ old('email', $email) }}" autocomplete="email" required>
    </div>
    <div class="field" style="margin-bottom:16px">
        <label for="reset-code">Six-digit reset code</label>
        <input id="reset-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required>
    </div>
    <div class="field" style="margin-bottom:16px">
        <label for="new-password">New password</label>
        <input id="new-password" name="newPassword" type="password" minlength="8" maxlength="256" autocomplete="new-password" required>
        <small style="color:var(--muted)">Use at least 8 characters.</small>
    </div>
    <div class="field" style="margin-bottom:20px">
        <label for="new-password-confirmation">Confirm new password</label>
        <input id="new-password-confirmation" name="newPassword_confirmation" type="password" minlength="8" maxlength="256" autocomplete="new-password" required>
    </div>
    <button type="submit" class="btn btn-gold" style="width:100%">Reset password <span>↗</span></button>
</form>
<p style="margin-top:22px"><a class="text-link" href="{{ route('admin.password.request') }}">Request a new reset code</a></p>
@endsection
