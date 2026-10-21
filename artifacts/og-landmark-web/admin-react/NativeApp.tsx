import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { adminApi, type AdminStats, type AdminUser, type Announcement, type AnyRecord } from "./api";

type PageKey = "overview" | "properties" | "users" | "agents" | "projects" | "inquiries" | "reports" | "settings";
type RouteInfo = { key: PageKey | "login"; path: string; label: string; title: string; description: string };
type ResourceState<T> = { data: T; loading: boolean; error: string; reload: () => void };

const C = {
  forest: "#0F3D2E", deep: "#092C22", green: "#4CAF50", moss: "#E7F0E8",
  canvas: "#F4F5EF", paper: "#FFFEFA", ink: "#202D29", muted: "#78847E",
  line: "#E3E8E1", gold: "#BA9352", danger: "#AA493B", white: "#FFFFFF",
  soft: "#EDF4ED", tint: "#F8F3E9",
};
const routes: RouteInfo[] = [
  { key: "overview", path: "/admin/", label: "Overview", title: "Platform overview", description: "A live view of the OG Landmark marketplace." },
  { key: "properties", path: "/admin/properties", label: "Property inventory", title: "Property inventory", description: "Review, update and moderate submitted listings." },
  { key: "users", path: "/admin/users", label: "Users", title: "User directory", description: "Browse registered platform accounts." },
  { key: "agents", path: "/admin/agents", label: "Agents", title: "Agent network", description: "Review agent profiles available through the current API." },
  { key: "projects", path: "/admin/projects", label: "Projects", title: "Developer projects", description: "Browse project records from the existing service." },
  { key: "inquiries", path: "/admin/inquiries", label: "Inquiries", title: "Inquiries", description: "Review submitted inquiries and lead records." },
  { key: "reports", path: "/admin/reports", label: "Reports", title: "Reports & review queue", description: "Pending reports returned by the admin service." },
  { key: "settings", path: "/admin/settings", label: "Settings & announcements", title: "Settings & announcements", description: "Publish a platform announcement using the supported endpoint." },
  { key: "login", path: "/admin/login", label: "Sign in", title: "Admin sign in", description: "Authorized access to OG Landmark administration." },
];
const groups: { title: string; keys: PageKey[] }[] = [
  { title: "Workspace", keys: ["overview", "properties", "users", "agents", "projects"] },
  { title: "Operations", keys: ["inquiries", "reports", "settings"] },
];
const labels: Record<string, string> = {
  id: "ID", name: "Name", title: "Title", email: "Email", phone: "Phone", role: "Role",
  status: "Status", approvalStatus: "Review status", listingStatus: "Listing status", city: "City",
  location: "Location", price: "Price", type: "Type", purpose: "Purpose",
  createdAt: "Created", created_at: "Created", joinedDate: "Registered", developer: "Developer",
  projectName: "Project", propertyTitle: "Property", message: "Message", subject: "Subject",
};

function routeFor(path: string): RouteInfo {
  const normalized = path.endsWith("/") && path !== "/admin/" ? path.slice(0, -1) : path;
  return routes.find((route) => route.path === normalized || (normalized === "/admin" && route.key === "overview")) || routes[0];
}
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "OG"; }
function humanize(key: string) { return labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function valueText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "—";
  return String(value);
}
function recordTitle(record: AnyRecord) { return String(record.title || record.name || record.propertyTitle || record.projectName || record.subject || record.id || "Untitled record"); }
function recordStatus(record: AnyRecord) { return String(record.approvalStatus || record.listingStatus || record.status || "Not provided"); }
function tone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("pending") || value.includes("review") || value.includes("change")) return { backgroundColor: "#F8F0DF", color: "#906D31" };
  if (value.includes("reject") || value.includes("block") || value.includes("suspend")) return { backgroundColor: "#F7E9E5", color: "#A14F43" };
  if (value.includes("active") || value.includes("approved") || value.includes("verified") || value.includes("publish")) return { backgroundColor: "#E8F2E7", color: "#397849" };
  return { backgroundColor: "#EEF2EC", color: "#526258" };
}
function statLabel(key: string) { return humanize(key); }

function App() {
  const [path, setPath] = useState(Platform.OS === "web" ? window.location.pathname : "/admin/");
  const [user, setUser] = useState<AdminUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("og_user") || "null") as AdminUser | null; } catch { return null; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { width } = useWindowDimensions();
  const compact = width < 780;
  const route = useMemo(() => routeFor(path), [path]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!user && route.key !== "login") navigate("/admin/login");
    if (user && route.key === "login") navigate("/admin/");
  }, [route.key, user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const navigate = (target: string) => {
    if (Platform.OS === "web") {
      window.history.pushState({}, "", target);
      setPath(window.location.pathname);
    } else setPath(target);
    setMenuOpen(false);
  };
  const notify = (message: string, error = false) => setToast({ message, error });
  const signOut = () => {
    localStorage.removeItem("og_token");
    localStorage.removeItem("og_user");
    setUser(null);
    navigate("/admin/login");
  };

  if (!user || route.key === "login") return <Login onLogin={(nextUser) => { setUser(nextUser); navigate("/admin/"); }} notify={notify} />;
  const headingRoute = route;

  return <View style={s.root}>
    {(!compact || menuOpen) && <Sidebar user={user} active={route.key} compact={compact} onNavigate={navigate} onSignOut={signOut} onClose={() => setMenuOpen(false)} />}
    {compact && menuOpen && <Pressable accessibilityLabel="Close navigation" style={s.scrim} onPress={() => setMenuOpen(false)} />}
    <View style={[s.main, !compact && { marginLeft: 254 }]}>
      <View style={s.topbar}>
        <View style={s.topbarLeft}>
          {compact && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={() => setMenuOpen(true)} style={s.menuButton}><Text style={s.menuGlyph}>Menu</Text></Pressable>}
          <Text style={s.crumb}>OG Landmark  /  <Text style={{ color: C.forest, fontWeight: "700" }}>{route.label}</Text></Text>
        </View>
        <View style={s.topRight}><View style={s.onlineDot} /><Text style={s.smallMuted}>Connected session</Text><Avatar name={user.name || "Admin"} /></View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, compact && { paddingHorizontal: 16, paddingTop: 24 }]} keyboardShouldPersistTaps="handled">
        <PageContent route={headingRoute} refresh={refresh} navigate={navigate} notify={notify} onRefresh={() => setRefresh((value) => value + 1)} setDialog={setDialog} />
      </ScrollView>
    </View>
    {toast && <View accessibilityRole="alert" style={[s.toast, toast.error && { backgroundColor: C.danger }]}><Text style={s.toastText}>{toast.message}</Text></View>}
    {dialog && <AdminDialog state={dialog} onClose={() => setDialog(null)} notify={notify} refresh={() => setRefresh((value) => value + 1)} />}
  </View>;
}

function Sidebar({ user, active, compact, onNavigate, onSignOut, onClose }: { user: AdminUser; active: PageKey; compact: boolean; onNavigate: (path: string) => void; onSignOut: () => void; onClose: () => void }) {
  return <View style={[s.sidebar, compact && s.mobileSidebar]}>
    <View style={s.brand}>
      <Image source={{ uri: "/images/og-logo.png" }} style={s.logo} resizeMode="contain" />
      <View><Text style={s.brandName}>OG Landmark</Text><Text style={s.brandSub}>ADMINISTRATION</Text></View>
      {compact && <Pressable onPress={onClose} style={s.closeNav}><Text style={{ color: "#D6E2D9" }}>×</Text></Pressable>}
    </View>
    <ScrollView style={s.navScroll}>
      {groups.map((group) => <View key={group.title} style={{ marginBottom: 18 }}>
        <Text style={s.navCaption}>{group.title}</Text>
        {group.keys.map((key) => {
          const item = routes.find((candidate) => candidate.key === key)!;
          return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active === key }} onPress={() => onNavigate(item.path)} style={[s.navItem, active === key && s.navActive]}>
            <Text style={[s.navMark, active === key && { color: "#D4E6BD" }]}>{navMark(key)}</Text>
            <Text style={[s.navText, active === key && { color: C.white }]}>{item.label}</Text>
          </Pressable>;
        })}
      </View>)}
    </ScrollView>
    <View style={s.sidebarFoot}><View style={s.userLine}><Avatar name={user.name || "Admin"} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={s.userName}>{user.name || "Administrator"}</Text><Text numberOfLines={1} style={s.userEmail}>{user.email || user.role || "Authorized account"}</Text></View></View><Pressable onPress={onSignOut} accessibilityRole="button" style={s.signOut}><Text style={s.signOutText}>Sign out</Text></Pressable></View>
  </View>;
}
function navMark(key: string) { return ({ overview: "OV", properties: "PR", users: "US", agents: "AG", projects: "PJ", inquiries: "IN", reports: "RP", settings: "ST" } as Record<string, string>)[key] || "OG"; }
function Avatar({ name }: { name: string }) { return <View style={s.avatar}><Text style={s.avatarText}>{initials(name)}</Text></View>; }

function Login({ onLogin, notify }: { onLogin: (user: AdminUser) => void; notify: (message: string, error?: boolean) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (step === "credentials") {
        const result = await adminApi.login(identifier.trim(), password);
        if (result.token && result.user) {
          localStorage.setItem("og_token", result.token);
          localStorage.setItem("og_user", JSON.stringify(result.user));
          onLogin(result.user);
        } else if (result.success) {
          setStep("otp");
          setMessage(result.message || "A verification code has been sent to your admin email.");
          notify(result.message || "A verification code has been sent to your admin email.");
        } else {
          throw new Error("The sign-in response was incomplete.");
        }
      } else {
        const result = await adminApi.verifyAdminOtp(identifier.trim(), otp.trim());
        if (!result.token || !result.user) throw new Error("The verification response was incomplete.");
        localStorage.setItem("og_token", result.token);
        localStorage.setItem("og_user", JSON.stringify(result.user));
        onLogin(result.user);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to sign in.";
      setError(message); notify(message, true);
    } finally { setBusy(false); }
  };
  return <View style={s.loginRoot}>
    {!compact && <View style={s.loginPanel}>
      <View style={s.loginBrand}><Image source={{ uri: "/images/og-logo.png" }} style={s.loginLogo} resizeMode="contain" /><View><Text style={s.brandName}>OG Landmark</Text><Text style={s.brandSub}>ADMINISTRATION</Text></View></View>
      <View style={s.loginCopy}><Text style={s.loginEyebrow}>THE PROPERTY PLATFORM FOR PAKISTAN</Text><Text style={s.loginHeadline}>A clearer view{"\n"}of <Text style={s.loginItalic}>every move.</Text></Text><Text style={s.loginDescription}>One place to oversee listings, people and projects across the OG Landmark network.</Text></View>
      <Text style={s.loginFooter}>Authorized administrators only · OG Landmark</Text>
    </View>}
    <ScrollView contentContainerStyle={s.loginFormSide} keyboardShouldPersistTaps="handled">
      <View style={s.loginForm}>
        {compact && <View style={[s.loginBrand, { marginBottom: 28 }]}><Image source={{ uri: "/images/og-logo.png" }} style={s.loginLogo} resizeMode="contain" /><View><Text style={[s.brandName, { color: C.forest }]}>OG Landmark</Text><Text style={[s.brandSub, { color: C.muted }]}>ADMINISTRATION</Text></View></View>}
        <Text style={s.eyebrow}>SECURE ACCESS</Text><Text style={s.loginFormTitle}>Welcome back</Text><Text style={s.loginFormDesc}>Sign in with your authorized administrator account.</Text>
        <Text style={s.label}>Admin email</Text><TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="email" keyboardType="email-address" accessibilityLabel="Admin email" editable={step === "credentials"} style={s.input} />
        {step === "credentials" ? <>
          <Text style={s.label}>Password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" accessibilityLabel="Password" style={s.input} onSubmitEditing={submit} />
        </> : <>
          <Text style={s.label}>Email verification code</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email verification code" maxLength={6} style={s.input} onSubmitEditing={submit} />
          {!!message && <Text style={s.loginFormNote}>{message}</Text>}
          <Pressable accessibilityRole="button" onPress={() => { setStep("credentials"); setOtp(""); setMessage(""); setError(""); }} style={{ marginTop: 4, marginBottom: 6 }}>
            <Text style={{ color: C.forest, fontSize: 12, fontWeight: "600" }}>Use a different email or resend by signing in again</Text>
          </Pressable>
        </>}
        {!!error && <Text accessibilityRole="alert" style={s.formError}>{error}</Text>}
        <Button title={busy ? "Please wait…" : step === "credentials" ? "Continue securely" : "Verify and sign in"} kind="primary" onPress={submit} disabled={busy || !identifier || (step === "credentials" ? !password : otp.trim().length < 6)} />
        {step === "credentials" && <Text style={s.loginFormNote}>Sign-in and email verification are handled by Laravel.</Text>}
      </View>
    </ScrollView>
  </View>;
}

function useResource<T>(loader: () => Promise<T>, refresh: number): ResourceState<T> {
  const [data, setData] = useState<T>([] as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const stableLoader = useCallback(loader, []);
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    stableLoader().then((result) => { if (live) setData(result); }).catch((caught: unknown) => {
      if (live) setError(caught instanceof Error ? caught.message : "Unable to load this information.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [stableLoader, refresh, attempt]);
  return { data, loading, error, reload: () => setAttempt((value) => value + 1) };
}

type DialogState =
 | { kind: "property"; record: AnyRecord; onSave: (id: string | number, body: AnyRecord) => Promise<void> }
 | { kind: "announcement"; onCreate: (title: string, message: string) => Promise<void> }
 | { kind: "confirm"; title: string; message: string; confirm: () => Promise<void> }
 | { kind: "reason"; title: string; confirm: (reason: string) => Promise<void> };

function PageContent({ route, refresh, navigate, notify, onRefresh, setDialog }: { route: RouteInfo; refresh: number; navigate: (path: string) => void; notify: (message: string, error?: boolean) => void; onRefresh: () => void; setDialog: (dialog: DialogState | null) => void }) {
  if (route.key === "overview") return <Overview route={route} refresh={refresh} navigate={navigate} onRefresh={onRefresh} />;
  if (route.key === "properties") return <Properties route={route} refresh={refresh} notify={notify} onRefresh={onRefresh} setDialog={setDialog} />;
  if (route.key === "users") return <ReadPage route={route} refresh={refresh} loader={adminApi.users} empty="No user records" emptyText="The users endpoint returned no records." note="Read-only directory. Profile edits, account status changes, role administration, exports and deletion requests have no supported endpoint in the current API." />;
  if (route.key === "agents") return <Agents route={route} refresh={refresh} />;
  if (route.key === "projects") return <ReadPage route={route} refresh={refresh} loader={adminApi.projects} empty="No project records" emptyText="The developer projects endpoint returned no records." note="Project create, edit, publish, archive and verification actions are not supported by the current API." />;
  if (route.key === "inquiries") return <ReadPage route={route} refresh={refresh} loader={adminApi.inquiries} empty="No inquiries" emptyText="There are no inquiry records in the current API response." note="Assignment, contact status, notes and follow-up workflows have no supported endpoint and are not simulated." />;
  if (route.key === "reports") return <ReadPage route={route} refresh={refresh} loader={adminApi.reports} empty="No pending reports" emptyText="The pending reports endpoint returned no records." note="Only pending reports are currently exposed by the API. Report decisions, moderation history, filters and exports are unavailable." />;
  return <Settings route={route} refresh={refresh} notify={notify} setDialog={setDialog} />;
}

function PageHeading({ route, trailing }: { route: RouteInfo; trailing?: ReactNode }) {
  return <View style={s.heading}><View style={{ flex: 1 }}><Text style={s.eyebrow}>OG LANDMARK / ADMIN</Text><Text style={s.headingTitle}>{route.title}</Text><Text style={s.headingDesc}>{route.description}</Text></View>{trailing || <Text style={s.ornament}>PAKISTAN · PROPERTY NETWORK</Text>}</View>;
}
function Button({ title, onPress, kind = "neutral", disabled = false, small = false }: { title: string; onPress: () => void; kind?: "neutral" | "primary" | "soft" | "danger"; disabled?: boolean; small?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, kind === "primary" && s.buttonPrimary, kind === "soft" && s.buttonSoft, kind === "danger" && s.buttonDanger, small && s.buttonSmall, disabled && s.disabled, pressed && !disabled && { opacity: 0.82 }]}><Text style={[s.buttonText, kind === "primary" && s.buttonPrimaryText, kind === "soft" && s.buttonSoftText, kind === "danger" && s.buttonDangerText, small && s.buttonSmallText]}>{title}</Text></Pressable>;
}
function Tag({ text }: { text: string }) { return <View style={[s.tag, tone(text)]}><Text style={[s.tagText, { color: tone(text).color }]}>{text}</Text></View>; }
function Notice({ children }: { children: ReactNode }) { return <View style={s.notice}><Text style={s.noticeText}>{children}</Text></View>; }
function Panel({ title, subtitle, right, children, style }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; style?: object }) {
  return <View style={[s.panel, style]}>{title !== undefined && <View style={s.panelHead}><View style={{ flex: 1 }}><Text style={s.panelTitle}>{title}</Text>{subtitle && <Text style={s.panelSub}>{subtitle}</Text>}</View>{right}</View>}{children}</View>;
}
function LoadState<T>({ resource, children }: { resource: ResourceState<T>; children: (data: T) => ReactNode }) {
  if (resource.loading) return <View style={s.loadingBox}><ActivityIndicator color={C.forest} /><View style={{ width: "70%", gap: 10, marginTop: 15 }}>{[1, 2, 3].map((item) => <View key={item} style={[s.skeleton, { width: `${100 - item * 13}%` }]} />)}</View></View>;
  if (resource.error) return <View style={s.errorBox}><Text style={s.errorText}>{resource.error}</Text><Button title="Try again" small onPress={resource.reload} /></View>;
  return <>{children(resource.data)}</>;
}
function Empty({ title, description }: { title: string; description: string }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Text style={{ color: C.forest, fontSize: 19 }}>—</Text></View><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyDesc}>{description}</Text></View>;
}
function Overview({ route, refresh, navigate, onRefresh }: { route: RouteInfo; refresh: number; navigate: (path: string) => void; onRefresh: () => void }) {
  const { width } = useWindowDimensions();
  const stats = useResource<AdminStats>(() => adminApi.stats(), refresh);
  const properties = useResource<AnyRecord[]>(() => adminApi.properties(), refresh);
  const inquiries = useResource<AnyRecord[]>(() => adminApi.inquiries(), refresh);
  const users = useResource<AnyRecord[]>(() => adminApi.users(), refresh);
  const entries = Object.entries(stats.data || {}).filter(([, value]) => ["number", "string"].includes(typeof value) && String(value).trim() !== "").slice(0, 8);
  return <View>
    <PageHeading route={route} trailing={<Button title="Refresh data" small onPress={onRefresh} />} />
    <LoadState resource={stats}>{() => entries.length ? <View style={s.statGrid}>{entries.map(([key, value], index) => <View key={key} style={s.statCard}><View style={s.statLabelLine}><Text style={s.statLabel}>{statLabel(key)}</Text><View style={[s.statDot, index % 3 === 1 && { backgroundColor: C.gold }]} /></View><Text style={s.statValue}>{valueText(value)}</Text><Text style={s.statFoot}>Reported by the admin service</Text></View>)}</View> : <Panel><Empty title="Statistics are unavailable" description="The admin stats endpoint did not return countable fields. No estimates are shown." /></Panel>}</LoadState>
    <View style={[s.twoColumns, width < 850 && { flexDirection: "column", gap: 0 }]}>
      <OverviewPanel title="Recent property activity" subtitle="Latest records available from property inventory" records={properties} kind="property" onOpen={() => navigate("/admin/properties")} />
      <OverviewPanel title="Lead desk" subtitle="Current inquiry feed" records={inquiries} kind="inquiry" onOpen={() => navigate("/admin/inquiries")} />
    </View>
    <OverviewPanel title="Recent registrations" subtitle="Accounts returned by the existing users endpoint" records={users} kind="user" onOpen={() => navigate("/admin/users")} />
  </View>;
}
function OverviewPanel({ title, subtitle, records, kind, onOpen }: { title: string; subtitle: string; records: ResourceState<AnyRecord[]>; kind: string; onOpen: () => void }) {
  return <Panel title={title} subtitle={subtitle} right={<Button title="View all" small onPress={onOpen} />} style={{ marginBottom: 15, flex: 1, minWidth: 0 }}>
    <LoadState resource={records}>{(items) => items.length ? <View style={s.panelBody}>{items.slice(0, 4).map((record, index) => <View style={s.listRow} key={String(record.id ?? index)}><View style={{ flex: 1 }}><Text style={s.rowTitle} numberOfLines={1}>{recordTitle(record)}</Text><Text style={s.rowSub} numberOfLines={1}>{String(record.email || record.city || record.location || record.createdAt || record.created_at || record.message || "Record details not provided")}</Text></View><Tag text={kind === "user" ? valueText(record.role || record.accountType || "Account") : recordStatus(record)} /></View>)}</View> : <Empty title={`No ${kind} records returned`} description="When records are available, they will appear here." />}</LoadState>
  </Panel>;
}

function ReadPage({ route, refresh, loader, empty, emptyText, note }: { route: RouteInfo; refresh: number; loader: () => Promise<AnyRecord[]>; empty: string; emptyText: string; note: string }) {
  const resource = useResource<AnyRecord[]>(loader, refresh);
  const [query, setQuery] = useState("");
  return <View><PageHeading route={route} /><Notice>{note}</Notice><View style={{ height: 14 }} /><RecordList resource={resource} query={query} setQuery={setQuery} empty={empty} emptyText={emptyText} /></View>;
}
function RecordList({ resource, query, setQuery, empty, emptyText, columns }: { resource: ResourceState<AnyRecord[]>; query: string; setQuery: (value: string) => void; empty: string; emptyText: string; columns?: string[] }) {
  const visible = resource.data.filter((record) => !query || Object.values(record).some((value) => typeof value !== "object" && String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const selected = columns || inferColumns(resource.data);
  return <Panel>
    <View style={s.toolbar}><TextInput value={query} onChangeText={setQuery} placeholder="Search loaded records" placeholderTextColor="#9AA49D" style={[s.input, { flex: 1, minWidth: 180 }]} accessibilityLabel="Search records" /><Text style={s.smallMuted}>{visible.length} shown</Text></View>
    <LoadState resource={resource}>{() => visible.length ? <ScrollView horizontal showsHorizontalScrollIndicator><View style={{ minWidth: "100%" }}><View style={s.tableHead}>{selected.map((column) => <Text style={[s.tableCell, s.tableHeadText]} key={column}>{humanize(column)}</Text>)}</View>{visible.map((record, index) => <View style={s.tableRow} key={String(record.id ?? index)}>{selected.map((column) => <View key={column} style={s.tableCell}>{column.toLowerCase().includes("status") ? <Tag text={valueText(record[column])} /> : <Text style={s.tableValue} numberOfLines={2}>{valueText(record[column])}</Text>}</View>)}</View>)}</View></ScrollView> : <Empty title={query ? "No matching records" : empty} description={query ? "Try another search term." : emptyText} />}</LoadState>
    {!resource.loading && !resource.error && visible.length > 0 && <View style={s.tableFoot}><Text style={s.smallMuted}>Showing {visible.length} of {resource.data.length} records</Text><Text style={s.smallMuted}>Loaded records only</Text></View>}
  </Panel>;
}
function inferColumns(records: AnyRecord[]) {
  if (!records.length) return ["id"];
  const preferred = ["id", "title", "name", "email", "phone", "role", "city", "status", "approvalStatus", "listingStatus", "createdAt"];
  const available = new Set(records.flatMap((record) => Object.keys(record)));
  const columns = preferred.filter((key) => available.has(key)).slice(0, 6);
  return columns.length ? columns : Array.from(available).filter((key) => typeof records[0][key] !== "object").slice(0, 6);
}

function Properties({ route, refresh, notify, onRefresh, setDialog }: { route: RouteInfo; refresh: number; notify: (message: string, error?: boolean) => void; onRefresh: () => void; setDialog: (dialog: DialogState | null) => void }) {
  const resource = useResource<AnyRecord[]>(() => adminApi.properties(), refresh);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const columns = useMemo(() => inferColumns(resource.data), [resource.data]);
  const doAction = async (record: AnyRecord, action: "approve" | "reject" | "request-changes" | "verify" | "feature", reason?: string) => {
    const id = record.id as string | number | undefined;
    if (id === undefined) { notify("This property has no usable identifier.", true); return; }
    setBusyId(id);
    try {
      await adminApi.moderateProperty(id, action, action === "feature" ? { featured: !Boolean(record.featured) } : reason ? { reason } : {});
      notify(action === "feature" ? "Featured status updated." : `Property ${action === "request-changes" ? "changes requested" : action === "approve" ? "approved" : action === "reject" ? "rejected" : "verified"}.`);
      onRefresh();
    } catch (error) { notify(error instanceof Error ? error.message : "Property action failed.", true); }
    finally { setBusyId(null); }
  };
  const askModeration = (record: AnyRecord, action: "approve" | "reject" | "request-changes" | "verify" | "feature") => {
    if (action === "reject" || action === "request-changes") {
      setDialog({ kind: "reason", title: action === "reject" ? "Reason for rejection" : "Request property changes", confirm: async (reason) => doAction(record, action, reason) });
    } else doAction(record, action);
  };
  const records = resource.data.filter((record) => !query || Object.values(record).some((value) => typeof value !== "object" && String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  return <View><PageHeading route={route} trailing={<Text style={s.ornament}>INVENTORY · MODERATION</Text>} />
    <Notice>Create, archive, restore, bulk actions and media management are unavailable in the current API. Supported edits, moderation, featuring and deletion are enabled.</Notice>
    <View style={{ height: 14 }} /><Panel><View style={s.toolbar}><TextInput value={query} onChangeText={setQuery} placeholder="Search property records" placeholderTextColor="#9AA49D" style={[s.input, { flex: 1, minWidth: 180 }]} accessibilityLabel="Search property records" /><Button title="Refresh" small onPress={() => { resource.reload(); onRefresh(); }} /></View>
      <LoadState resource={resource}>{() => records.length ? <ScrollView horizontal showsHorizontalScrollIndicator><View style={{ minWidth: "100%" }}>
        <View style={s.tableHead}>{["Property", ...columns.filter((column) => !["title", "name", "propertyTitle"].includes(column)), "Actions"].map((column) => <Text style={[s.tableCell, s.tableHeadText]} key={column}>{humanize(column)}</Text>)}</View>
        {records.map((record, index) => {
          const status = recordStatus(record); const pending = /pending|review/i.test(status);
          return <View key={String(record.id ?? index)} style={[s.propertyRow, busyId === record.id && { opacity: .55 }]}>
            <View style={s.propertyTitleCell}><Text style={s.rowTitle} numberOfLines={2}>{recordTitle(record)}</Text><Text style={s.rowSub}>Ref {valueText(record.id)}</Text></View>
            {columns.filter((column) => !["title", "name", "propertyTitle"].includes(column)).map((column) => <View key={column} style={s.tableCell}>{column.toLowerCase().includes("status") ? <Tag text={valueText(record[column])} /> : <Text style={s.tableValue} numberOfLines={2}>{valueText(record[column])}</Text>}</View>)}
            <View style={[s.tableCell, { minWidth: 300 }]}><View style={s.actionWrap}>
              <Button title="Edit" small onPress={() => setDialog({ kind: "property", record, onSave: async (id, body) => { await adminApi.updateProperty(id, body); notify("Property details saved."); onRefresh(); } })} disabled={busyId === record.id} />
              {pending && <><Button title="Approve" kind="soft" small onPress={() => askModeration(record, "approve")} disabled={busyId === record.id} /><Button title="Reject" kind="danger" small onPress={() => askModeration(record, "reject")} disabled={busyId === record.id} /><Button title="Request changes" small onPress={() => askModeration(record, "request-changes")} disabled={busyId === record.id} /></>}
              {!pending && <Button title="Verify" small onPress={() => askModeration(record, "verify")} disabled={busyId === record.id} />}
              <Button title={record.featured ? "Unfeature" : "Feature"} small onPress={() => askModeration(record, "feature")} disabled={busyId === record.id} />
              <Button title="Delete" kind="danger" small onPress={() => setDialog({ kind: "confirm", title: "Delete property", message: `Delete “${recordTitle(record)}”? This action cannot be undone.`, confirm: async () => { if (record.id === undefined) throw new Error("Property identifier missing."); await adminApi.deleteProperty(record.id as string | number); notify("Property deleted."); onRefresh(); } })} disabled={busyId === record.id} />
            </View></View>
          </View>;
        })}
      </View></ScrollView> : <Empty title={query ? "No matching properties" : "No property records"} description={query ? "Adjust the search to see more." : "The property API returned no records. Listings are not fabricated."} />}</LoadState>
    </Panel>
  </View>;
}

function Agents({ route, refresh }: { route: RouteInfo; refresh: number }) {
  const mobile = useResource<AnyRecord[]>(() => adminApi.mobileAgents(), refresh);
  const city = useResource<AnyRecord[]>(() => adminApi.cityAgents(), refresh);
  const [tab, setTab] = useState<"mobile" | "city">("mobile");
  const resource = tab === "mobile" ? mobile : city;
  return <View><PageHeading route={route} trailing={<Text style={s.ornament}>AGENT NETWORK</Text>} />
    <Notice>Agent creation, profile edits, verification decisions and suspension controls are unavailable. This view reflects data only.</Notice>
    <View style={[s.toolbar, { paddingHorizontal: 0 }]}><Button title="Mobile agents" kind={tab === "mobile" ? "primary" : "neutral"} onPress={() => setTab("mobile")} /><Button title="City agents" kind={tab === "city" ? "primary" : "neutral"} onPress={() => setTab("city")} /></View>
    <RecordList resource={resource} query="" setQuery={() => undefined} empty="No agents returned" emptyText="No agent records are currently available from this feed." />
  </View>;
}

function Settings({ route, refresh, notify, setDialog }: { route: RouteInfo; refresh: number; notify: (message: string, error?: boolean) => void; setDialog: (dialog: DialogState | null) => void }) {
  const { width } = useWindowDimensions();
  const resource = useResource<Announcement[]>(() => adminApi.announcements(), refresh);
  const create = async (title: string, message: string) => {
    await adminApi.createAnnouncement({ title, message });
    notify("Announcement created.");
  };
  return <View><PageHeading route={route} trailing={<Text style={s.ornament}>PLATFORM OPERATIONS</Text>} />
    <View style={[s.twoColumns, width < 850 && { flexDirection: "column", gap: 0 }]}>
      <Panel title="Announcements" subtitle="Available through the existing Laravel endpoint" right={<Button title="New announcement" kind="primary" small onPress={() => setDialog({ kind: "announcement", onCreate: create })} />} style={{ flex: 1, minWidth: 0 }}>
        <LoadState resource={resource}>{(items) => items.length ? <View style={s.panelBody}>{items.map((item, index) => <View key={String(item.id ?? index)} style={s.announcement}><Text style={s.rowTitle}>{item.title || "Untitled announcement"}</Text><Text style={s.rowSub}>{item.message || item.body || "No message returned."}</Text><Text style={s.dateText}>{item.createdAt || item.created_at ? new Date(String(item.createdAt || item.created_at)).toLocaleString() : "Date not provided"}</Text></View>)}</View> : <Empty title="No announcements returned" description="Publish an announcement using the supported create endpoint." />}</LoadState>
      </Panel>
      <Panel title="Configuration status" subtitle="Controls beyond announcements require API support" style={{ flex: 1, minWidth: 0 }}>
        <View style={s.panelBody}><Notice>System preferences, locations, categories, moderation rules, notification delivery, maintenance mode, roles and audit logs cannot be changed through the current admin API.</Notice>
          {["Platform settings", "Location & categories", "Admin roles", "Audit history"].map((title) => <View key={title} style={s.unavailable}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowSub}>Unavailable — no supported endpoint or data source.</Text></View>)}
        </View>
      </Panel>
    </View>
  </View>;
}

function AdminDialog({ state, onClose, notify, refresh }: { state: DialogState; onClose: () => void; notify: (message: string, error?: boolean) => void; refresh: () => void }) {
  const [title, setTitle] = useState(state.kind === "property" ? recordTitle(state.record) : "");
  const [fields, setFields] = useState<AnyRecord>(() => {
    if (state.kind !== "property") return {};
    const allowed = ["title", "description", "price", "city", "address", "location"];
    return Object.fromEntries(allowed.filter((key) => key in state.record).map((key) => [key, state.record[key]]));
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!busy) onClose(); };
  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (state.kind === "property") {
        if (state.record.id === undefined) throw new Error("Property identifier missing.");
        await state.onSave(state.record.id as string | number, fields);
      } else if (state.kind === "announcement") {
        if (!title.trim() || !message.trim()) throw new Error("Enter both a title and a message.");
        await state.onCreate(title.trim(), message.trim());
        notify("Announcement created."); refresh();
      } else if (state.kind === "reason") {
        if (!message.trim()) throw new Error("A reason is required.");
        await state.confirm(message.trim());
      } else {
        await state.confirm();
      }
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The action could not be completed."); }
    finally { setBusy(false); }
  };
  const modalTitle = state.kind === "property" ? "Edit property" : state.kind === "announcement" ? "Publish announcement" : state.kind === "reason" || state.kind === "confirm" ? state.title : "Confirm";
  return <Modal transparent visible animationType="fade" onRequestClose={close}>
    <View style={s.modalBackdrop}><View style={s.modal}>
      <View style={s.modalHead}><Text style={s.modalTitle}>{modalTitle}</Text><Button title="Close" small onPress={close} /></View>
      <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
        {state.kind === "property" && <>
          {Object.keys(fields).length ? Object.keys(fields).map((key) => <View key={key} style={{ marginBottom: 12 }}><Text style={s.label}>{humanize(key)}</Text><TextInput multiline={key === "description"} value={String(fields[key] ?? "")} onChangeText={(value) => setFields({ ...fields, [key]: value })} style={[s.input, key === "description" && s.textarea]} /></View>) : <Notice>No editable title, description, price or location fields were returned for this record.</Notice>}
          <Text style={s.rowSub}>Only fields present on this record are sent using the supported PATCH endpoint.</Text>
        </>}
        {state.kind === "announcement" && <>
          <Notice>The API supports immediate creation only. Scheduling, audience targeting and delivery confirmation are unavailable.</Notice>
          <Text style={[s.label, { marginTop: 14 }]}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={160} style={s.input} />
          <Text style={[s.label, { marginTop: 14 }]}>Message</Text><TextInput multiline value={message} onChangeText={setMessage} style={[s.input, s.textarea]} />
        </>}
        {state.kind === "reason" && <><Text style={s.modalHelp}>{state.title}. This reason is sent to the property moderation endpoint.</Text><TextInput multiline value={message} onChangeText={setMessage} placeholder="Add a clear reason" style={[s.input, s.textarea]} /></>}
        {state.kind === "confirm" && <Text style={s.modalHelp}>{state.message}</Text>}
        {!!error && <Text accessibilityRole="alert" style={s.formError}>{error}</Text>}
      </ScrollView>
      <View style={s.modalFoot}><Button title="Cancel" onPress={close} /><Button title={busy ? "Working…" : state.kind === "property" ? "Save changes" : state.kind === "announcement" ? "Create announcement" : state.kind === "reason" ? "Submit decision" : "Delete property"} kind={state.kind === "confirm" ? "danger" : "primary"} onPress={submit} disabled={busy || (state.kind === "property" && !Object.keys(fields).length)} /></View>
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: "100vh" as never, flexDirection: "row", backgroundColor: C.canvas },
  main: { flex: 1, minWidth: 0, minHeight: "100%" },
  sidebar: { position: "fixed" as never, zIndex: 10, left: 0, top: 0, bottom: 0, width: 254, backgroundColor: C.forest, paddingTop: 20, paddingBottom: 12 },
  mobileSidebar: { width: 280, elevation: 12, shadowColor: "#102D20", shadowOffset: { width: 5, height: 0 }, shadowOpacity: .16, shadowRadius: 25 },
  brand: { height: 65, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.13)" },
  logo: { width: 40, height: 40 },
  brandName: { color: C.white, fontSize: 15, fontWeight: "700" },
  brandSub: { color: "#B8CBC0", fontSize: 9, letterSpacing: 1.4, marginTop: 3 },
  closeNav: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4 },
  navScroll: { flex: 1, paddingTop: 20, paddingHorizontal: 12 },
  navCaption: { color: "#A6C0B1", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 12, paddingBottom: 8 },
  navItem: { minHeight: 42, flexDirection: "row", alignItems: "center", borderRadius: 6, paddingHorizontal: 12, marginBottom: 3, gap: 12 },
  navActive: { backgroundColor: "#245440", borderLeftWidth: 3, borderLeftColor: "#B8D392" },
  navMark: { width: 18, textAlign: "center", color: "#C6D5CC", fontSize: 16 },
  navText: { color: "#C6D5CC", fontSize: 12 },
  sidebarFoot: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.13)", paddingHorizontal: 16, paddingTop: 14 },
  userLine: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  userName: { color: C.white, fontSize: 11, fontWeight: "700" },
  userEmail: { color: "#AEC2B5", fontSize: 9, marginTop: 3 },
  avatar: { width: 33, height: 33, borderRadius: 18, backgroundColor: "#DCE8D8", alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.forest, fontSize: 10, fontWeight: "700" },
  signOut: { borderWidth: 1, borderColor: "rgba(255,255,255,.2)", borderRadius: 5, padding: 9 },
  signOutText: { color: "#D6E2D9", fontSize: 11 },
  scrim: { position: "absolute", zIndex: 9, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(7,28,20,.38)" },
  topbar: { height: 70, paddingHorizontal: 26, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  topbarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  crumb: { color: C.muted, fontSize: 11 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.green },
  smallMuted: { color: C.muted, fontSize: 10 },
  menuButton: { padding: 8 },
  menuGlyph: { color: C.forest, fontSize: 19 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 34, paddingVertical: 31, maxWidth: 1500, width: "100%", alignSelf: "center" },
  heading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  eyebrow: { color: "#718177", fontSize: 9, fontWeight: "700", letterSpacing: 1.6 },
  headingTitle: { color: C.deep, fontSize: 30, fontWeight: "500", letterSpacing: -1.2, marginTop: 7 },
  headingDesc: { color: C.muted, fontSize: 11, marginTop: 7 },
  ornament: { color: C.gold, fontSize: 9, letterSpacing: 1.1, paddingBottom: 5 },
  panel: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, overflow: "hidden", marginBottom: 15, shadowColor: "#173528", shadowOffset: { width: 0, height: 8 }, shadowOpacity: .035, shadowRadius: 18, elevation: 1 },
  panelHead: { minHeight: 68, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelTitle: { color: C.forest, fontSize: 13, fontWeight: "700" },
  panelSub: { color: C.muted, fontSize: 9, marginTop: 4 },
  panelBody: { paddingHorizontal: 18, paddingBottom: 13 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginBottom: 16 },
  statCard: { flexGrow: 1, flexBasis: "22%", minWidth: 150, minHeight: 119, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 17 },
  statLabelLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { color: "#69766F", fontSize: 10 },
  statDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.green },
  statValue: { marginTop: 18, color: C.forest, fontSize: 27, fontWeight: "700", letterSpacing: -1.1 },
  statFoot: { color: "#87918B", fontSize: 9, marginTop: 3 },
  twoColumns: { flexDirection: "row", gap: 15 },
  listRow: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "#EDF0EB" },
  rowTitle: { color: "#27372E", fontSize: 11, fontWeight: "700" },
  rowSub: { color: C.muted, fontSize: 9, marginTop: 4, lineHeight: 14 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: 9, fontWeight: "700" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  input: { minHeight: 38, borderWidth: 1, borderColor: "#DCE3DB", borderRadius: 5, backgroundColor: C.paper, color: C.ink, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11 },
  textarea: { minHeight: 105, textAlignVertical: "top", paddingTop: 10 },
  label: { color: "#68756E", fontSize: 10, fontWeight: "700", marginBottom: 6 },
  button: { minHeight: 35, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#DCE3DB", borderRadius: 5, backgroundColor: C.paper },
  buttonPrimary: { backgroundColor: C.forest, borderColor: C.forest },
  buttonSoft: { backgroundColor: C.soft, borderColor: C.soft },
  buttonDanger: { backgroundColor: C.paper, borderColor: "#EAD3CE" },
  buttonSmall: { minHeight: 28, paddingHorizontal: 8 },
  disabled: { opacity: .5 },
  buttonText: { color: "#435249", fontSize: 10, fontWeight: "700" },
  buttonPrimaryText: { color: C.white },
  buttonSoftText: { color: C.forest },
  buttonDangerText: { color: C.danger },
  buttonSmallText: { fontSize: 9 },
  notice: { backgroundColor: C.tint, borderLeftWidth: 3, borderLeftColor: C.gold, paddingHorizontal: 12, paddingVertical: 11 },
  noticeText: { color: "#695C43", fontSize: 10, lineHeight: 16 },
  loadingBox: { minHeight: 150, alignItems: "center", justifyContent: "center", padding: 22 },
  skeleton: { height: 11, borderRadius: 8, backgroundColor: "#E9EEE7" },
  errorBox: { minHeight: 110, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#FBEFEC" },
  errorText: { flex: 1, color: "#88483F", fontSize: 11 },
  empty: { minHeight: 190, padding: 26, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 40, height: 40, borderRadius: 22, backgroundColor: "#F2F6EF", borderWidth: 1, borderColor: "#DFE9DD", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { color: C.forest, fontSize: 12, fontWeight: "700", textAlign: "center" },
  emptyDesc: { color: C.muted, fontSize: 10, lineHeight: 16, textAlign: "center", maxWidth: 340, marginTop: 6 },
  tableHead: { flexDirection: "row", alignItems: "center", backgroundColor: "#FAFBF7", borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 37 },
  tableHeadText: { color: "#7B8880", fontSize: 8, fontWeight: "700", letterSpacing: .8, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EDF0EB", minHeight: 55 },
  tableCell: { width: 150, minWidth: 130, paddingHorizontal: 13, paddingVertical: 10, justifyContent: "center" },
  tableValue: { color: "#344139", fontSize: 10 },
  tableFoot: { paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  propertyRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EDF0EB", minHeight: 74 },
  propertyTitleCell: { width: 160, minWidth: 150, paddingHorizontal: 13, paddingVertical: 10, justifyContent: "center" },
  actionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  announcement: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 15 },
  dateText: { color: "#98A29B", fontSize: 8, marginTop: 8 },
  unavailable: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 13 },
  loginRoot: { flex: 1, minHeight: "100%", flexDirection: "row", backgroundColor: C.paper },
  loginPanel: { flex: 1.05, minWidth: 300, paddingHorizontal: 54, paddingVertical: 42, backgroundColor: C.forest, justifyContent: "space-between" },
  loginBrand: { flexDirection: "row", alignItems: "center", gap: 11 },
  loginLogo: { width: 42, height: 42 },
  loginCopy: { maxWidth: 470, paddingVertical: 45 },
  loginEyebrow: { color: "#B4C9BA", fontSize: 9, letterSpacing: 1.6 },
  loginHeadline: { marginTop: 17, color: "#EEF5EF", fontSize: 56, lineHeight: 58, fontFamily: "Instrument Serif", fontWeight: "400" },
  loginItalic: { color: "#B8D392", fontStyle: "italic" },
  loginDescription: { color: "#C5D5CA", fontSize: 12, lineHeight: 20, maxWidth: 330, marginTop: 17 },
  loginFooter: { color: "#B4C9BA", fontSize: 9 },
  loginFormSide: { flex: 1, minHeight: "100%", justifyContent: "center", alignItems: "center", padding: 28 },
  loginForm: { width: "100%", maxWidth: 385 },
  loginFormTitle: { marginTop: 8, color: C.forest, fontSize: 25, fontWeight: "700", letterSpacing: -.8 },
  loginFormDesc: { color: C.muted, fontSize: 11, marginTop: 8, marginBottom: 25 },
  loginFormNote: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 15 },
  formError: { color: C.danger, fontSize: 10, marginVertical: 10 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(9,35,26,.48)", alignItems: "center", justifyContent: "center", padding: 18 },
  modal: { width: "100%", maxWidth: 540, maxHeight: "90%", backgroundColor: C.paper, borderRadius: 9, overflow: "hidden" },
  modalHead: { minHeight: 59, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  modalTitle: { color: C.forest, fontSize: 14, fontWeight: "700" },
  modalBody: { paddingHorizontal: 19, paddingVertical: 18 },
  modalFoot: { paddingHorizontal: 18, paddingVertical: 13, flexDirection: "row", justifyContent: "flex-end", gap: 8, borderTopWidth: 1, borderTopColor: C.line },
  modalHelp: { color: C.muted, fontSize: 11, lineHeight: 18, marginBottom: 13 },
  toast: { position: "absolute", zIndex: 100, right: 18, bottom: 18, maxWidth: 390, backgroundColor: C.forest, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 6, elevation: 9 },
  toastText: { color: C.white, fontSize: 11 },
});

export default App;
