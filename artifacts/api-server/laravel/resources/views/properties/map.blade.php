@extends('layouts.landmark')
@section('title','Explore property map — OG Landmark')
@section('content')
<section class="page-hero"><div class="wrap"><div class="breadcrumb"><a href="{{ route('properties.index') }}">Properties</a> / Map</div><h1>Explore by location.</h1><p>Start with the neighbourhood. Find the property that feels right from there.</p></div></section>
<section class="section"><div class="wrap">
 <form method="GET" action="{{ route('properties.index') }}" class="search-panel" style="margin:0 0 22px;box-shadow:none"><div class="search-grid"><div class="field"><label for="map-city">City or area</label><input id="map-city" name="city" value="{{ request('city') }}" placeholder="Enter a city"></div><div class="field"><label for="map-purpose">Purpose</label><select name="purpose" id="map-purpose"><option value="">Any purpose</option><option value="sale">Buy</option><option value="rent">Rent</option></select></div><button class="btn btn-gold" type="submit">Search properties</button></div></form>
 <div class="map-panel"><div><span class="eyebrow">Location search</span><strong>Map view is ready for your listings</strong><p>Open the property search to see available places in a list, or refine by city and purpose above.</p><a class="btn btn-gold" href="{{ route('properties.index',request()->query()) }}">Browse matching properties</a></div></div>
 @if(isset($properties) && count($properties))<div style="margin-top:35px"><div class="section-head"><div><span class="eyebrow">In this area</span><h2>Available properties</h2></div></div><div class="property-grid">@foreach($properties as $property)@include('partials.property-card',['property'=>$property])@endforeach</div></div>@endif
</div></section>
@endsection