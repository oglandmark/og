@extends('layouts.auth')
@section('title','Create an account — OG Landmark')
@section('auth-content')
<span class="eyebrow">A more considered move</span><h2>Create your<br>OG Landmark account.</h2><p>Join as a buyer, seller or property professional.</p>
@if($errors->any())<div class="form-errors">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
<form method="POST" action="{{ route('auth.register.submit') }}">@csrf
 <div class="field" style="margin-bottom:14px"><label for="register-name">Full name</label><input id="register-name" name="name" value="{{ old('name') }}" autocomplete="name" required></div>
 <div class="field" style="margin-bottom:14px"><label for="register-email">Email address</label><input id="register-email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" required></div>
 <div class="field" style="margin-bottom:14px"><label for="register-phone">Mobile number</label><input id="register-phone" name="phone" type="tel" value="{{ old('phone') }}" autocomplete="tel" placeholder="+92 300 1234567" required></div>
 <div class="field" style="margin-bottom:14px"><label for="register-city">City (optional)</label><input id="register-city" name="city" value="{{ old('city') }}" autocomplete="address-level2"></div>
 <div class="field" style="margin-bottom:14px"><label for="register-role">I’m here as a</label><select id="register-role" name="role" required><option value="">Choose your role</option><option value="buyer" @selected(old('role', $intendedRole)==='buyer')>Buyer</option><option value="seller" @selected(old('role', $intendedRole)==='seller')>Seller</option><option value="agent" @selected(old('role', $intendedRole)==='agent')>Agent</option></select></div>
 <div class="form-grid" style="margin-bottom:18px"><div class="field"><label for="register-password">Password</label><input id="register-password" name="password" type="password" autocomplete="new-password" required></div><div class="field"><label for="register-confirm">Confirm password</label><input id="register-confirm" name="password_confirmation" type="password" autocomplete="new-password" required></div></div>
 <button type="submit" class="btn btn-gold" style="width:100%">Create account <span>↗</span></button>
</form>
<p style="margin-top:22px;font-size:12px">Already registered? <a class="text-link" href="{{ route('auth.login') }}">Sign in</a></p>
@endsection