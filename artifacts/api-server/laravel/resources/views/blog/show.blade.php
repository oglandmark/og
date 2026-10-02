@extends('layouts.landmark')
@section('title',($article->title ?? 'Journal article').' — OG Landmark')
@section('content')
@php($cover=$article->coverImage ?? null)
<section class="page-hero"><div class="wrap"><div class="breadcrumb"><a href="{{ route('blog.index') }}">Journal</a> / OG Landmark</div><h1>{{ $article->title ?? 'A note from the property market' }}</h1><p>{{ isset($article->createdAt) ? \Illuminate\Support\Carbon::parse($article->createdAt)->format('F j, Y') : 'OG Landmark Journal' }}</p></div></section>
<article class="section"><div class="wrap" style="max-width:850px">
 @if($cover)<img style="width:100%;height:min(52vw,480px);object-fit:cover;margin-bottom:32px" src="{{ str_starts_with($cover,'http') || str_starts_with($cover,'/') ? $cover : asset('storage/'.$cover) }}" alt="{{ $article->title ?? 'Journal article' }}">@endif
 <p class="eyebrow">OG Landmark Journal</p><div style="font:600 clamp(1.4rem,2vw,1.8rem)/1.55 var(--serif);color:var(--navy);margin:20px 0">{{ $article->excerpt ?? '' }}</div>
 <div style="max-width:730px;color:#5e6e80;line-height:1.9;white-space:pre-line">{{ $article->content ?? $article->body ?? $article->excerpt ?? 'This story is being prepared. Please check back soon for the full article.' }}</div>
 <div style="border-top:1px solid var(--line);margin-top:40px;padding-top:22px"><a class="text-link" href="{{ route('blog.index') }}">← Back to the journal</a></div>
</div></article>
@endsection