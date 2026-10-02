@extends('layouts.auth')
@section('title','Sign in — OG Landmark')
@section('auth-content')
<span class="eyebrow">Welcome back</span><h2>Pick up where<br>you left off.</h2><p>Sign in to your OG Landmark account.</p>
@if(session('auth_message'))<div class="flash-success" role="status">{{ session('auth_message') }}</div>@endif
@if($errors->any())<div class="form-errors">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
@if(session('success'))<div class="flash-success">{{ session('success') }}</div>@endif
<form method="POST" action="{{ route('auth.login.submit') }}">@csrf
 <input type="hidden" name="role" value="{{ $intendedRole }}">
 <div class="field" style="margin-bottom:16px"><label for="login-identifier">{{ $intendedRole==='admin' ? 'Administrator email' : 'Email, username or phone' }}</label><input id="login-identifier" name="identifier" type="{{ $intendedRole==='admin' ? 'email' : 'text' }}" value="{{ old('identifier', old('email')) }}" autocomplete="username" required autofocus></div>
 @if($intendedRole==='admin' && $adminOtpSent)
  <div class="field" style="margin-bottom:20px"><label for="login-otp">Email verification code</label><input id="login-otp" name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></div>
  <p style="font-size:12px;color:var(--muted)">Enter the six-digit code sent to your administrator email.</p>
 @else
  <div class="field" style="margin-bottom:20px"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div>
 @endif
 <button type="submit" class="btn btn-gold" style="width:100%">{{ $intendedRole==='admin' && $adminOtpSent ? 'Verify and sign in' : 'Sign in' }} <span>↗</span></button>
</form>
@if($intendedRole!=='admin')<p style="margin-top:22px;font-size:12px">New to OG Landmark? <a class="text-link" href="{{ route('auth.register') }}">Create an account</a></p>@endif
@endsection