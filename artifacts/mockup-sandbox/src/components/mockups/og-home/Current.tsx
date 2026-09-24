import { useState, type CSSProperties } from "react";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, ChevronDown, Grid2x2,
  Home, Layers3, MapPin, Menu, Search, Sun, Wrench, Volume2,
} from "lucide-react";

const colors = {
  background: "#f8fafc", foreground: "#1c2024", card: "#ffffff",
  glassCard: "#fffffff2", glassBorder: "#e4e9ef", glassOverlay: "#ffffff80",
  primary: "#c7a263", action: "#102a43", actionDeep: "#081e34",
  actionForeground: "#ffffff", gold: "#d8b36a", surfaceRaised: "#ffffff",
  surfaceTint: "#f1f4f7", secondary: "#eef2f5", mutedForeground: "#72746f",
  accent: "#f1e6c9", accentForeground: "#6f531d", border: "#dfe5eb",
  selectionBackground: "#fbfcfd", selectionTint: "#f3f7fa",
  selectionBorder: "#102F49", selectionForeground: "#102F49",
};

const categories = [
  ["Houses", Home], ["Apartments", Layers3], ["Plots & Land", MapPin],
  ["Commercial", BriefcaseBusiness], ["Agriculture", Sun], ["Farmhouses", Home],
  ["Industrial", Wrench], ["Projects", Grid2x2],
] as const;
const tabs = ["Popular", "Location", "Size", "Budget", "Features"];
const cards = ["House", "Upper Portion", "Lower Portion", "Room", "Villa", "Low Price"];

const css = {
  page: { minHeight: "100vh", background: colors.background, color: colors.foreground, fontFamily: "Inter, sans-serif", overflow: "hidden" } as CSSProperties,
  header: { padding: "18px 18px 20px" } as CSSProperties,
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 } as CSSProperties,
  iconButton: { width: 42, height: 42, borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.card, display: "grid", placeItems: "center", color: colors.action } as CSSProperties,
  brand: { display: "flex", alignItems: "center", gap: 9 } as CSSProperties,
  logo: { width: 46, height: 46, objectFit: "contain" } as CSSProperties,
  brandTitle: { fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, letterSpacing: ".4px" } as CSSProperties,
  brandSub: { color: colors.primary, fontSize: 8, fontWeight: 500, letterSpacing: "2.3px", marginTop: 2 } as CSSProperties,
  switcher: { display: "inline-flex", position: "relative", borderRadius: 30, padding: 4, marginBottom: 15, border: `1px solid ${colors.border}`, background: colors.surfaceTint } as CSSProperties,
  switchPill: { position: "absolute", inset: "4px auto 4px 4px", width: 74, borderRadius: 26, background: colors.action } as CSSProperties,
  switchItem: { position: "relative", zIndex: 1, border: 0, background: "transparent", color: colors.actionForeground, borderRadius: 26, padding: "11px 24px", fontSize: 14, fontWeight: 600 } as CSSProperties,
  searchRow: { height: 58, display: "flex", alignItems: "center", gap: 9, padding: "0 10px", borderRadius: 22, border: `1px solid ${colors.border}`, background: colors.surfaceRaised, boxShadow: "0 5px 14px #17324714" } as CSSProperties,
  searchIcon: { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, background: `${colors.action}18`, color: colors.action } as CSSProperties,
  input: { flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: colors.foreground, fontSize: 13, fontFamily: "Inter, sans-serif" } as CSSProperties,
  location: { display: "flex", alignItems: "center", gap: 4, maxWidth: 128, border: `1px solid ${colors.border}`, borderRadius: 20, padding: "7px 10px", color: colors.action, background: colors.secondary, fontSize: 10, fontWeight: 600 } as CSSProperties,
};

function BrandMark() {
  return <div style={css.brand}>
    <img src="/__mockup/images/og-okara-home-hero.jpg" alt="" style={{ ...css.logo, borderRadius: 12, objectPosition: "center", objectFit: "cover" }} />
    <div><div style={css.brandTitle}>OG Landmark</div><div style={css.brandSub}>REAL ESTATE</div></div>
  </div>;
}

function Banner() {
  return <section style={{ position: "relative", height: 190, overflow: "hidden", marginTop: 4 }}>
    <img src="/__mockup/images/og-okara-home-hero.jpg" alt="Premium property in Okara" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#102a4300 16%,#081e34e8 100%)" }} />
    <div style={{ position: "absolute", left: 20, right: 88, bottom: 18 }}>
      <div style={{ color: colors.gold, fontSize: 8, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 4 }}>OKARA DISTRICT • PAKISTAN</div>
      <div style={{ color: "#fff", fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 20, lineHeight: "23px", marginBottom: 3 }}>Find Your Dream Property</div>
      <div style={{ color: "#ffffffcc", fontSize: 10, lineHeight: "14px" }}>Premium homes, plots &amp; commercial spaces across Okara &amp; surroundings</div>
    </div>
    <button style={{ position: "absolute", right: 18, bottom: 18, minHeight: 32, border: 0, borderRadius: 11, padding: "0 10px", display: "flex", alignItems: "center", gap: 4, background: colors.gold, color: colors.actionDeep, fontSize: 10, fontWeight: 700 }}>
      Explore Now <ArrowUpRight size={13} />
    </button>
    <button aria-label="Toggle sound" style={{ position: "absolute", top: 10, right: 12, border: 0, borderRadius: 16, padding: 7, color: "#fff", background: "#00000073" }}><Volume2 size={14} /></button>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: -24, display: "flex", justifyContent: "center", gap: 6 }}>
      <i style={{ width: 20, height: 6, borderRadius: 3, background: colors.gold }} /><i style={{ width: 6, height: 6, borderRadius: 3, background: "#c8a45a55" }} />
    </div>
  </section>;
}

function Browse() {
  const [activeCategory, setActiveCategory] = useState("Houses");
  const [activeTab, setActiveTab] = useState("Popular");
  return <section style={{ margin: "12px 16px", borderRadius: 20, border: `1px solid ${colors.glassBorder}`, background: colors.glassCard, padding: "20px 0 18px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 18px", marginBottom: 16 }}>
      <div><div style={{ color: colors.primary, fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", marginBottom: 4 }}>EXPLORE THE MARKET</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 2 }}>Find Your Property</div>
        <div style={{ color: colors.mutedForeground, fontSize: 12 }}>Verified properties by type, location &amp; budget</div></div>
      <button style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, padding: "7px 12px", borderRadius: 20, border: `1px solid ${colors.border}`, background: "transparent", fontSize: 12.5 }}>View All <ArrowRight size={13} /></button>
    </div>
    <div style={{ display: "flex", gap: 8, overflow: "hidden", padding: "0 14px 14px" }}>
      {categories.map(([label, Icon]) => { const selected = activeCategory === label; return <button key={label} onClick={() => setActiveCategory(label)} style={{ flex: "0 0 86px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "10px", borderRadius: 18, border: `${selected ? 2 : 1}px solid ${selected ? colors.selectionBorder : colors.glassBorder}`, background: selected ? colors.selectionBackground : colors.glassOverlay, color: selected ? colors.selectionForeground : colors.foreground }}>
        <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 19, border: `1px solid ${selected ? colors.selectionBorder : colors.glassBorder}`, background: selected ? colors.selectionTint : colors.glassOverlay }}><Icon size={17} /></span><span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, whiteSpace: "nowrap" }}>{label}</span>
      </button>; })}
    </div>
    <div style={{ padding: "0 18px", marginBottom: 12 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 12, border: `1px solid ${colors.primary}44`, background: colors.accent, color: colors.accentForeground, fontSize: 11.5, fontWeight: 500 }}>{activeCategory === "Houses" ? "24 houses" : "12 properties"} in Okara District</span></div>
    <div style={{ display: "flex", gap: 4, overflow: "hidden", padding: "0 14px", marginBottom: 14 }}>
      {tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 14px", borderRadius: 20, border: activeTab === tab ? `1.5px solid ${colors.selectionBorder}` : 0, background: activeTab === tab ? colors.selectionBackground : "transparent", color: activeTab === tab ? colors.selectionForeground : colors.mutedForeground, fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400 }}>{tab}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0 16px" }}>
      {cards.map((label, i) => <button key={label} style={{ display: "flex", alignItems: "center", minHeight: 84, padding: "12px 8px", border: 0, background: "transparent", textAlign: "left" }}>
        <span style={{ width: 42, height: 42, flex: "0 0 42px", display: "grid", placeItems: "center", marginRight: 10, borderRadius: 21, border: `1px solid ${colors.glassBorder}`, background: i === 0 ? colors.accent : colors.glassOverlay, color: colors.action }}><Home size={17} /></span>
        <span><strong style={{ display: "block", fontSize: 13, lineHeight: "17px" }}>{label}</strong><small style={{ display: "block", marginTop: 2, color: colors.mutedForeground, fontSize: 11 }}>Curated search</small></span>
      </button>)}
    </div>
  </section>;
}

export function Current() {
  const [transaction, setTransaction] = useState<"Buy" | "Rent">("Buy");
  const [query, setQuery] = useState("");
  return <main style={css.page}>
    <header style={css.header}>
      <div style={css.topBar}><button aria-label="Open navigation menu" style={css.iconButton}><Menu size={21} /></button><BrandMark /><button aria-label="Notifications" style={{ ...css.iconButton, visibility: "hidden" }}><Menu size={18} /></button></div>
      <div style={css.switcher}><span style={{ ...css.switchPill, left: transaction === "Rent" ? 82 : 4 }} />{(["Buy", "Rent"] as const).map(item => <button key={item} onClick={() => { setTransaction(item); setQuery(""); }} style={css.switchItem}>{item}</button>)}</div>
      <div style={css.searchRow}><button aria-label={`Search ${transaction} properties`} style={{ border: 0, background: "transparent", padding: 0 }}><span style={css.searchIcon}><Search size={16} /></span></button><input value={query} onChange={e => setQuery(e.target.value)} placeholder={transaction === "Buy" ? "Search homes, plots or projects" : "Search rentals in Okara District"} style={css.input} /><button style={css.location}><MapPin size={11} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Okara District</span><ChevronDown size={11} /></button></div>
    </header>
    <Banner />
    <Browse />
    <div style={{ padding: "18px", color: colors.mutedForeground, fontSize: 9, letterSpacing: "1.5px" }}>FEATURED PROPERTIES</div>
  </main>;
}