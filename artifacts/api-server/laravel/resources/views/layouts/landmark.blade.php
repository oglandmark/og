<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>@yield('title', 'OG Landmark — Find your place in Pakistan')</title>
 <meta name="description" content="@yield('description', 'A clearer way to find, sell and invest in property across Pakistan.')">
 <link rel="stylesheet" href="{{ asset('css/landmark.css') }}">
</head>
<body>
 @include('partials.header')
 @if(session('success'))<div class="wrap" style="padding-top:18px"><div class="flash-success" role="status">{{ session('success') }}</div></div>@endif
 @if(session('mail_error'))<div class="wrap" style="padding-top:14px"><div class="form-errors" role="alert">{{ session('mail_error') }}</div></div>@endif
 @if($errors->any())<div class="wrap" style="padding-top:14px"><div class="form-errors" role="alert">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div></div>@endif
 @yield('content')
 @include('partials.footer')
 <script src="{{ asset('js/landmark.js') }}" defer></script>
 @stack('scripts')
</body>
</html>