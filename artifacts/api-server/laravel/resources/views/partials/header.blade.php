<header class="site-header">
 <div class="wrap header-row">
  <a class="brand" href="{{ route('home') }}" aria-label="OG Landmark home">
   <span class="brand-mark"><img src="{{ asset('images/brand-logo.png') }}" alt=""></span><span class="brand-copy">OG LANDMARK<small>PROPERTY, WITH PERSPECTIVE</small></span>
  </a>
  <button class="nav-toggle" aria-label="Open navigation" aria-expanded="false">≡</button>
  <nav class="main-nav" aria-label="Main navigation">
   <a href="{{ route('home') }}">Home</a><a href="{{ route('properties.index') }}">Properties</a><a href="{{ route('agents.index') }}">Agents</a><a href="{{ route('about') }}">About</a><a href="{{ route('blog.index') }}">Journal</a><a href="{{ route('contact') }}">Contact</a>
  </nav>
  <div class="header-actions"><a class="btn btn-outline btn-sm" href="{{ route('auth.login') }}">Sign in</a><a class="btn btn-gold btn-sm" href="{{ route('properties.index') }}">Explore homes <span aria-hidden="true">↗</span></a></div>
 </div>
</header>