@extends('layouts.landmark')
@section('title',($property->title ?? 'Property details').' — OG Landmark')
@section('content')
@php($pics=$property->images ?? [])
@if(is_string($pics)) @php($pics=json_decode($pics,true) ?: [$pics]) @endif
@php($heroPic=is_array($pics) ? ($pics[0] ?? null) : null)
@php($heroPic=$heroPic ? (str_starts_with($heroPic,'http') || str_starts_with($heroPic,'/') ? $heroPic : asset('storage/'.$heroPic)) : asset('images/mobile-banners/homes.jpg'))
<section class="page-hero"><div class="wrap"><div class="breadcrumb"><a href="{{ route('properties.index') }}">Properties</a> / {{ $property->city ?? 'Pakistan' }}</div><h1>{{ $property->title ?? 'Property details' }}</h1><p>{{ $property->address ?? $property->city ?? 'Pakistan' }}</p></div></section>
<section class="section"><div class="wrap detail-grid"><div>
 <div class="detail-cover"><img src="{{ $heroPic }}" alt="{{ $property->title ?? 'Property' }}"></div>
 @if(is_array($pics) && count($pics)>1)<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">@foreach(array_slice($pics,1,4) as $pic)<img style="width:100%;height:95px;object-fit:cover" src="{{ str_starts_with($pic,'http') || str_starts_with($pic,'/') ? $pic : asset('storage/'.$pic) }}" alt="More views of {{ $property->title ?? 'the property' }}" loading="lazy">@endforeach</div>@endif
 <div class="detail-heading"><span class="eyebrow">{{ $property->type ?? 'Property' }} @if(!empty($property->purpose)) / {{ $property->purpose }} @endif</span><h1>{{ $property->title ?? 'A place to make your own' }}</h1><div class="property-location">{{ $property->address ?? $property->city ?? 'Pakistan' }}</div></div>
 <div class="detail-section"><h2>Property overview</h2><div class="detail-stats"><div><strong>{{ $property->bedrooms ?? '—' }}</strong><small>Bedrooms</small></div><div><strong>{{ $property->bathrooms ?? '—' }}</strong><small>Bathrooms</small></div><div><strong>{{ $property->area ?? '—' }}</strong><small>Area</small></div></div><p>{{ $property->description ?? 'Contact our team for further information about this property, its features and location.' }}</p></div>
 <div class="detail-section"><h2>Location</h2><p>{{ $property->address ?? $property->city ?? 'Location details available on request.' }}</p><a class="text-link" href="{{ route('properties.map',['city'=>$property->city ?? '']) }}">Explore the area on map</a></div>
 </div>
 <aside class="detail-panel"><span class="eyebrow">{{ $property->status ?? 'Available' }}</span><div class="detail-price">@if(is_numeric($property->price ?? null))PKR {{ number_format((float)$property->price) }}@else{{ $property->price ?? 'Price on request' }}@endif
   @include('partials.property-save-form',['property'=>$property])
  </div><h3>Make an enquiry</h3><p style="font-size:12px;color:var(--muted)">Your enquiry will be saved to My inquiries so you can find it again.</p>
   @if($buyerSignedIn ?? false)
    <form method="POST" action="{{ route('buyer.inquiry.store', $property->id) }}">@csrf
     <div class="field" style="margin-bottom:14px"><label for="inq-message">Message</label><textarea id="inq-message" name="message" rows="4" maxlength="5000" required>{{ old('message') }}</textarea></div>
     <button class="btn btn-gold" style="width:100%" type="submit">Send enquiry</button>
    </form>
   @else
    <p style="font-size:12px;color:var(--muted)">Sign in with a buyer account to send and track an enquiry.</p>
    <a class="btn btn-gold" style="width:100%;text-align:center" href="{{ route('auth.login',['role'=>'buyer']) }}">Sign in as buyer</a>
   @endif
 </aside></div></section>
@endsection