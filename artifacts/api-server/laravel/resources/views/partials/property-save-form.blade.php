@if($buyerSignedIn ?? false)
 @php($isSaved = in_array((string) ($property->id ?? ''), $savedPropertyIds ?? [], true))
 <form method="POST" action="{{ $isSaved ? route('property.saved.destroy', $property->id) : route('property.saved.store', $property->id) }}" class="property-save-form" style="margin-top:14px">
  @csrf
  @if($isSaved) @method('DELETE') @endif
  <button type="submit" class="btn btn-light property-save-button" style="width:100%" aria-pressed="{{ $isSaved ? 'true' : 'false' }}">
   {{ $isSaved ? 'Remove from saved homes' : 'Save this home' }}
  </button>
 </form>
@endif