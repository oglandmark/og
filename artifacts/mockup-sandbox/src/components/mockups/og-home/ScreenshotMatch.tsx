import { useState } from "react";
import {
  Bell,
  Building2,
  House,
  LandPlot,
  MapPin,
  Search,
  SlidersHorizontal,
  Sprout,
  Wheat,
  Wifi,
  ArrowRight,
} from "lucide-react";

const ink = "#102d3a";
const gold = "#d6b363";

const categories = [
  { title: "Houses", icon: House },
  { title: "Plots", icon: LandPlot },
  { title: "Commercial", icon: Building2 },
  { title: "Commercial", icon: Sprout },
  { title: "Agriculture", icon: Wheat },
];

export function ScreenshotMatch() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [unread, setUnread] = useState(true);

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 430,
        height: "100dvh",
        minHeight: 640,
        margin: "0 auto",
        overflowY: "auto",
        overflowX: "hidden",
        background: "#f3f3f0",
        color: "#142027",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      <header style={{ background: "#102f40", color: "#fff" }}>
        <div
          style={{
            height: 42,
            padding: "9px 21px 0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            boxSizing: "border-box",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".02em",
          }}
        >
          <span style={{ lineHeight: "16px" }}>9:41</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: 0.94 }}>
            <span style={{ fontSize: 9, letterSpacing: "-1px" }}>▮▮▮</span>
            <Wifi size={13} strokeWidth={2.1} />
            <span
              style={{
                width: 16,
                height: 8,
                border: "1px solid rgba(255,255,255,.9)",
                borderRadius: 2,
                display: "inline-flex",
                alignItems: "center",
                padding: 1,
                boxSizing: "border-box",
                position: "relative",
              }}
            >
              <span style={{ width: 10, height: 4, background: "#fff", borderRadius: 1 }} />
              <span
                style={{
                  position: "absolute",
                  right: -3,
                  width: 2,
                  height: 4,
                  borderRadius: "0 2px 2px 0",
                  background: "rgba(255,255,255,.9)",
                }}
              />
            </span>
          </div>
        </div>
        <div
          style={{
            height: 49,
            padding: "0 20px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500 }}>
            <MapPin size={16} fill="#fff" strokeWidth={1.7} />
            <span>Okara, Punjab</span>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setUnread(false)}
            style={{
              border: 0,
              background: "transparent",
              color: "#fff",
              width: 28,
              height: 28,
              padding: 3,
              position: "relative",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <Bell size={18} strokeWidth={1.7} />
            {unread && (
              <span
                style={{
                  position: "absolute",
                  right: 2,
                  top: 2,
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: gold,
                  boxShadow: "0 0 0 1px #102f40",
                }}
              />
            )}
          </button>
        </div>
      </header>

      <section
        aria-label="Find your perfect property"
        style={{
          height: 111,
          position: "relative",
          overflow: "hidden",
          background: "#183d4a",
          color: "#fff",
        }}
      >
        <img
          src="/__mockup/images/og-okara-home-hero.jpg"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 43%",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(7,34,45,.83) 0%, rgba(7,34,45,.55) 53%, rgba(7,34,45,.12) 100%), linear-gradient(0deg, rgba(5,31,42,.54), transparent 70%)",
          }}
        />
        <div style={{ position: "relative", padding: "10px 21px 0" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 25,
              lineHeight: "29px",
              letterSpacing: "-.65px",
              fontWeight: 650,
              textShadow: "0 1px 5px rgba(0,0,0,.22)",
            }}
          >
            Find Your
            <br />
            Perfect Property
          </h1>
          <div
            style={{
              marginTop: 7,
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              fontSize: 11,
              fontWeight: 450,
              letterSpacing: ".005em",
            }}
          >
            {["Homes", "Plots", "Commercial", "Agriculture"].map((item, index) => (
              <span key={item} style={{ display: "inline-flex", alignItems: "center" }}>
                {index > 0 && <span style={{ margin: "0 9px", opacity: 0.7 }}>|</span>}
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "0 18px",
          height: 53,
          display: "flex",
          alignItems: "center",
          background: "#f3f3f0",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            height: 41,
            width: "100%",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 7px rgba(14,36,44,.11)",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            boxSizing: "border-box",
          }}
        >
          <Search size={17} color="#151f25" strokeWidth={2} style={{ flexShrink: 0, marginRight: 11 }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by location, property type..."
            aria-label="Search by location or property type"
            style={{
              minWidth: 0,
              flex: 1,
              border: 0,
              outline: 0,
              padding: 0,
              background: "transparent",
              color: "#28343a",
              font: "400 11px Inter, ui-sans-serif, system-ui, sans-serif",
            }}
          />
          <button
            type="button"
            aria-label="Open search filters"
            onClick={() => setFiltersOpen((open) => !open)}
            style={{
              border: 0,
              color: "#17252b",
              background: "transparent",
              width: 24,
              height: 28,
              padding: 2,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={15} strokeWidth={1.8} />
          </button>
        </div>
        {filtersOpen && (
          <div
            style={{
              position: "absolute",
              top: 47,
              right: 18,
              zIndex: 5,
              width: 178,
              padding: "12px 13px",
              borderRadius: 10,
              background: "#fff",
              boxShadow: "0 8px 24px rgba(15,40,52,.18)",
              fontSize: 11,
              color: ink,
            }}
          >
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Search preferences</div>
            <div style={{ color: "#737b7c", lineHeight: 1.6 }}>Buy or rent · Any price · Okara</div>
          </div>
        )}
      </section>

      <section
        aria-label="Browse property categories"
        style={{
          padding: "3px 18px 13px",
          background: "#f3f3f0",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {categories.slice(0, 3).map(({ title, icon: Icon }, index) => (
            <button
              type="button"
              key={`${title}-${index}`}
              onClick={() => setActiveCategory(activeCategory === `${title}-${index}` ? null : `${title}-${index}`)}
              style={{
                height: 73,
                padding: "8px 4px 6px",
                border: activeCategory === `${title}-${index}` ? `1px solid ${gold}` : "1px solid rgba(17,43,54,.04)",
                borderRadius: 10,
                background: "#fff",
                color: "#141c20",
                boxShadow: "0 2px 6px rgba(28,38,37,.09)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              <Icon size={27} strokeWidth={2.25} />
              <span style={{ fontSize: 11, lineHeight: "14px", fontWeight: 500 }}>{title}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
          {categories.slice(3).map(({ title, icon: Icon }, index) => (
            <button
              type="button"
              key={`${title}-${index + 3}`}
              onClick={() => setActiveCategory(activeCategory === `${title}-${index + 3}` ? null : `${title}-${index + 3}`)}
              style={{
                height: 68,
                padding: "6px 4px",
                border: activeCategory === `${title}-${index + 3}` ? `1px solid ${gold}` : "1px solid rgba(17,43,54,.04)",
                borderRadius: 10,
                background: "#fff",
                color: "#141c20",
                boxShadow: "0 2px 6px rgba(28,38,37,.09)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                cursor: "pointer",
              }}
            >
              <Icon size={24} strokeWidth={2.2} />
              <span style={{ fontSize: 11, lineHeight: "14px", fontWeight: 500 }}>{title}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 18px 18px", background: "#f3f3f0" }}>
        <div
          style={{
            position: "relative",
            height: 112,
            overflow: "hidden",
            borderRadius: 12,
            background: "#174a37",
            color: "#fff",
            boxShadow: "0 3px 8px rgba(20,51,42,.12)",
          }}
        >
          <img
            src="/__mockup/images/agri-field-1.jpg"
            alt=""
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "72%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 62%",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(10,65,46,.97) 0%, rgba(14,74,50,.91) 40%, rgba(14,74,50,.48) 67%, rgba(14,74,50,.05) 100%)",
            }}
          />
          <div style={{ position: "relative", padding: "15px 13px" }}>
            <div style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, letterSpacing: "-.2px" }}>
              Invest in
              <br />
              Agriculture Land
            </div>
            <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: "15px", fontWeight: 400 }}>
              A Secure Future
              <br />
              for Generations
            </div>
          </div>
          <button
            type="button"
            aria-label="Explore agriculture land"
            style={{
              position: "absolute",
              left: "50%",
              bottom: 10,
              width: 25,
              height: 25,
              borderRadius: "50%",
              border: "none",
              background: "#e6c66f",
              color: "#20392f",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,.16)",
            }}
          >
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </section>
    </main>
  );
}

export default ScreenshotMatch;