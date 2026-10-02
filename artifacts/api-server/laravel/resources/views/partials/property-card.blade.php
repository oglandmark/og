@php
 $pics = $property->images ?? [];
 if (is_string($pics)) $pics = json_decode($pics, true) ?: [$pics];
 $cover = is_array($pics) ? ($pics[0] ?? null) : null;
 $cover = $cover ? (str_starts_with($cover, 'http') || str_starts_with($cover, '/') ? $cover : asset('storage/'.$cover)) : asset('images/mobile-banners/homes.jpg');
 $amount = $property->price ?? null;
 $priceLabel = is_numeric($amount) ? 'PKR '.number_format((float)$amount) : ($amount ?: 'Price on request');
@endphp
<article class="property-card">
 <a href="{{ route('properties.show', $property->id) }}" class="property-image">
  <img src="{{ $cover }}" alt="{{ $property->title ?? 'Property listing' }}" loading="lazy">
  @if(!empty($property->purpose))<span class="pill">{{ $property->purpose }}</span>@endif
 </a>
 <div class="property-content">
  <div class="property-type">{{ $property->type ?? 'Property' }} @if(!empty($property->status)) · {{ $property->status }} @endif</div>
  <h3><a href="{{ route('properties.show', $property->id) }}">{{ $property->title ?? 'Untitled property' }}</a></h3>
  <div class="property-location">{{ $property->address ?? $property->city ?? 'Pakistan' }}</div>
  <div class="property-price">{{ $priceLabel }}</div>
  <div class="property-meta">
   @if(!empty($property->bedrooms))<span><b>{{ $property->bedrooms }}</b> beds</span>@endif
   @if(!empty($property->bathrooms))<span><b>{{ $property->bathrooms }}</b> baths</span>@endif
   @if(!empty($property->area))<span><b>{{ $property->area }}</b> area</span>@endif
  </div>
 </div>
</article>