@php
 $roleName=ucfirst((string)($portalRole ?? 'buyer'));
 $pageName=(string)($portalPage ?? 'dashboard');
 $pageTitle=$portalTitle ?? collect($navigation ?? [])->first(function($item,$key) use($pageName){$target=is_array($item)?($item['page']??$item['key']??$key):(is_object($item)?($item->page??$item->key??$key):$key);return (string)$target===$pageName;});
 $pageTitle=is_string($pageTitle)?$pageTitle:(is_array($pageTitle)?($pageTitle['label']??$pageName):(is_object($pageTitle)?($pageTitle->label??$pageName):ucfirst(str_replace(['-','_'],' ',$pageName))));
 $navItems=$navigation ?? [];
 $userName=is_object($portalUser ?? null)?($portalUser->name ?? 'Account holder'):(is_array($portalUser ?? null)?($portalUser['name'] ?? 'Account holder'):'Account holder');
 $userEmail=is_object($portalUser ?? null)?($portalUser->email ?? ''):(is_array($portalUser ?? null)?($portalUser['email'] ?? ''):'');
 $stats=$portalStats ?? [];
 $rows=$portalRows ?? [];
@endphp
 <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ $pageTitle }} — OG Landmark {{ $roleName }} portal</title><link rel="stylesheet" href="{{ asset('css/landmark.css') }}"><link rel="stylesheet" href="{{ asset('css/portal.css') }}"></head><body>
<div class="portal">
 <aside class="portal-side"><a class="brand" href="{{ route('home') }}"><span class="brand-mark"><img src="{{ asset('og-landmark-logo-white.png') }}" alt=""></span><span class="brand-copy">OG LANDMARK<small>{{ $roleName }} PORTAL</small></span></a>
  <div class="portal-user"><span class="avatar">{{ strtoupper(substr($userName,0,1)) }}</span><span><strong>{{ $userName }}</strong><small>{{ $userEmail ?: $roleName.' account' }}</small></span></div>
  <nav class="portal-nav" aria-label="{{ $roleName }} portal navigation">
   @foreach($navItems as $key=>$item)
    @php
      $label=is_array($item)?($item['label']??$item['title']??$key):(is_object($item)?($item->label??$item->title??$key):$item);
      $target=is_array($item)?($item['page']??$item['key']??$key):(is_object($item)?($item->page??$item->key??$key):$key);
      if(!is_string($target)) $target=$key;
    @endphp
    <a class="{{ $pageName===$target ? 'active' : '' }}" href="{{ route('portal.page',['role'=>$portalRole,'page'=>$target]) }}">{{ $label }}</a>
   @endforeach
  </nav>
   <div style="margin-top:auto;padding:20px 8px 0"><a href="{{ route('home') }}" style="font-size:11px;color:#aebdcc">← Return to OG Landmark</a><form method="POST" action="{{ route('auth.logout') }}" style="margin-top:12px">@csrf<button type="submit" style="background:none;border:0;padding:0;color:#aebdcc;font:inherit;font-size:11px;cursor:pointer">Sign out</button></form></div>
 </aside>
 <main class="portal-main"><header class="portal-top"><div style="display:flex;align-items:center;gap:12px"><button class="portal-toggle" aria-label="Open portal navigation">≡</button><h1>{{ $pageTitle }}</h1></div><span class="eyebrow">{{ $roleName }} space</span></header>
 <div class="portal-content">
   @if($portalRole==='buyer' && session('success'))<div class="flash-success" role="status">{{ session('success') }}</div>@endif
   @if($portalRole==='buyer' && $errors->any())<div class="form-errors" role="alert">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
  <section class="portal-welcome"><span class="eyebrow" style="color:var(--gold2)">OG Landmark · {{ $roleName }} portal</span><h2>{{ $pageName==='dashboard' ? 'Welcome, '.$userName : $pageTitle }}</h2><p style="margin:0;color:#c2ccd7;font-size:13px">{{ $pageName==='dashboard' ? 'Your property journey, gathered in one place.' : 'Your account information and updates.' }}</p></section>
  @if(count($stats))<div class="stat-grid">@foreach($stats as $label=>$value)@php($statLabel=is_array($value)?($value['label']??$label):(is_object($value)?($value->label??$label):$label))@php($statValue=is_array($value)?($value['value']??'—'):(is_object($value)?($value->value??'—'):$value))<div class="stat-card"><small>{{ $statLabel }}</small><strong>{{ is_scalar($statValue) ? $statValue : '—' }}</strong></div>@endforeach</div>@endif
   <section class="portal-box"><h3>{{ $pageName==='dashboard' ? 'Recent activity' : $pageTitle }}</h3>
    @if($portalRole==='buyer' && $pageName==='saved-homes' && count($rows))
      <div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Property</th><th>Location</th><th>Price</th><th>Saved</th><th>Action</th></tr></thead><tbody>
       @foreach($rows as $row)<tr>
        <td>@if(!empty($row->id))<a href="{{ route('properties.show',$row->id) }}">{{ $row->title ?? 'View property' }}</a>@else{{ $row->title ?? 'Property unavailable' }}@endif</td>
        <td>{{ $row->address ?? $row->city ?? '—' }}</td>
        <td>{{ is_numeric($row->price ?? null) ? 'PKR '.number_format((float)$row->price) : ($row->price ?? 'Price on request') }}</td>
        <td>{{ !empty($row->savedAt) ? $row->savedAt : '—' }}</td>
        <td>@php($savedId=$row->id ?? $row->propertyId ?? null)@if($savedId)<form method="POST" action="{{ route('property.saved.destroy',$savedId) }}">@csrf @method('DELETE')<button type="submit">Remove</button></form>@else—@endif</td>
       </tr>@endforeach
      </tbody></table></div>
    @elseif($portalRole==='buyer' && $pageName==='inquiries' && count($rows))
      <div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Property</th><th>Your message</th><th>Submitted</th><th>Status</th></tr></thead><tbody>
       @foreach($rows as $row)<tr>
        <td>@if(!empty($row->propertyId))<a href="{{ route('properties.show',$row->propertyId) }}">{{ $row->propertyTitle ?? 'View property' }}</a>@else{{ $row->propertyTitle ?? 'General enquiry' }}@endif</td>
        <td>{{ $row->message ?? $row->text ?? '—' }}</td>
        <td>{{ !empty($row->createdAt) ? $row->createdAt : '—' }}</td>
        <td>{{ $row->status ?? 'Received' }}</td>
       </tr>@endforeach
      </tbody></table></div>
     @elseif($portalRole==='seller' && $pageName==='add-property')
     @if($errors->any())<div class="form-errors" role="alert">@foreach($errors->all() as $error)<div>{{ $error }}</div>@endforeach</div>@endif
     <form method="POST" action="{{ route('portal.property.store') }}" class="portal-property-form">@csrf
      <div class="form-grid">
       <div class="field full"><label for="listing-title">Property title</label><input id="listing-title" name="title" value="{{ old('title') }}" required maxlength="180"></div>
       <div class="field"><label for="listing-type">Property type</label><select id="listing-type" name="type" required><option value="">Choose a type</option>@foreach(['House','Apartment','Plot','Commercial'] as $type)<option value="{{ $type }}" @selected(old('type')===$type)>{{ $type }}</option>@endforeach</select></div>
       <div class="field"><label for="listing-purpose">For</label><select id="listing-purpose" name="purpose" required><option value="For Sale" @selected(old('purpose')==='For Sale')>Sale</option><option value="For Rent" @selected(old('purpose')==='For Rent')>Rent</option></select></div>
       <div class="field"><label for="listing-city">City</label><input id="listing-city" name="city" value="{{ old('city') }}" required maxlength="120"></div>
       <div class="field"><label for="listing-address">Address or neighbourhood</label><input id="listing-address" name="address" value="{{ old('address') }}" maxlength="240"></div>
       <div class="field"><label for="listing-price">Price (PKR)</label><input id="listing-price" name="price" type="number" min="0" step="1" value="{{ old('price') }}"></div>
       <div class="field"><label for="listing-area">Area and unit</label><input id="listing-area" name="area" value="{{ old('area') }}" placeholder="e.g. 10 marla"></div>
       <div class="field"><label for="listing-bedrooms">Bedrooms</label><input id="listing-bedrooms" name="bedrooms" type="number" min="0" max="50" value="{{ old('bedrooms') }}"></div>
       <div class="field"><label for="listing-bathrooms">Bathrooms</label><input id="listing-bathrooms" name="bathrooms" type="number" min="0" max="50" value="{{ old('bathrooms') }}"></div>
       <div class="field full"><label for="listing-images">Image links (optional, one per line)</label><textarea id="listing-images" name="image_urls" rows="3" maxlength="4000">{{ old('image_urls') }}</textarea></div>
       <div class="field full"><label for="listing-description">Description</label><textarea id="listing-description" name="description" rows="5" maxlength="5000">{{ old('description') }}</textarea></div>
       <div class="full"><button type="submit" class="btn btn-gold">Submit for review <span>↗</span></button></div>
      </div>
     </form>
    @elseif($portalRole==='admin' && $pageName==='properties' && count($rows))
     @php($firstRow=(array)reset($rows))
     <div class="portal-table-wrap"><table class="portal-table"><thead><tr>@foreach(array_keys($firstRow) as $column)<th>{{ ucfirst(str_replace(['_','-'],' ',$column)) }}</th>@endforeach<th>Review</th></tr></thead><tbody>
      @foreach($rows as $row)@php($row=(array)$row)<tr>@foreach(array_keys($firstRow) as $column)<td>{{ is_scalar($row[$column] ?? null) ? ($row[$column] ?? '—') : '—' }}</td>@endforeach<td><div class="portal-row-actions">
       <form method="POST" action="{{ route('portal.property.moderate',['id'=>$row['id'] ?? '','action'=>'approve']) }}">@csrf<button type="submit">Approve</button></form>
       <form method="POST" action="{{ route('portal.property.moderate',['id'=>$row['id'] ?? '','action'=>'request-changes']) }}">@csrf<input type="hidden" name="reason" value="Please update the listing details."><button type="submit">Request changes</button></form>
      </div></td></tr>@endforeach
     </tbody></table></div>
    @elseif(count($rows))
     @if(is_array(reset($rows)) || is_object(reset($rows)))
      @php($firstRow=(array)reset($rows))
      <div class="portal-table-wrap"><table class="portal-table"><thead><tr>@foreach(array_keys($firstRow) as $column)<th>{{ ucfirst(str_replace(['_','-'],' ',$column)) }}</th>@endforeach</tr></thead><tbody>@foreach($rows as $row)@php($row=(array)$row)<tr>@foreach(array_keys($firstRow) as $column)<td>{{ is_scalar($row[$column] ?? null) ? ($row[$column] ?? '—') : '—' }}</td>@endforeach</tr>@endforeach</tbody></table></div>
     @else<div class="portal-empty">{{ is_scalar(reset($rows)) ? reset($rows) : 'Account records are available.' }}</div>@endif
    @else<div class="portal-empty"><span class="eyebrow">Nothing here yet</span><p style="margin:8px 0 0">There are no {{ strtolower($pageTitle) }} to display right now. When information is available, it will appear here.</p>@if($roleName==='Buyer')<p><a class="text-link" href="{{ route('properties.index') }}">Browse properties ↗</a></p>@endif</div>@endif
   </section>
 </div></main>
</div><script src="{{ asset('js/landmark.js') }}" defer></script></body></html>