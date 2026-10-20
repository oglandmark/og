@extends('layouts.auth')
@section('title', 'Reset admin password — OG Landmark')
@section('auth-content')
<span class="eyebrow">Account recovery</span>
<h2>Reset your<br>admin password.</h2>
<p>Enter the administrator email. If it matches an admin account, we’ll send a six-digit reset code.</p>
@if($errors->any())<div class="form-errors" role="alert">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
@if(session('success'))<div class="flash-success" role="status">{{ session('success') }}</div>@endif
<form method="POST" action="{{ route('admin.password.email') }}">
    @csrf
    <div class="field" style="margin-bottom:20px">
        <label for="reset-email">Administrator email</label>
        <input id="reset-email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" required autofocus>
    </div>
    <button type="submit" class="btn btn-gold" style="width:100%">Send reset code <span>↗</span></button>
</form>
<p style="margin-top:22px"><a class="text-link" href="{{ route('auth.login', ['role' => 'admin']) }}">← Back to admin sign in</a></p>
@endsection
